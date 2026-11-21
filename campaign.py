"""Persistent chapters and parent-approved, off-device accomplishments."""
import json
import math
import re
import unicodedata

import forest
import missions
import world_maps
import world

CHAPTERS = ('forest', 'praia', 'dinossauros', 'inventores')
FINALES = ('leaf', 'chest-song', 'skeleton', 'machine')
DISCOVERIES = ('Visite o besouro e vire a folha no Recanto',
               'Revele a pérola no Baú das Marés',
               'Monte o esqueleto no painel dos paleontólogos',
               'Acorde o autômato da cidade')
CATEGORIES = {'learning': 'Aprendizado', 'play': 'Brincadeira', 'sport': 'Esporte recreativo',
              'project': 'Projeto criativo', 'help': 'Colaboração'}
# The parent also classifies the activity positively. Known essential care in a
# title, notes or any linked script takes precedence over that classification.
ESSENTIAL = re.compile(
    r'\b(?:medic\w*|remedio\w*|dose\w*|comprimido\w*|vitamina\w*|insulina\w*|ferro (?:em )?gotas|'
    r'inalac\w*|vacina\w*|higien\w*|banheir\w*|banho\w*|banhar\w*|escov\w*|dentes?|'
    r'fio dental|lavar (?:as )?maos|lavar (?:o )?rosto|xixi|coco|trocar (?:a )?fralda\w*|'
    r'comer|comida\w*|almoc\w*|jant\w*|cafe|refeic\w*|aliment\w*|'
    r'lanche\w*|amament\w*|mamadeira|beber|hidrat\w*|nutric\w*|terap\w*|fono\w*|'
    r'psicolog\w*|psicopedagog\w*|fisioterap\w*|dentista|tratamento\w*|consulta\w*|acompanhamento clinico)\b')
CARE_ICONS = {'💊','🩺','🦷','🪥','🚽','🚿','🛁','🍽️','🍴'}


class Locked(ValueError):
    pass


def initialize(c):
    for sql in (
        '''CREATE TABLE IF NOT EXISTS campaign_state(id INTEGER PRIMARY KEY CHECK(id=1),
           generation INTEGER NOT NULL, targets TEXT NOT NULL)''',
        '''CREATE TABLE IF NOT EXISTS campaign_eligible(event_key TEXT PRIMARY KEY,
           category TEXT NOT NULL)''',
        '''CREATE TABLE IF NOT EXISTS campaign_discoveries(generation INTEGER NOT NULL, world TEXT NOT NULL,
           PRIMARY KEY(generation,world))''',
        '''CREATE TABLE IF NOT EXISTS campaign_unlocks(generation INTEGER NOT NULL, world TEXT NOT NULL,
           PRIMARY KEY(generation,world))''',
        '''CREATE TABLE IF NOT EXISTS campaign_approvals(event_key TEXT NOT NULL, date TEXT NOT NULL,
           generation INTEGER NOT NULL, event_id INTEGER NOT NULL, title TEXT NOT NULL, icon TEXT NOT NULL,
           category TEXT NOT NULL, approved_at TEXT NOT NULL, PRIMARY KEY(event_key,date))''',
        '''CREATE INDEX IF NOT EXISTS campaign_approvals_by_generation ON campaign_approvals(generation)''',
    ):
        c.execute(sql)
    if c.execute('SELECT 1 FROM campaign_state WHERE id=1').fetchone():
        return
    if world.generation(c)>1:
        generation=c.execute('''SELECT COALESCE(MAX(generation),0)+1 FROM (
            SELECT generation FROM campaign_unlocks UNION ALL
            SELECT generation FROM campaign_discoveries UNION ALL
            SELECT generation FROM campaign_approvals)''').fetchone()[0]
        c.execute("INSERT INTO campaign_state VALUES(1,?,'[3,6,9]')",(generation,))
        c.execute("INSERT INTO campaign_unlocks VALUES(?,'forest')",(generation,))
        return
    c.execute("INSERT INTO campaign_state VALUES(1,1,'[3,6,9]')")
    reached = 0
    if c.execute("SELECT 1 FROM settings WHERE key='trail_shelter_leaf'").fetchone():
        discover(c, 'forest')
    for i, key in enumerate(CHAPTERS[1:], 1):
        found = world_maps.progress(c, key)
        if found or forest.read_json_setting(c, 'world_position_' + key):
            reached = i
        if FINALES[i] in found:
            discover(c, key)
    c.executemany('INSERT OR IGNORE INTO campaign_unlocks VALUES(1,?)',
                  [(key,) for key in CHAPTERS[:reached+1]])


def state(c):
    row = c.execute('SELECT generation,targets FROM campaign_state WHERE id=1').fetchone()
    return row['generation'], json.loads(row['targets'])


def counts(c, generation):
    return c.execute('SELECT COUNT(*) FROM campaign_approvals WHERE generation=?', (generation,)).fetchone()[0]


def progress(c, validation=False):
    generation, targets = state(c)
    unlocked = {r[0] for r in c.execute('SELECT world FROM campaign_unlocks WHERE generation=?', (generation,))}
    discovered = {r[0] for r in c.execute('SELECT world FROM campaign_discoveries WHERE generation=?', (generation,))}
    return {'count': counts(c, generation), 'validation': validation, 'game_generation':world.generation(c), 'chapters': [
        {'id': key, **{attr: world_maps.WORLDS[key][attr] for attr in ('title', 'icon')},
         'unlocked': validation or key in unlocked, 'discovered': key in discovered,
         'required': targets[i-1] if i else 0, 'discovery': DISCOVERIES[i]}
        for i, key in enumerate(CHAPTERS)]}


def advance(c):
    current = progress(c)
    generation, _ = state(c)
    chapters = current['chapters']
    for i, chapter in enumerate(chapters[1:], 1):
        previous = chapters[i-1]
        if not (previous['unlocked'] and previous['discovered'] and current['count'] >= chapter['required']):
            continue
        c.execute('INSERT OR IGNORE INTO campaign_unlocks VALUES(?,?)', (generation, chapter['id']))
        chapter['unlocked'] = True


def discover(c, key):
    generation, _ = state(c)
    if c.execute('INSERT OR IGNORE INTO campaign_discoveries VALUES(?,?)', (generation, key)).rowcount:
        advance(c)


def unlocked(c, key):
    return key == 'forest' or c.execute('''SELECT 1 FROM campaign_unlocks u JOIN campaign_state s
           ON u.generation=s.generation WHERE u.world=?''', (key,)).fetchone() is not None


def require_world(c, key, validation):
    if not validation and not unlocked(c, key):
        raise Locked('Este capítulo abre com descobertas e conquistas aprovadas pelo responsável.')


def forest_discovery(c):
    position = forest.read_json_setting(c, 'forest_position')
    if not isinstance(position,dict) or any(type(position.get(axis)) not in (int,float) for axis in ('x','z')):
        return
    # The interaction point in assets/forest/recanto.mjs, in full-map coordinates.
    if math.hypot(position['x']-(forest.OFFSET-6.59), position['z']-2.39) < 1.8:
        discover(c, 'forest')


def normalize(text):
    return ''.join(ch for ch in unicodedata.normalize('NFKD', str(text).lower()) if not unicodedata.combining(ch))


def eligible_event(c, event, date=None):
    if event['icon'] in CARE_ICONS:
        return False
    texts = [event['title'], event['notes'], event['mission']]
    query = 'SELECT date,template_id FROM event_missions WHERE event_id=?'
    for row in c.execute(query, (event['id'],)):
        if date is not None and row['date'] not in ('', date):
            continue
        template = missions.template(c, row['template_id'])
        texts += [row['template_id'], template['name']]
        texts.extend(f"{s['title']} {s['instruction']}" for s in template['steps'])
    if date is not None:
        row = c.execute('''SELECT r.snapshot FROM mission_runs r JOIN mission_event_keys k
                           ON k.identity=r.event_key WHERE k.event_id=? AND r.date=?''',
                        (event['id'], date)).fetchone()
        if row:
            texts.append(row['snapshot'])
    return not ESSENTIAL.search(normalize(' '.join(texts)))


def event_options(c):
    return [{'id': e['id'], 'title': e['title'], 'icon': e['icon'],
             'allowed': eligible_event(c, e), 'category': e['category']}
            for e in c.execute('''SELECT e.*,a.category FROM events e
              LEFT JOIN mission_event_keys k ON k.event_id=e.id
              LEFT JOIN campaign_eligible a ON a.event_key=k.identity ORDER BY e.time,e.id''')]


def configure(c, body):
    targets, choices = body.get('targets'), body.get('eligible')
    if (not isinstance(targets, list) or len(targets)!=3 or
            any(type(n) is not int or not 1<=n<=999 for n in targets) or targets!=sorted(targets)):
        raise ValueError('Informe três metas cumulativas em ordem crescente, de 1 a 999.')
    if not isinstance(choices, dict):
        raise ValueError('Escolha as atividades elegíveis.')
    options = {str(e['id']): e for e in event_options(c)}
    for event_id, category in choices.items():
        if category not in CATEGORIES or event_id not in options or not options[event_id]['allowed']:
            raise ValueError('Escolha apenas atividades opcionais e uma categoria válida.')
    c.execute('UPDATE campaign_state SET targets=? WHERE id=1', (json.dumps(targets),))
    c.execute('DELETE FROM campaign_eligible')
    c.executemany('INSERT INTO campaign_eligible VALUES(?,?)',
                  [(missions.ensure_event_key(c, int(key)), value) for key, value in choices.items()])
    advance(c)


def reset(c):
    c.execute('UPDATE campaign_state SET generation=generation+1 WHERE id=1')
    generation, _ = state(c)
    c.execute("INSERT INTO campaign_unlocks VALUES(?,'forest')", (generation,))
    world_maps.save(c, 'selected_world', 'forest')


def approval_history(c):
    return [dict(row) for row in c.execute('''SELECT event_id,date,title,icon,category,approved_at,generation
                FROM campaign_approvals ORDER BY approved_at DESC,event_id DESC''')]


def approval_info(c, event, date):
    key = c.execute('SELECT identity FROM mission_event_keys WHERE event_id=?', (event['id'],)).fetchone()
    if not key:
        return None, None
    approved = c.execute('SELECT approved_at FROM campaign_approvals WHERE event_key=? AND date=?',
                         (key['identity'], date)).fetchone()
    policy = c.execute('SELECT category FROM campaign_eligible WHERE event_key=?', (key['identity'],)).fetchone()
    return approved['approved_at'] if approved else None, policy['category'] if policy else None


def approve(c, event, date, instant):
    approved, category = approval_info(c, event, date)
    if approved:
        return False
    if not category or not eligible_event(c, event, date):
        raise ValueError('Esta atividade não está elegível para a campanha.')
    generation, _ = state(c)
    key = missions.ensure_event_key(c, event['id'])
    c.execute('INSERT INTO campaign_approvals VALUES(?,?,?,?,?,?,?,?)',
              (key, date, generation, event['id'], event['title'], event['icon'], category, instant.isoformat()))
    c.execute('INSERT OR IGNORE INTO completions VALUES(?,?,?)', (event['id'], date, instant.isoformat()))
    advance(c)
    return True
