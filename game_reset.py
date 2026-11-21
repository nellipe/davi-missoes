"""Start another game without changing the agenda or authentication."""
from itertools import groupby
import json

import campaign
import world

CONFIRMATION = 'RECOMEÇAR'


class Stale(ValueError):
    def __init__(self, generation):
        super().__init__('Uma nova partida foi iniciada. Abra a aventura novamente.')
        self.generation = generation


def initialize(c):
    c.execute('''CREATE TABLE IF NOT EXISTS game_resets(
                 generation INTEGER PRIMARY KEY, reset_at TEXT NOT NULL)''')


def remember_completed_occurrences(c):
    # This receipt prevents a second award even if a parent later corrects the agenda.
    c.execute('''INSERT OR IGNORE INTO world_closed_occurrences(event_id,date)
                 SELECT event_id,date FROM completions''')
    runs=c.execute('''SELECT k.event_id,r.id,r.date,r.snapshot,p.step_id FROM mission_runs r
                      JOIN mission_event_keys k ON k.identity=r.event_key
                      JOIN step_progress p ON p.run_id=r.id AND p.done=1
                      ORDER BY r.id''')
    for _, group in groupby(runs,lambda row:row['id']):
        rows=list(group)
        first=rows[0]
        expected={step['id'] for step in json.loads(first['snapshot'])['steps']}
        if expected and expected.issubset({row['step_id'] for row in rows}):
            c.execute('INSERT OR IGNORE INTO world_closed_occurrences VALUES(?,?)',(first['event_id'],first['date']))


def restart(c, body, instant):
    if body.get('confirmation')!=CONFIRMATION or type(body.get('generation')) is not int:
        raise ValueError('Digite RECOMEÇAR para confirmar.')
    current=world.generation(c)
    if body['generation']!=current:
        raise Stale(current)

    remember_completed_occurrences(c)
    c.execute('DELETE FROM world_inventory')
    c.execute("UPDATE world_state SET x=530,y=460,color='mint',hat=NULL,cape=NULL,buddy=NULL WHERE id=1")
    c.execute('DELETE FROM practice_sessions')
    c.execute("""DELETE FROM settings WHERE key IN
                 ('forest_position','trail_position','legacy_forest_position','trail_shelter_leaf')
                 OR key GLOB 'world_position_*' OR key GLOB 'world_activity_*' OR key GLOB 'world_challenge_*'""")
    campaign.reset(c)
    c.execute('DELETE FROM screen_days')
    c.execute('DELETE FROM screen_session')
    c.execute('INSERT INTO screen_session(id) VALUES(1)')
    c.execute('DELETE FROM adventure_validation')
    c.execute('UPDATE game_state SET generation=generation+1 WHERE id=1')
    c.execute('INSERT INTO game_resets VALUES(?,?)',(current+1,instant.isoformat()))
    return {'game_generation':current+1}
