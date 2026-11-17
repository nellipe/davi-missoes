"""Domínio de roteiros e execução real por ocorrência; sem economia ou estado visual.

Snapshots imutáveis separam a edição de templates do progresso já iniciado.
IDs de etapas e revisão também servirão a futuros modos de prática, sem escrever
em step_progress nem em completions a partir de resultados de jogos.
"""
import json
from pathlib import Path
import re
import secrets

SCHEMA = (
    '''CREATE TABLE IF NOT EXISTS mission_schema(version INTEGER PRIMARY KEY)''',
    '''CREATE TABLE IF NOT EXISTS mission_templates(
        id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1, archived INTEGER NOT NULL DEFAULT 0)''',
    '''CREATE TABLE IF NOT EXISTS mission_steps(
        id TEXT NOT NULL, template_id TEXT NOT NULL REFERENCES mission_templates(id),
        position INTEGER NOT NULL, phase TEXT NOT NULL, icon TEXT NOT NULL,
        title TEXT NOT NULL, instruction TEXT NOT NULL, hint TEXT NOT NULL,
        PRIMARY KEY(template_id,id))''',
    '''CREATE TABLE IF NOT EXISTS event_missions(
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        date TEXT NOT NULL DEFAULT '', template_id TEXT REFERENCES mission_templates(id),
        PRIMARY KEY(event_id,date))''',
    '''CREATE TABLE IF NOT EXISTS mission_event_keys(
        event_id INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
        identity TEXT NOT NULL UNIQUE)''',
    # Sem FK para events: exclusão/edição da série não apaga execução histórica.
    '''CREATE TABLE IF NOT EXISTS mission_runs(
        id TEXT PRIMARY KEY, event_id INTEGER NOT NULL, event_key TEXT NOT NULL, date TEXT NOT NULL,
        snapshot TEXT NOT NULL, created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_key,date))''',
    '''CREATE TABLE IF NOT EXISTS step_progress(
        run_id TEXT NOT NULL REFERENCES mission_runs(id), step_id TEXT NOT NULL,
        done INTEGER NOT NULL, updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(run_id,step_id))''',
    '''CREATE TABLE IF NOT EXISTS mission_history(
        id INTEGER PRIMARY KEY, run_id TEXT NOT NULL REFERENCES mission_runs(id),
        step_id TEXT NOT NULL, done INTEGER NOT NULL, actor TEXT NOT NULL,
        created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)''',
)


class Conflict(ValueError):
    pass


def needs_migration(connection):
    exists = connection.execute("SELECT 1 FROM sqlite_master WHERE name='mission_schema'").fetchone()
    return not exists or not connection.execute('SELECT 1 FROM mission_schema WHERE version=1').fetchone()


def initialize(connection):
    """Executada dentro da transação de inicialização; seed uma única vez."""
    if not needs_migration(connection):
        return
    for statement in SCHEMA:
        connection.execute(statement)
    for row in connection.execute('SELECT id FROM events').fetchall():
        ensure_event_key(connection,row['id'])
    catalog = json.loads(Path(__file__).with_name('mission_catalog.json').read_text(encoding='utf-8'))
    for item in catalog:
        save_template(connection, item)
    connection.execute('INSERT INTO mission_schema VALUES(1)')


def text(value, label, limit, required=True):
    if not isinstance(value, str) or len(value.strip()) > limit or (required and not value.strip()):
        raise ValueError(f'{label} inválido (até {limit} caracteres).')
    return value.strip()


def template(connection, ident):
    row = connection.execute('SELECT * FROM mission_templates WHERE id=?', (ident,)).fetchone()
    if row is None:
        raise ValueError('Roteiro não encontrado.')
    result = dict(row)
    result['steps'] = [dict(s) for s in connection.execute(
        'SELECT id,phase,icon,title,instruction,hint FROM mission_steps WHERE template_id=? ORDER BY position', (ident,))]
    return result


def templates(connection):
    return [dict(r) for r in connection.execute(
        'SELECT t.*,COUNT(s.id) AS step_count FROM mission_templates t LEFT JOIN mission_steps s ON s.template_id=t.id GROUP BY t.id ORDER BY t.name')]


def save_template(connection, body, ident=None):
    if not isinstance(body, dict):
        raise ValueError('Roteiro inválido.')
    current = template(connection, ident) if ident else None
    if current and (type(body.get('revision')) is not int or body['revision'] != current['revision']):
        raise Conflict('Roteiro alterado em outro aparelho. Recarregue antes de editar.')
    ident = ident or body.get('id') or secrets.token_hex(16)
    name = text(body.get('name'), 'Nome', 100)
    icon = text(body.get('icon', '⭐'), 'Ícone', 12)
    steps = body.get('steps')
    if not isinstance(steps, list) or not 1 <= len(steps) <= 40:
        raise ValueError('Informe de 1 a 40 etapas.')
    validated, seen = [], set()
    old_ids = {s['id'] for s in current['steps']} if current else set()
    for index, step in enumerate(steps):
        if not isinstance(step, dict):
            raise ValueError('Etapa inválida.')
        step_id = step.get('id') or secrets.token_hex(16)
        if not isinstance(step_id,str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}',step_id):
            raise ValueError('Identificador de etapa inválido.')
        if step_id in seen or (current and step.get('id') and step_id not in old_ids):
            raise ValueError('Identificador de etapa duplicado ou de outro roteiro.')
        seen.add(step_id)
        phase = step.get('phase', 'main')
        if phase not in ('preparation', 'main', 'return'):
            raise ValueError('Fase inválida.')
        validated.append((step_id, ident, index, phase, text(step.get('icon','⭐'),'Ícone',12),
                          text(step.get('title'),'Título',100), text(step.get('instruction'),'Orientação',600),
                          text(step.get('hint',''),'Dica',400,False)))
    if current:
        connection.execute('UPDATE mission_templates SET name=?,icon=?,revision=revision+1 WHERE id=?', (name, icon, ident))
        connection.execute('DELETE FROM mission_steps WHERE template_id=?', (ident,))
    else:
        connection.execute('INSERT INTO mission_templates(id,name,icon) VALUES(?,?,?)', (ident,name,icon))
    connection.executemany('INSERT INTO mission_steps VALUES(?,?,?,?,?,?,?,?)', validated)
    return template(connection, ident)


def archive(connection, ident, archived, revision):
    current = template(connection, ident)
    if type(archived) is not bool:
        raise ValueError('Estado de arquivamento inválido.')
    if type(revision) is not int or revision != current['revision']:
        raise Conflict('Roteiro alterado. Recarregue a lista.')
    connection.execute('UPDATE mission_templates SET archived=?,revision=revision+1 WHERE id=?', (int(archived),ident))


def assign(connection, event_id, date, template_id):
    if template_id is not None:
        if not isinstance(template_id, str) or template(connection, template_id)['archived']:
            raise ValueError('Escolha um roteiro ativo.')
    ensure_event_key(connection,event_id)
    connection.execute('INSERT INTO event_missions VALUES(?,?,?) ON CONFLICT(event_id,date) DO UPDATE SET template_id=excluded.template_id',
                       (event_id,date,template_id))


def ensure_event_key(connection, event_id):
    # INTEGER PRIMARY KEY legado pode reutilizar IDs após excluir uma atividade.
    # Uma identidade lateral evita aplicar histórico antigo a outro compromisso.
    connection.execute('INSERT OR IGNORE INTO mission_event_keys VALUES(?,?)',(event_id,secrets.token_hex(16)))
    return connection.execute('SELECT identity FROM mission_event_keys WHERE event_id=?',(event_id,)).fetchone()['identity']


def occurrence(connection, event_id, date):
    run = connection.execute('''SELECT r.* FROM mission_runs r JOIN mission_event_keys k ON k.identity=r.event_key
        WHERE k.event_id=? AND r.date=?''', (event_id,date)).fetchone()
    if run:
        result = json.loads(run['snapshot'])
        progress = {r['step_id']: bool(r['done']) for r in connection.execute('SELECT * FROM step_progress WHERE run_id=?', (run['id'],))}
        result.update(run_id=run['id'], started=True)
    else:
        link = connection.execute("SELECT template_id FROM event_missions WHERE event_id=? AND date IN ('',?) ORDER BY date DESC LIMIT 1", (event_id,date)).fetchone()
        if not link or link['template_id'] is None:
            return None
        result = template(connection, link['template_id'])
        # Arquivar impede novos vínculos, mas preserva os já escolhidos pelo responsável.
        result.update(run_id=None, started=False)
        progress = {}
    for step in result['steps']:
        step['done'] = progress.get(step['id'],False)
    result.update(event_id=event_id,date=date,confirmed=sum(progress.values()),total=len(result['steps']))
    return result


def confirm_step(connection, event_id, date, step_id, body, actor):
    current = occurrence(connection,event_id,date)
    if not current or step_id not in {s['id'] for s in current['steps']}:
        raise ValueError('Etapa não encontrada nesta ocorrência.')
    if (body.get('template_id') != current['id'] or type(body.get('revision')) is not int
            or body['revision'] != current['revision']):
        raise Conflict('A sequência mudou. Reabra a missão antes de confirmar.')
    if type(body.get('done')) is not bool:
        raise ValueError('Confirmação deve ser verdadeira ou falsa.')
    run_id = current['run_id']
    if not run_id:
        run_id = secrets.token_hex(16)
        snapshot = {k:current[k] for k in ('id','name','icon','revision','steps')}
        event_key=ensure_event_key(connection,event_id)
        connection.execute('INSERT INTO mission_runs(id,event_id,event_key,date,snapshot) VALUES(?,?,?,?,?)',
                           (run_id,event_id,event_key,date,json.dumps(snapshot,ensure_ascii=False)))
    previous = next(s['done'] for s in current['steps'] if s['id']==step_id)
    connection.execute('INSERT INTO step_progress(run_id,step_id,done) VALUES(?,?,?) ON CONFLICT(run_id,step_id) DO UPDATE SET done=excluded.done,updated=CURRENT_TIMESTAMP',
                       (run_id,step_id,int(body['done'])))
    if previous != body['done']:
        connection.execute('INSERT INTO mission_history(run_id,step_id,done,actor) VALUES(?,?,?,?)',
                           (run_id,step_id,int(body['done']),actor))
    return occurrence(connection,event_id,date)
