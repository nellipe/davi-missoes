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
