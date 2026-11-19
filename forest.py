"""Forest slice adapter. Reuses the V0.6 inventory and position, no schema migration."""
import json
from pathlib import Path
import world
from forest_navigation import COLLISION, MAP as FOREST, safe_position, walkable as map_walkable
NAVIGATION_PATH=Path(__file__).parent/'assets/forest/navigation.json'
TERRAIN=json.loads(NAVIGATION_PATH.read_text()) if NAVIGATION_PATH.exists() else None
SPAWN=(0,7.5)
def walkable(x,z,inventory):
 return type(x) in (int,float) and x < FOREST['seam'] and map_walkable(x,z,inventory)

def scene(c):
 economy=world.scene(c);a=economy['avatar'];x=(a['x']-530)/12;z=(a['y']-370)/12
 if not walkable(x,z,economy['inventory']):x,z=SPAWN
 return {'economy':economy,'position':{'x':x,'z':z},'terrain':TERRAIN}

def move(c,body):
 x,z=body.get('x'),body.get('z')
 if type(x) not in (int,float) or type(z) not in (int,float):raise ValueError('Posição inválida.')
 inventory=world.scene(c)['inventory']
 if not walkable(x,z,inventory):raise ValueError('Essa posição não tem chão seguro.')
 return world.move(c,{'x':530+x*12,'y':370+z*12})


TRAIL = json.loads(NAVIGATION_PATH.with_name('trail-layout.json').read_text())
OFFSET = FOREST['trailOffset']
FULL_TRAIL = {
    'bounds': [FOREST['seam'] - OFFSET, FOREST['bounds'][1] - OFFSET, *FOREST['bounds'][2:]],
    'clearings': TRAIL['clearings'] + FOREST['clearings'],
    'paths': TRAIL['paths'] + FOREST['paths'] + [
        {'width': FOREST['connection']['width'],
         'points': [[x - OFFSET, z] for x, z in FOREST['connection']['points']]}
    ],
}


def trail_walkable(x, z):
    return (type(x) in (int, float) and FOREST['seam']-OFFSET <= x <= FOREST['bounds'][1]-OFFSET
            and map_walkable(x+OFFSET, z, ()))


def read_json_setting(c, key):
    row = c.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    try:
        return json.loads(row[0]) if row else None
    except (TypeError, ValueError):
        return None


def trail_scene(c):
    previous = read_json_setting(c, 'trail_position')
    position = TRAIL['spawn']
    if isinstance(previous, dict) and type(previous.get('x')) in (int, float):
        projected = {'x': previous['x']+OFFSET, 'z': previous.get('z')}
        safe = safe_position(projected, lambda x,z: trail_walkable(x-OFFSET,z),
                             {'x': OFFSET+position['x'], 'z': position['z']})
        position = {'x': safe['x']-OFFSET, 'z': safe['z']}
    leaf = c.execute("SELECT value FROM settings WHERE key='trail_shelter_leaf'").fetchone()
    return {'economy': world.scene(c), 'layout': TRAIL, 'position': position,
            'leaf_up': bool(leaf and leaf[0] == 'up')}


def shelter_leaf(c, body):
    leaf_up = body.get('leaf_up')
    if type(leaf_up) is not bool:
        raise ValueError('Escolha uma posição para a folha.')
    c.execute("INSERT INTO settings(key,value) VALUES('trail_shelter_leaf',?) "
              "ON CONFLICT(key) DO UPDATE SET value=excluded.value", ('up' if leaf_up else 'down',))
    return {'leaf_up': leaf_up}


def trail_move(c, body):
    x, z = body.get('x'), body.get('z')
    if not trail_walkable(x, z):
        raise ValueError('Essa posição não tem chão seguro.')
    position = json.dumps({'x': x, 'z': z})
    c.execute("INSERT INTO settings(key,value) VALUES('trail_position',?) "
              "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (position,))
    return {'ok': True}


def map_scene(c, resume_trail=False):
    result = scene(c)
    inventory = result['economy']['inventory']
    candidate = read_json_setting(c, 'forest_position')
    if candidate is not None:
        result['position'] = safe_position(candidate, lambda x,z: map_walkable(x,z,inventory), result['position'])
    elif resume_trail:
        previously = trail_scene(c)['position']
        result['position'] = {'x': previously['x']+OFFSET, 'z': previously['z']}
    leaf = c.execute("SELECT value FROM settings WHERE key='trail_shelter_leaf'").fetchone()
    return {**result, 'map': FOREST, 'layout': FULL_TRAIL, 'collision': COLLISION,
            'leaf_up': bool(leaf and leaf[0] == 'up')}


def map_move(c, body):
    x, z = body.get('x'), body.get('z')
    inventory = world.scene(c)['inventory']
    if not map_walkable(x, z, inventory):
        raise ValueError('Essa posição não tem chão seguro.')
    c.execute("INSERT INTO settings(key,value) VALUES('forest_position',?) "
              "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (json.dumps({'x':x,'z':z}),))
    return {'ok': True}
