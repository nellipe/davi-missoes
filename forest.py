"""Forest slice adapter. Reuses the V0.6 inventory and position, no schema migration."""
import math
import json
from pathlib import Path
import world
NAVIGATION_PATH=Path(__file__).parent/'assets/forest/navigation.json'
TERRAIN=json.loads(NAVIGATION_PATH.read_text()) if NAVIGATION_PATH.exists() else None
SPAWN=(0,7.5)
# Coordinates use the exported GLB axes. Both input and saved positions use this manifest.
_groups = json.loads(NAVIGATION_PATH.with_name('obstacles.json').read_text())
OBSTACLES = [disk for group in _groups.values() for disk in group]
def walkable(x,z,inventory):
 if abs(x+9)<1.35 and -6.5<z<-.3:return False
 if not math.isfinite(x+z) or (x/17)**2+(z/11.5)**2>1:return False
 if any(math.hypot(x-a,z-b)<r+.23 for a,b,r in OBSTACLES):return False
 river=-2-1.1*math.sin(x*.2)
 if 'bridge' not in inventory and z<river+2.7:return False
 if abs(z-river)<2.7 and not ('bridge' in inventory and abs(x)<1.03 and -5.7<z<1.5):return False
 return True

def scene(c):
 economy=world.scene(c);a=economy['avatar'];x=(a['x']-530)/12;z=(a['y']-370)/12
 if not walkable(x,z,economy['inventory']):x,z=SPAWN
 return {'economy':economy,'position':{'x':x,'z':z},'obstacles':OBSTACLES,'terrain':TERRAIN}

def move(c,body):
 x,z=body.get('x'),body.get('z')
 if type(x) not in (int,float) or type(z) not in (int,float):raise ValueError('Posição inválida.')
 inventory=world.scene(c)['inventory']
 if not walkable(x,z,inventory):raise ValueError('Siga o caminho da floresta. A ponte abre a outra margem.')
 return world.move(c,{'x':530+x*12,'y':370+z*12})


TRAIL = json.loads(NAVIGATION_PATH.with_name('trail-layout.json').read_text())
FOREST = json.loads(NAVIGATION_PATH.with_name('forest-layout.json').read_text())
OFFSET = FOREST['trailOffset']
FULL_TRAIL = {
    'bounds': [FOREST['seam'] - OFFSET, FOREST['bounds'][1] - OFFSET, *FOREST['bounds'][2:]],
    'blocked': TRAIL['blocked'] + [[-6.6, -1.7, -14.5, -13.38]],
    'clearings': TRAIL['clearings'] + FOREST['clearings'],
    'paths': TRAIL['paths'] + FOREST['paths'] + [
        {'width': FOREST['connection']['width'],
         'points': [[x - OFFSET, z] for x, z in FOREST['connection']['points']]}
    ],
}


def _on_paths(x, z, paths):
    for path in paths:
        points = path['points']
        for (a, b), (c, d) in zip(points, points[1:]):
            dx, dz = c-a, d-b
            t = max(0, min(1, ((x-a)*dx+(z-b)*dz)/(dx*dx+dz*dz)))
            if math.hypot(x-a-t*dx, z-b-t*dz) <= path['width']:
                return True
    return False


def trail_walkable(x, z, layout=TRAIL):
    if type(x) not in (int, float) or type(z) not in (int, float):
        return False
    xmin, xmax, zmin, zmax = layout['bounds']
    if not (xmin <= x <= xmax and zmin <= z <= zmax):
        return False
    if any(a < x < b and c < z < d for a, b, c, d in layout['blocked']):
        return False
    if any(math.hypot(x-a, z-b) <= r for a, b, r in layout['clearings']):
        return True
    return _on_paths(x, z, layout['paths'])


def trail_scene(c):
    row = c.execute("SELECT value FROM settings WHERE key='trail_position'").fetchone()
    position = json.loads(row[0]) if row else TRAIL['spawn']
    if not trail_walkable(position['x'], position['z']):
        position = TRAIL['spawn']
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
        raise ValueError('O chão firme acompanha a trilha.')
    position = json.dumps({'x': x, 'z': z})
    c.execute("INSERT INTO settings(key,value) VALUES('trail_position',?) "
              "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (position,))
    return {'ok': True}


def map_walkable(x, z, inventory):
    if type(x) not in (int, float) or type(z) not in (int, float):
        return False
    xmin, xmax, zmin, zmax = FOREST['bounds']
    if not (xmin <= x <= xmax and zmin <= z <= zmax):
        return False
    if x >= FOREST['seam']:
        return trail_walkable(x-OFFSET, z, FULL_TRAIL)
    if walkable(x, z, inventory):
        return True
    return (_on_paths(x, z, [FOREST['connection']])
            and not any(math.hypot(x-a, z-b) < r+.23 for a, b, r in OBSTACLES))


def map_scene(c, resume_trail=False):
    result = scene(c)
    inventory = result['economy']['inventory']
    row = c.execute("SELECT value FROM settings WHERE key='forest_position'").fetchone()
    if row:
        try:
            candidate = json.loads(row[0])
            if map_walkable(candidate.get('x'), candidate.get('z'), inventory):
                result['position'] = candidate
        except (AttributeError, ValueError, OverflowError):
            pass
    elif resume_trail:
        previously = trail_scene(c)['position']
        result['position'] = {'x': previously['x']+OFFSET, 'z': previously['z']}
    leaf = c.execute("SELECT value FROM settings WHERE key='trail_shelter_leaf'").fetchone()
    return {**result, 'map': FOREST, 'layout': FULL_TRAIL, 'leaf_up': bool(leaf and leaf[0] == 'up')}


def map_move(c, body):
    x, z = body.get('x'), body.get('z')
    inventory = world.scene(c)['inventory']
    if not map_walkable(x, z, inventory):
        raise ValueError('Siga pelo chão firme da floresta.')
    if walkable(x, z, inventory) and world.walkable(530+x*12, 370+z*12, inventory):
        world.move(c, {'x': 530+x*12, 'y': 370+z*12})
    c.execute("INSERT INTO settings(key,value) VALUES('forest_position',?) "
              "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (json.dumps({'x':x,'z':z}),))
    return {'ok': True}
