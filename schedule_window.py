"""Janela de execução real. A única fonte de tempo é o servidor."""
import datetime as dt
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
import missions

try:
    TZ = ZoneInfo('America/Sao_Paulo')
except ZoneInfoNotFoundError:
    with (Path(__file__).parent / 'assets/timezones/Sao_Paulo').open('rb') as source:
        TZ = ZoneInfo.from_file(source, key='America/Sao_Paulo')
UTC = dt.timezone.utc


def now():
    return dt.datetime.now(UTC)


def needs_migration(c):
    return not c.execute("SELECT 1 FROM sqlite_master WHERE name='schedule_corrections'").fetchone()


def initialize(c):
    c.execute("""CREATE TABLE IF NOT EXISTS schedule_corrections(
        id INTEGER PRIMARY KEY, event_id INTEGER NOT NULL, date TEXT NOT NULL,
        action TEXT NOT NULL, created TEXT NOT NULL)""")


def tolerance(c):
    row=c.execute("SELECT value FROM settings WHERE key='after_minutes'").fetchone()
    return int(row[0]) if row else 30


def configure(c,body):
    value=body.get('after_minutes')
    if type(value) is not int or not 0<=value<=240:
        raise ValueError('A tolerância deve ser de 0 a 240 minutos.')
    c.execute("INSERT INTO settings VALUES('after_minutes',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",(str(value),))
    return {'after_minutes':value}


def window(c,event,date,instant=None):
    instant=instant or now()
    local=dt.datetime.combine(dt.date.fromisoformat(date),dt.time.fromisoformat(event['time']),TZ)
    # Use elapsed UTC minutes across DST; nonexistent wall times roll forward through the gap.
    opens=local.astimezone(UTC)
    closes=opens+dt.timedelta(minutes=event['duration']+tolerance(c))
    state='upcoming' if instant<opens else 'expired' if instant>closes else 'open'
    return {'state':state,'opens_at':opens.astimezone(TZ).isoformat(),
            'closes_at':closes.astimezone(TZ).isoformat(),'server_now':instant.astimezone(TZ).isoformat()}


def require_open(c,event,date):
    timing=window(c,event,date)
    if timing['state']!='open':
        label='ainda não abriu' if timing['state']=='upcoming' else 'já encerrou'
        raise missions.Conflict('A confirmação '+label+'. Janela: '+timing['opens_at']+' até '+timing['closes_at']+'. O responsável pode corrigir pela área protegida.')
    return timing


def correction(c,event_id,date,action):
    c.execute('INSERT INTO schedule_corrections(event_id,date,action,created) VALUES(?,?,?,?)',
              (event_id,date,action,now().isoformat()))
