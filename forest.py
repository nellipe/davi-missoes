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

def scene(c, preview=None):
 economy=world.scene(c);a=economy['avatar'];x=(a['x']-530)/12;z=(a['y']-370)/12
 if preview and (position:=read_json_setting(c,'legacy_forest_position',preview)):
  x,z=position['x'],position['z']
 if not walkable(x,z,economy['inventory']):x,z=SPAWN
 return {'economy':economy,'position':{'x':x,'z':z},'terrain':TERRAIN}

def move(c,body,preview=None):
 x,z=body.get('x'),body.get('z')
 if type(x) not in (int,float) or type(z) not in (int,float):raise ValueError('Posição inválida.')
 inventory=world.scene(c)['inventory']
 if not walkable(x,z,inventory):raise ValueError('Essa posição não tem chão seguro.')
 if preview:
  write_setting(c,'legacy_forest_position',json.dumps({'x':x,'z':z}),preview)
  return {'ok':True}
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


def read_setting(c, key, preview=None):
    row = None
    if preview:
        row = c.execute('SELECT value FROM adventure_preview WHERE token=? AND key=?', (preview,key)).fetchone()
    if row is None:
        row = c.execute('SELECT value FROM settings WHERE key=?', (key,)).fetchone()
    return row[0] if row else None


def write_setting(c, key, value, preview=None):
    if preview:
        c.execute('INSERT INTO adventure_preview VALUES(?,?,?) ON CONFLICT(token,key) DO UPDATE SET value=excluded.value',
                  (preview,key,value))
    else:
        c.execute('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', (key,value))


def read_json_setting(c, key, preview=None):
    value = read_setting(c,key,preview)
    try:
        return json.loads(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def trail_scene(c, preview=None):
    previous = read_json_setting(c, 'trail_position',preview)
    position = TRAIL['spawn']
    if isinstance(previous, dict) and type(previous.get('x')) in (int, float):
        projected = {'x': previous['x']+OFFSET, 'z': previous.get('z')}
        safe = safe_position(projected, lambda x,z: trail_walkable(x-OFFSET,z),
                             {'x': OFFSET+position['x'], 'z': position['z']})
        position = {'x': safe['x']-OFFSET, 'z': safe['z']}
    return {'economy': world.scene(c), 'layout': TRAIL, 'position': position,
            'leaf_up': read_setting(c,'trail_shelter_leaf',preview)=='up'}


def shelter_leaf(c, body, preview=None):
    leaf_up = body.get('leaf_up')
    if type(leaf_up) is not bool:
        raise ValueError('Escolha uma posição para a folha.')
    write_setting(c,'trail_shelter_leaf','up' if leaf_up else 'down',preview)
    return {'leaf_up': leaf_up}


def trail_move(c, body, preview=None):
    x, z = body.get('x'), body.get('z')
    if not trail_walkable(x, z):
        raise ValueError('Essa posição não tem chão seguro.')
    position = json.dumps({'x': x, 'z': z})
    write_setting(c,'trail_position',position,preview)
    return {'ok': True}


def map_scene(c, resume_trail=False, preview=None):
    economy = world.scene(c)
    inventory = economy['inventory']
    spawn = {'x': SPAWN[0], 'z': SPAWN[1]}
    position = spawn
    candidate = read_json_setting(c, 'forest_position',preview)
    if candidate is not None:
        position = safe_position(candidate, lambda x,z: map_walkable(x,z,inventory), spawn)
    elif resume_trail:
        previously = trail_scene(c,preview)['position']
        position = {'x': previously['x']+OFFSET, 'z': previously['z']}
    return {'economy': economy, 'position': position, 'spawn': spawn, 'terrain': TERRAIN,
            'map': FOREST, 'layout': FULL_TRAIL, 'collision': COLLISION,
            'leaf_up': read_setting(c,'trail_shelter_leaf',preview)=='up'}


def map_move(c, body, preview=None):
    x, z = body.get('x'), body.get('z')
    inventory = world.scene(c)['inventory']
    if not map_walkable(x, z, inventory):
        raise ValueError('Essa posição não tem chão seguro.')
    write_setting(c,'forest_position',json.dumps({'x':x,'z':z}),preview)
    return {'ok': True}
