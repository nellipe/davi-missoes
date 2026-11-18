"""Forest slice adapter. Reuses the V0.6 inventory and position, no schema migration."""
import math
import world
SPAWN=(0,7.5)
OBSTACLES=[(6,-7,2.2),(-10,10,1.1),(-10,3,1),(13,8,1.1),(12,1,1.1),(-8,-3,1),(-11,-8,1.3),(10,-7,1.2),(-4,-12,1.2),(4,-13,1.2),(11,-13,1.3),(-13,-13,1.1),(6,5,1),(-6,-5,1.1),(7,4,.8),(-8,-8,1.4)]
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
 return {'economy':economy,'position':{'x':x,'z':z},'obstacles':OBSTACLES}

def move(c,body):
 x,z=body.get('x'),body.get('z')
 if type(x) not in (int,float) or type(z) not in (int,float):raise ValueError('Posição inválida.')
 inventory=world.scene(c)['inventory']
 if not walkable(x,z,inventory):raise ValueError('Siga o caminho da floresta. A ponte abre a outra margem.')
 return world.move(c,{'x':530+x*12,'y':370+z*12})
