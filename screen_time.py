"""One server-timed play lease per adventure, shared across tabs and devices."""
import datetime as dt
import json
import math
import re
import secrets

import schedule_window as timing

DEFAULT = {'enabled': True, 'session': 15, 'daily': 30, 'pause': 5, 'opens': '00:00', 'closes': '00:00'}
LEASE = 15
CHECKPOINT_GRACE = 8
TAB = re.compile(r'[a-f0-9]{32}')
TIME = re.compile(r'(?:[01]\d|2[0-3]):[0-5]\d')
MESSAGES = {
    'hours': 'Agora é hora de uma atividade fora da tela.',
    'daily': 'O tempo de jogo de hoje terminou.',
    'pause': 'Hora de uma pausa.',
    'other': 'A aventura está aberta em outra aba ou aparelho. A agenda continua disponível aqui.',
    'lease': 'A conexão com a aventura fez uma pausa.',
    'chapter': 'Este capítulo fica guardado até a campanha chegar até ele.',
}


def initialize(c):
    c.execute('''CREATE TABLE IF NOT EXISTS screen_config(id INTEGER PRIMARY KEY CHECK(id=1), policy TEXT NOT NULL)''')
    c.execute('INSERT OR IGNORE INTO screen_config VALUES(1,?)', (json.dumps(DEFAULT),))
    c.execute('''CREATE TABLE IF NOT EXISTS screen_days(day TEXT PRIMARY KEY, seconds REAL NOT NULL)''')
    c.execute('''CREATE TABLE IF NOT EXISTS screen_session(id INTEGER PRIMARY KEY CHECK(id=1),
       owner TEXT NOT NULL DEFAULT '', tab TEXT NOT NULL DEFAULT '', stamp REAL NOT NULL DEFAULT 0,
       deadline REAL NOT NULL DEFAULT 0, used REAL NOT NULL DEFAULT 0, rest REAL NOT NULL DEFAULT 0,
       last_owner TEXT NOT NULL DEFAULT '', last_tab TEXT NOT NULL DEFAULT '', last_until REAL NOT NULL DEFAULT 0)''')
    c.execute('INSERT OR IGNORE INTO screen_session(id) VALUES(1)')
    c.execute('''CREATE TABLE IF NOT EXISTS adventure_validation(owner TEXT NOT NULL, token TEXT PRIMARY KEY,
                  expires REAL NOT NULL)''')
    c.execute('''CREATE TABLE IF NOT EXISTS adventure_preview(
                  token TEXT NOT NULL REFERENCES adventure_validation(token) ON DELETE CASCADE,
                  key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(token,key))''')


def config(c):
    return json.loads(c.execute('SELECT policy FROM screen_config WHERE id=1').fetchone()[0])


def row(c):
    return dict(c.execute('SELECT * FROM screen_session WHERE id=1').fetchone())


def release(c, s, at):
    if not s['owner']:
        return
    c.execute('''UPDATE screen_session SET last_owner=owner,last_tab=tab,last_until=?,
                 owner='',tab='',deadline=0 WHERE id=1''', (at+CHECKPOINT_GRACE,))


def local(stamp):
    return dt.datetime.fromtimestamp(stamp, timing.TZ)


def boundary(day, value):
    return dt.datetime.combine(day, dt.time.fromisoformat(value), timing.TZ).timestamp()


def hours(policy, now):
    start, end = policy['opens'], policy['closes']
    date = local(now)
    day = date.date()
    if start == end:
        return math.inf
    clock = date.strftime('%H:%M')
    if start < end:
        return boundary(day, end) if start<=clock<end else None
    if clock >= start:
        return boundary(day+dt.timedelta(days=1), end)
    if clock < end:
        return boundary(day, end)
    return None


def spent(c, day):
    value = c.execute('SELECT seconds FROM screen_days WHERE day=?', (day,)).fetchone()
    return value[0] if value else 0


def usage(c, now):
    day=local(now).date().isoformat()
    s=row(c)
    seconds=spent(c,day)
    if s['owner'] and local(s['stamp']).date().isoformat()==day:
        seconds+=max(0,min(now,s['deadline'])-s['stamp'])
    return {'played_minutes': math.floor(seconds/60), 'resting':s['rest']>now}


def settle(c, policy, now):
    s = row(c)
    if s['owner']:
        end = min(now, s['deadline'])
        elapsed = max(0, end-s['stamp'])
        if elapsed:
            # Every grant expires at local midnight at the latest.
            day = local(s['stamp']).date().isoformat()
            c.execute('''INSERT INTO screen_days VALUES(?,?) ON CONFLICT(day)
                         DO UPDATE SET seconds=seconds+excluded.seconds''', (day, elapsed))
            c.execute('UPDATE screen_session SET stamp=?,used=used+? WHERE id=1', (end, elapsed))
            s['used'] += elapsed
        if policy['enabled'] and s['used'] >= policy['session']*60:
            c.execute('UPDATE screen_session SET rest=? WHERE id=1', (end+policy['pause']*60,))
            release(c, s, end)
        elif now >= s['deadline']:
            release(c, s, end)
    result = row(c)
    rested=result['rest'] and now >= result['rest']
    inactive=(not result['owner'] and not result['rest'] and result['used']>0 and
              now>=result['stamp']+policy['pause']*60)
    if rested or inactive:
        reset(c)
        result = row(c)
    return result


def reset(c):
    c.execute('UPDATE screen_session SET used=0,rest=0 WHERE id=1')


def allowance(c, policy, s, now):
    if not policy['enabled']:
        return math.inf, None
    closing = hours(policy, now)
    if closing is None:
        return 0, 'hours'
    daily = policy['daily']*60-spent(c, local(now).date().isoformat())
    if daily <= 0:
        return 0, 'daily'
    if s['rest'] > now:
        return 0, 'pause'
    remaining = min(policy['session']*60-s['used'], daily, closing-now)
    return remaining, 'pause' if remaining <= 0 else None


def configure(c, body, now):
    fields = {key: body.get(key) for key in DEFAULT}
    if (type(fields['enabled']) is not bool or
            any(type(fields[k]) is not int or not 1<=fields[k]<=maximum
                for k, maximum in [('session', 180), ('daily', 720), ('pause', 120)]) or
            any(not isinstance(fields[k], str) or not TIME.fullmatch(fields[k]) for k in ('opens', 'closes'))):
        raise ValueError('Revise as durações inteiras e os horários do combinado.')
    previous = config(c)
    s = settle(c, previous, now)
    release(c, s, now)
    if fields['enabled'] and s['used'] >= fields['session']*60 and s['rest'] <= now:
        c.execute('UPDATE screen_session SET rest=? WHERE id=1', (now+fields['pause']*60,))
    c.execute('UPDATE screen_config SET policy=? WHERE id=1', (json.dumps(fields),))


def reply(reason, remaining=None, lease=None):
    allowed = reason is None
    return {'allowed': allowed, 'reason': reason, 'message': MESSAGES.get(reason), 'remaining': remaining, 'lease': lease}


def play(c, owner, tab, action, now):
    if not isinstance(tab, str) or not TAB.fullmatch(tab):
        raise ValueError('Identificador da aba inválido.')
    if action not in ('start', 'leave', 'pause'):
        raise ValueError('Ação de sessão inválida.')
    policy = config(c)
    s = settle(c, policy, now)
    same = (s['owner'], s['tab']) == (owner, tab)
    if action in ('pause', 'leave'):
        if same:
            release(c, s, now)
        if action == 'pause' and (same or (not policy['enabled'] and not s['owner'])):
            c.execute('UPDATE screen_session SET rest=? WHERE id=1', (now+policy['pause']*60,))
        return reply('pause' if action == 'pause' else 'lease')
    remaining, reason = allowance(c, policy, s, now)
    if reason:
        return reply(reason)
    if not policy['enabled']:
        return reply(None, lease=LEASE)
    if s['owner'] and not same:
        return reply('other')
    tomorrow = local(now).date()+dt.timedelta(days=1)
    lease = min(LEASE, remaining, boundary(tomorrow, '00:00')-now)
    c.execute('UPDATE screen_session SET owner=?,tab=?,stamp=?,deadline=? WHERE id=1', (owner, tab, now, now+lease))
    return reply(None, math.ceil(remaining), lease)


def guard(c, owner, tab, now, checkpoint=False):
    policy = config(c)
    if not policy['enabled']:
        return None
    s = settle(c, policy, now)
    if s['owner'] and (s['owner'], s['tab']) == (owner, tab):
        return None
    if (checkpoint and not s['owner'] and (s['last_owner'], s['last_tab']) == (owner, tab)
            and now <= s['last_until']):
        c.execute('UPDATE screen_session SET last_until=0 WHERE id=1')
        return None
    _, reason = allowance(c, policy, s, now)
    return reason or ('other' if s['owner'] else 'lease')


def validation(c, owner, token, now):
    return bool(token and TAB.fullmatch(token) and c.execute(
        'SELECT 1 FROM adventure_validation WHERE owner=? AND token=? AND expires>?',
        (owner, token, now)).fetchone())


def validation_grant(c, owner, old_token, enabled, now):
    c.execute('DELETE FROM adventure_validation WHERE expires<=? OR (owner=? AND token=?)',
              (now, owner, old_token))
    if not enabled:
        return None
    token = secrets.token_hex(16)
    c.execute('INSERT INTO adventure_validation VALUES(?,?,?)', (owner, token, now+3600))
    return token
