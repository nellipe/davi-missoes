"""Original art pipeline. Blender 4.5 LTS. Deterministic sculpted profiles, UV PBR, painted vertices and rigged NLA clips. No downloaded art."""
import bpy, math, random, json
import numpy as np
from pathlib import Path
from mathutils import Vector
from math import sin, cos, pi, exp
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/forest';OUT.mkdir(parents=True,exist_ok=True)
random.seed(1607)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
M={};REPORT={};TEXTURES={}
def color(h):
 h=h.lstrip('#');v=[int(h[i:i+2],16)/255 for i in (0,2,4)]
 return tuple(((x+.055)/1.055)**2.4 if x>.04045 else x/12.92 for x in v)+(1,)
def texture(kind,size=128):
 if kind in TEXTURES:return TEXTURES[kind]
 yy,xx=np.mgrid[0:size,0:size].astype(float)/size;rng=np.random.default_rng(16)
 if kind in ('bark','wood'):
  noise=.039*np.sin(xx*90+np.sin(yy*11)*2)+.012*np.sin(xx*240+yy*11)
  for cx,cy in [(.3,.4),(.7,.8)]:noise+=.08*np.cos(np.sqrt(((xx-cx)*1.8)**2+((yy-cy)*.7)**2)*75)*np.exp(-(((xx-cx)*3)**2+((yy-cy)*2)**2))
  base=np.stack([.92+noise,.84+noise*.7,.69+noise*.4],axis=-1);height=noise
 elif kind=='stone':
  noise=.06*np.sin(xx*19+yy)*np.cos(yy*23)+rng.random((size,size))*.025;lichen=np.maximum(0,np.sin(xx*40+np.cos(yy*19))*np.sin(yy*31)-.55)*.18
  base=np.stack([.52+noise+lichen,.57+noise+lichen,.49+noise-lichen*.5],axis=-1);height=noise*.5
 else:
  weave=np.sin(xx*600)*np.sin(yy*600)*.015;base=np.stack([.91+weave,.91+weave,.85+weave],axis=-1);height=weave*.05
 alpha=np.ones((size,size,1));image=bpy.data.images.new(kind+' pigment',width=size,height=size,alpha=True);image.pixels=np.concatenate([np.clip(base,0,1),alpha],axis=-1).astype(np.float32).ravel()
 gy,gx=np.gradient(height);normal=np.stack([-gx*4,-gy*4,np.ones_like(xx)],axis=-1);normal/=np.linalg.norm(normal,axis=-1)[...,None];normal=normal*.5+.5
 norm=bpy.data.images.new(kind+' tangent normal',width=size,height=size,alpha=True);norm.colorspace_settings.name='Non-Color';norm.pixels=np.concatenate([normal,alpha],axis=-1).astype(np.float32).ravel();norm.filepath_raw=str(OUT/(kind+'-normal.png'));norm.file_format='PNG';norm.save();norm.pack();TEXTURES[kind]=(image,norm);return image,norm
def material(name,h,kind=None,rough=.8,metal=0,emission=0,vertex=False):
 m=bpy.data.materials.new(name);m.diffuse_color=color(h);m.use_nodes=True;n=m.node_tree.nodes;links=m.node_tree.links;p=n.get('Principled BSDF');p.inputs['Base Color'].default_value=color(h);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 if emission:p.inputs['Emission Color'].default_value=color(h);p.inputs['Emission Strength'].default_value=emission
 if kind:
  image,norm=texture(kind);tinted=bpy.data.images.new(name+' albedo',width=image.size[0],height=image.size[1],alpha=True);pixels=np.array(image.pixels[:],dtype=np.float32).reshape(-1,4);pixels[:,:3]*=np.array([int(h.lstrip('#')[i:i+2],16)/255 for i in (0,2,4)]);tinted.pixels=pixels.ravel();tinted.filepath_raw=str(OUT/(name.replace(' ','-').lower()+'.png'));tinted.file_format='PNG';tinted.save();tinted.pack();tex=n.new('ShaderNodeTexImage');tex.image=tinted;links.new(tex.outputs['Color'],p.inputs['Base Color']);normaltex=n.new('ShaderNodeTexImage');normaltex.image=norm;nm=n.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.45;links.new(normaltex.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],p.inputs['Normal'])
 if vertex:
  attr=n.new('ShaderNodeVertexColor');attr.layer_name='Pigment';links.new(attr.outputs['Color'],p.inputs['Base Color'])
 M[name]=m
for args in [('Bark','#b99b74','bark'),('Warm timber','#dfaf7e','wood'),('Dark timber','#a38a67','wood'),('Rock','#aebabb','stone'),('Roof moss','#a6b5a2','stone'),('Roof ochre','#be797b','wood'),('Fabric','#e7ede4','cloth'),('Leaf','#72a847',None),('Fern','#4d8f45',None),('Ground','#53814a',None),('Path','#c5a46a',None),('Skin','#f3bc8c',None),('Hair','#4b3028',None),('Hair light','#835138',None),('Teal','#168f9a','cloth'),('Teal light','#65c5bd',None),('Shorts','#666581','cloth'),('Boot','#b3713e',None),('Sole','#4d4436',None),('Gold','#eabe62',None),('Cream','#f9e9bb',None),('White','#fff9e2',None),('Eye','#183c3c',None),('Iris','#28a2a2',None),('Cheek','#e89380',None),('Clay','#c66547',None),('Mushroom','#c46c4a',None),('Lilac','#b0a1d3',None),('Moss','#70924a',None)]:material(*args,vertex=args[0] in ('Leaf','Ground','Path','Moss','Rock'))
material('Birch','#e8d9ac');material('Bark dark','#68594b');material('Leaf blue','#387e6a',vertex=True);material('Rope','#e1c68b');
material('Window light','#ffd990',rough=.35,emission=.5);material('Pipo ceramic','#f0e7ca',rough=.39);material('Copper','#c08b59',rough=.4,metal=.3);material('Pipo screen','#123a3d',rough=.25,metal=.2);material('Pipo eye','#b5ffe4',rough=.32,emission=.45)
material('Tunica','#ecebe7','cloth');material('Manga','#c3efdf');material('Hat felt','#daaa59');material('Hat ribbon','#6b443b')
material('Cape lining','#7756ae');material('Scarf','#e77a4d');material('Pipo boot','#cd8851')
def mesh(name,verts,faces,mat,uv=None,pigment=None):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);me.materials.append(M[mat])
 for p in me.polygons:p.use_smooth=True
 if uv is None:
  coords=np.array(verts);mins=coords.min(0);sizes=np.maximum(coords.max(0)-mins,.001);uv=[((v[0]-mins[0])/sizes[0],(v[2]-mins[2])/sizes[2]) for v in verts]
 layer=me.uv_layers.new(name='UVMap')
 for p in me.polygons:
  for li in p.loop_indices:layer.data[li].uv=uv[me.loops[li].vertex_index]
 if pigment:
  attr=me.color_attributes.new(name='Pigment',type='FLOAT_COLOR',domain='POINT')
  for i,v in enumerate(verts):attr.data[i].color=pigment(v,i)
 return ob
def empty(name,loc=(0,0,0),parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=parent;return o
def bind(ob,bone):
 vg=ob.vertex_groups.new(name=bone);vg.add(list(range(len(ob.data.vertices))),1,'REPLACE');return ob
def loft(name,rings,mat,segments=16,parent=None,bone=None):
 verts=[];uv=[]
 for j,(x,y,z,rx,ry,*twist) in enumerate(rings):
  for i in range(segments+1):
   a=i/segments*2*pi+(twist[0] if twist else 0);wave=1+.025*sin(a*3+j*.8);verts.append((x+rx*cos(a)*wave,y+ry*sin(a)*wave,z));uv.append((i/segments,j/max(1,len(rings)-1)))
 faces=[]
 for j in range(len(rings)-1):
  for i in range(segments):a=j*(segments+1)+i;faces.append((a,a+1,a+segments+2,a+segments+1))
 faces+=[tuple(range(segments-1,-1,-1)),tuple((len(rings)-1)*(segments+1)+i for i in range(segments))];o=mesh(name,verts,faces,mat,uv);o.parent=parent
 if bone:bind(o,bone)
 return o
def ellipsoid(name,loc,scale,mat,parent=None,bone=None,segments=18,rings=12):
 x,y,z=loc;sx,sy,sz=scale;profile=[]
 for j in range(rings+1):
  a=-pi/2+j*pi/rings;profile.append((x,y,z+sin(a)*sz,max(.001,cos(a)*sx),max(.001,cos(a)*sy)))
 return loft(name,profile,mat,segments,parent,bone)
def tube(name,points,radii,mat,parent=None,bone=None,segments=10):
 verts=[];uv=[]
 for j,p in enumerate(points):
  p=Vector(p);direction=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)]);direction.normalize();side=direction.cross(Vector((0,0,1)))
  if side.length<.01:side=Vector((1,0,0))
  side.normalize();up=direction.cross(side).normalized()
  for i in range(segments+1):
   a=i/segments*2*pi;v=p+(side*cos(a)+up*sin(a))*radii[j]*(1+.08*sin(a*5+j*.5));verts.append(tuple(v));uv.append((i/segments,j/max(1,len(points)-1)*2))
 faces=[]
 for j in range(len(points)-1):
  for i in range(segments):a=j*(segments+1)+i;faces.append((a,a+1,a+segments+2,a+segments+1))
 o=mesh(name,verts,faces,mat,uv);o.parent=parent
 if bone:bind(o,bone)
 return o
def curve(name,points,radius,mat,parent=None,bone=None):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=3;cu.bevel_depth=radius;cu.bevel_resolution=1;sp=cu.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
 for p,co in zip(sp.bezier_points,points):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
 ob=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(ob);ob.parent=parent;cu.materials.append(M[mat]);bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.convert(target='MESH');ob.select_set(False)
 if bone:bind(ob,bone)
 return ob
def plank(name,loc,size,mat,parent=None,angle=0,bevel=.04):
 sx,sy,sz=size;verts=[(a*sx/2,b*sy/2,c*sz/2) for c in (-1,1) for b in (-1,1) for a in (-1,1)];ob=mesh(name,verts,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)],mat);ob.location=loc;ob.rotation_euler.z=angle;ob.parent=parent;mod=ob.modifiers.new('Crafted softened edges','BEVEL');mod.width=bevel;mod.segments=2;bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.modifier_apply(modifier=mod.name);ob.select_set(False);return ob
def join(objs,name):
 objs=[o for o in objs if o.type=='MESH']
 if not objs:return None
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs:o.select_set(True)
 bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();ob=objs[0];ob.name=name;ob.select_set(False);return ob
def children(root):return [root]+list(root.children_recursive)
def export(root,filename,animations=False):
 bpy.ops.object.select_all(action='DESELECT')
 for ob in children(root):ob.select_set(True)
 path=OUT/filename;bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_tangents=True,export_yup=True,export_extras=True,export_animations=animations,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_optimize_animation_size=True)
 tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in children(root) if o.type=='MESH');REPORT[filename]={'bytes':path.stat().st_size,'triangles_before_instancing':tris,'objects':len(children(root))}
 for ob in children(root):ob.hide_set(True);ob.hide_render=True
 print('EXPORTED',filename,REPORT[filename],flush=True)
def height(x,y):return .14*sin(x*.28)+.13*cos(y*.31)+.07*sin(x*.5+y*.3)+2.1*exp(-((x+9)/3.2)**2-((y-6)/4)**2)
def river(x):return 2+1.1*sin(x*.2)
def path_x(y):return .8*sin(y*.45)
# Hand-composed forest clearing and sculpted creek banks.
env=empty('Floresta_Encantada');verts=[];faces=[];uv=[];N=80
for j in range(N+1):
 y=-18+36*j/N
 for i in range(N+1):
  x=-19+38*i/N;d=abs(y-river(x));h=height(x,y)-3.0*exp(-(d/2.3)**6)+max(0,abs(x)-11)**1.4*.13+max(0,y-12)*.07-.5*exp(-((x+9)/1.3)**4-((y-6)/1.1)**4)
  if 1<y<6.4:
   weight=max(0,min(1,(1.25-abs(x+9))/.5));level=-1.9+(y-1)/5*4.1;h=h*(1-weight)+min(h,level-.18)*weight
  verts.append((x,y,h));uv.append((x/6,y/6))
for j in range(N):
 for i in range(N):
  a=j*(N+1)+i;faces.extend([(a,a+1,a+N+1),(a+1,a+N+2,a+N+1)])
def ground_color(v,i):
 x,y,z=v
 # A single connected path system, with quiet clearings around each destination.
 def segment(ax,ay,bx,by):
  dx,dy=bx-ax,by-ay;t=max(0,min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));return math.hypot(x-ax-t*dx,y-ay-t*dy)
 dist=min(abs(x-path_x(y))-1.05,segment(0,-4,-5.7,-3.6)-.7,segment(0,-7,-4.2,-7.2)-.65,segment(0,-7,5.2,-6.8)-.7,segment(0,-2.5,8.3,-1.5)-.7)
 t=max(0,min(1,(.32-dist)*1.5));noise=sin(x*7+y*8)*sin(y*6-x*5)*.018
 base=np.array(color('#5c8959')[:3]);sand=np.array(color('#ccb17c')[:3]);shade=1
 for tx,ty in [(-10,-10),(-10,-3),(13,-8),(12,-1),(-8,3),(-11,8),(10,7),(-4,12),(4,13)]:shade-=.27*exp(-((x-tx-1.3)/2.7)**2-((y-ty+1)/2.4)**2)
 rgb=(base*(1-t)+sand*t)*max(.48,shade)+noise
 bank=abs(y-river(x));stone=max(0,min(1,(3.15-bank)*2.5));rock=np.array(color('#82958b')[:3])*(.83+.1*sin(x*5+z*13))
 rgb=rgb*(1-stone)+rock*stone
 return (*np.clip(rgb,0,1),1)
terrain=mesh('Terrain',verts,faces,'Ground',uv,ground_color);terrain.parent=env
nav_heights=[round(verts[(N-j)*(N+1)+i][2],6) for j in range(N+1) for i in range(N+1)]
(OUT/'navigation.json').write_text(json.dumps({'n':N,'bounds':[-19,19,-18,18],'heights':nav_heights},separators=(',',':')))

# A forested valley backdrop closes the composition when the follow camera approaches the north bank.
vv=[];ff=[];n=46
for j in range(n+1):
 y=-35+70*j/n
 for i in range(n+1):
  x=-35+70*i/n;h=height(x,y)+max(0,abs(x)-11)**1.4*.13+max(0,y-12)*.07
  vv.append((x,y,h-.02))
for j in range(n):
 for i in range(n):
  x=-35+70*(i+.5)/n;y=-35+70*(j+.5)/n
  if abs(x)<18 and abs(y)<17:continue
  a=j*(n+1)+i;ff.append((a,a+1,a+n+2,a+n+1))
skirt=mesh('Distant forest valley',vv,ff,'Ground',pigment=lambda v,i:(*color('#3e633d')[:3],1));skirt.parent=env

def boulder(name,x,y,size=1):
 verts=[];faces=[];seg=10;rows=5;kind=int(abs(x*173+y*317))%3
 palette=('#a7aaa0','#a4a3af','#adb095')
 for j in range(rows+1):
  a=-pi/2+pi*j/rows
  for i in range(seg+1):
   b=2*pi*i/seg;r=1+.115*sin(b*(3+kind)+j*1.23+kind)+.055*cos(b*5-j)
   u=cos(a)*cos(b)*size*r+sin(a)*size*(kind-1)*.16
   v=cos(a)*sin(b)*size*[.82,.72,.96][kind]*r
   verts.append((u,v,sin(a)*size*[.56,.67,.46][kind]*r+u*(kind-1)*.06))
 for j in range(rows):
  for i in range(seg):a=j*(seg+1)+i;faces.append((a,a+1,a+seg+2,a+seg+1))
 def tint(v,i):
  moss=sin(i*.41+kind)+cos(i*.83)>.61 and v[2]>size*.01
  hue='#879a60' if size>.65 and moss else palette[kind] if v[2]>size*.22 else '#707e76'
  return (*np.array(color(hue)[:3])*(.89+.11*sin(i*1.7)),1)
 ob=mesh(name,verts,faces,'Rock',pigment=tint)
 ob.location=(x,y,height(x,y)+size*.3);ob.parent=env;return ob
# Layered canyon bedrock, irregular strata and moss lips are modeled, not a flat blue stripe.
for side in [-1,1]:
 vv=[];ff=[];uu=[]
 for i in range(100):
  x=-19+i*38/99;y=river(x)+side*2.45
  for j in range(6):
   z=height(x,y)-j*.54;offset=.12*sin(x*2+j*1.7)+.07*sin(x*5)
   vv.append((x,y+side*offset,z));uu.append((x/2,j/3))
 for i in range(99):
  for j in range(5):
   a=i*6+j;face=(a,a+6,a+7,a+1);ff.append(face if side==1 else tuple(reversed(face)))
 wall=mesh('Creek carved bedrock',vv,ff,'Rock',uu,pigment=lambda v,i:(*np.array(color('#85988f')[:3])*(.78+.16*sin(v[2]*12+v[0]*.4)),1));wall.parent=env
for i in range(28):
 x=random.uniform(-17,17);y=river(x)+random.choice((-1,1))*random.uniform(2.4,2.9);boulder('Creek stone',x,y,random.uniform(.13,.5))
for x,y,s in [(-6,-5,1.1),(7,-4,.9),(-8,8,1.5),(11,3,1.2),(-4,11,1.7),(9,10,1.3)]:boulder('Mossy landmark',x,y,s)
def leaves_mesh(name,defs,mat='Leaf',parent=None):
 verts=[];faces=[];uv=[]
 for center,direction,length,width,twist in defs:
  d=Vector(direction).normalized();s=d.cross(Vector((0,0,1)))
  if s.length<.01:s=Vector((1,0,0))
  s.normalize();up=d.cross(s).normalized();c=Vector(center);idx=len(verts)
  for t,w,h in [(0,0,0),(.27,-.9,.03),(.63,-.72,.09),(1,0,.22),(.63,.72,.09),(.27,.9,.03),(.48,0,.2)]:verts.append(tuple(c+d*t*length+s*w*width+up*(h*length+sin(t*pi)*twist)));uv.append(((w+1)*.5,t))
  faces.extend((idx+6,idx+a,idx+(a+1)%6) for a in range(6))
 base=np.array(color('#6c9b3e')[:3]);ob=mesh(name,verts,faces,mat,uv,lambda v,i:(*np.clip(base*(.65+.5*(sin((i//7)*.19)*.5+.5)),0,1),1));ob.parent=parent;return ob
def crown(name,cx,cy,cz,sx,sy,sz,hue,parent):
 verts=[];faces=[];seg=12;rows=7
 for j in range(rows+1):
  a=-pi/2+j*pi/rows
  for i in range(seg):
   b=i/seg*2*pi;r=1+.076*sin(b*5+j*.6)+.040*cos(b*3-j)
   verts.append((cx+cos(a)*cos(b)*sx*r,cy+cos(a)*sin(b)*sy*r,cz+sin(a)*sz*(1+.035*sin(b*4))))
 for j in range(rows):
  for i in range(seg):a=j*seg+i;faces.append((a,j*seg+(i+1)%seg,(j+1)*seg+(i+1)%seg,a+seg))
 base=np.array(color(hue)[:3])
 ob=mesh(name,verts,faces,'Leaf',pigment=lambda v,i:(*np.clip(base*(.79+.24*(v[2]-cz+sz)/(2*sz)+.052*(1+sin(i*.31))*.5),0,1),1));ob.parent=parent;return ob

def tree_model(kind=0):
 root=empty('Oak model '+str(kind));branches=[];h=[4.1,5.4,5.1][kind]
 barkmat='Birch' if kind==1 else 'Bark'
 branches.append(tube('Sculpted trunk',[(0,0,0),(.12,-.03,.9),(.26,.03,2.4),(.4,.12,3.7),(.25,.1,h)],[.52,.36,.26,.18,.045],barkmat,root,segments=10))
 for j in range(4):
  a=j*2*pi/4+.3;end=(cos(a)*1.9,sin(a)*1.7,h-.45+sin(j)*.3);branches.append(tube('Arching branch',[(.2,0,2.6),(.4+cos(a)*.6,sin(a)*.6,3.8),end],[.17,.11,.02],barkmat,root,segments=7))
 for j in range(5):
  a=j*2*pi/5;branches.append(tube('Buttress root',[(0,0,.3),(cos(a)*.65,sin(a)*.65,.09),(cos(a)*1.15,sin(a)*1.15,.025)],[.18,.13,.004],barkmat,root,segments=6))
 bark=join(branches,'Oak bark '+str(kind));bark.parent=root;crowns=[]
 if kind==2:
  for j in range(4):
   z=2.7+j*.95;r=2.25-j*.4
   crowns.append(crown('Needle crown',.15,.1,z,r,r*.9,.9,'#397b60',root))
 else:
  for j in range(5):
   a=j*2*pi/5;z=h-.35+(j%2)*.55;r=1.25 if kind==1 else 1.65
   crowns.append(crown('Layered broadleaf',cos(a)*1.25,sin(a)*1.1,z,r,r*.88,1.1 if kind==1 else 1.4,'#8bb47d' if kind==1 else '#578e5b',root))
  crowns.append(crown('Sunlit crown',.2,.15,h+.75,1.8,1.6,1.25,'#a1c48a' if kind==1 else '#84ad68',root))
 if kind==1:
  for j in range(6):branches.append(plank('Birch bark eyes',(.13,-.31,1+j*.44),(.16+(j%2)*.09,.025,.055),'Bark dark',root,angle=.1,bevel=.01))
 leaf=join(crowns,'Oak foliage '+str(kind));leaf.parent=root
 return root
models=[tree_model(i) for i in range(3)]
def clone_model(model,name,x,y,s=1,rot=0,parent=env):
 g=empty(name,(x,y,height(x,y)),parent);g.scale=(s,s,s);g.rotation_euler.z=rot
 for o in model.children:
  cp=o.copy();cp.data=o.data;bpy.context.collection.objects.link(cp);cp.parent=g;cp.location=o.location;cp.hide_set(False)
 return g
placements=[(-10,-10,1.15),(-10,-3,1.1),(13,-8,1.2),(12,-1,1.25),(-8,3,1.1),(-11,8,1.4),(10,7,1.25),(-4,12,1.25),(4,13,1.2),(11,13,1.4),(-13,13,1.2)]
for j,(x,y,s) in enumerate(placements):clone_model(models[j%3],'Hero oak',x,y,s,random.random()*6)
for j in range(13):
 a=random.uniform(0,2*pi);r=random.uniform(15,21);x=cos(a)*r;y=sin(a)*r
 if y < -10 and abs(x)<12:continue
 clone_model(models[j%3],'Forest depth oak',x,y,random.uniform(.9,1.4),random.random()*6)
for model in models:
 for o in children(model):o.hide_set(True);o.hide_render=True
for j,(x,y) in enumerate([(-4,-6),(4,-5),(-5,-1),(5,0),(-5,5),(3.8,6),(-2,9),(8,4),(-7,9),(8,-2)]):
 defs=[]
 for i in range(35):
  a=random.uniform(0,2*pi);r=random.random()**.5;defs.append(((x+cos(a)*r*.8,y+sin(a)*r*.7,height(x,y)+.25+r*.6),(cos(a),sin(a),.3),random.uniform(.35,.65),.18,.05))
 bush_hues=('#568c59','#718d55','#558678')
 if j%3==1:
  defs=[(base,heading,length,.087,.07) for base,heading,length,_,__ in defs]
 shrub=leaves_mesh('Understory shrub',defs[:14],parent=env)
 ground=height(x,y)
 crown('Understory velvet',x-.25,y,ground+[.30,.23,.42][j%3],.65,.48,[.42,.32,.55][j%3],bush_hues[j%3],env)
 crown('Understory velvet',x+.25,y+.1,ground+[.42,.32,.50][j%3],[.59,.73,.46][j%3],.51,.43,'#85aa69',env)
 if j%3!=0:
  for i,(dx,dy,dz) in enumerate([(-.37,-.14,.61),(.27,-.29,.53),(.52,.03,.62)]):
   bud=ellipsoid('Understory buds',(x+dx,y+dy,ground+dz),(.083,.058,.052),
                 'Lilac' if j%3==1 else 'Gold',env,segments=8,rings=5)
   bud['detail']=True

fern=empty('Fern master');defs=[]
for j in range(5):
 a=j*2*pi/5;points=[]
 for i in range(7):
  t=i/6;points.append((cos(a)*t*.9,sin(a)*t*.9,sin(t*pi*.8)*.5))
  if i>0:
   for side in [-1,1]:defs.append((points[-1],(cos(a+side*.9),sin(a+side*.9),.1),.32*(1-t*.6),.092,0))
 curve('Fern rachis',points,.012,'Fern',fern)
leaves_mesh('Fern blades',defs,'Fern',fern);join(list(fern.children),'Fern silhouette').parent=fern
grass=empty('Grass master');verts=[];faces=[]
for i in range(7):
 a=random.random()*2*pi;r=random.random()*.2;x=cos(a)*r;y=sin(a)*r;h=random.uniform(.2,.52);w=random.uniform(.016,.04);side=Vector((cos(a),sin(a),0));idx=len(verts)
 for t,ww in [(0,1),(.35,.9),(.72,.5),(1,0)]:
  center=Vector((x+cos(a)*t*t*.2,y+sin(a)*t*t*.2,h*t));verts.extend([tuple(center-side*w*ww),tuple(center+side*w*ww)])
 for j in range(3):faces.append((idx+j*2,idx+j*2+1,idx+j*2+3,idx+j*2+2))
g=mesh('Grass blade clump',verts,faces,'Leaf',pigment=lambda v,i:(*color('#75a153' if v[2]>.15 else '#456b36')[:3],1));g.parent=grass;g['wind']=True;g['detail']=True
for j in range(180):
 x=random.uniform(-14,14);y=random.uniform(-13,14)
 if abs(x-path_x(y))<1.6 or abs(y-river(x))<2.6 or (x-6)**2+(y-7)**2<5:continue
 clone_model(grass,'Detail grass',x,y,random.uniform(.65,1.35),random.random()*6)
for j in range(36):
 x=random.uniform(-13,13);y=random.uniform(-12,13)
 if abs(x-path_x(y))<1.8 or abs(y-river(x))<2.6:continue
 clone_model(fern,'Fern',x,y,random.uniform(.7,1.4),random.random()*6)
for model in [fern,grass]:
 for o in children(model):o.hide_set(True);o.hide_render=True
for i in range(28):
 y=random.uniform(-11,12);x=path_x(y)+random.choice((-1,1))*random.uniform(1.7,4)
 if abs(y-river(x))<2.6:continue
 g=empty('Wildflower colony',(x,y,height(x,y)),env)
 if i%3==0:
  for k in range(3):
   x1=k*.19;tube('Mushroom stem',[(x1,0,0),(x1-.04,0,.15),(x1,0,.25)],[.04,.045,.04],'Cream',g,segments=7);loft('Wavy mushroom cap',[(x1,0,.24,.22,.18),(x1,0,.31,.19,.16),(x1,0,.39,.04,.035)],'Mushroom',12,g)
   for k1 in range(4):ellipsoid('Cap fleck',(x1+cos(k1*1.6)*.12,sin(k1*1.6)*.1,.33),(.025,.025,.014),'Cream',g,segments=7,rings=4)
 else:
  for k in range(3):
   a=k*2.1;tube('Flower stem',[(cos(a)*.12,sin(a)*.12,0),(cos(a)*.2,sin(a)*.2,.36)],[.012,.008],'Fern',g,segments=5)
   for p in range(5):ellipsoid('Flower petal',(cos(a)*.2+cos(p*1.256)*.07,sin(a)*.2+sin(p*1.256)*.07,.38),(.065,.04,.025),'Lilac' if i%2 else 'Gold',g,segments=7,rings=4)
   ellipsoid('Flower center',(cos(a)*.2,sin(a)*.2,.4),(.035,.035,.025),'Cream',g,segments=7,rings=4)
mission=empty('Mission board',(-2.1,-1.7,height(-2.1,-1.7)),env);tube('Sign post',[(0,0,0),(0,0,1.25)],[.12,.1],'Bark',mission);plank('Board back',(0,0,1.05),(1.12,.16,.65),'Warm timber',mission,bevel=.075);plank('Journal cover',(0,-.105,1.08),(.7,.06,.47),'Teal',mission,angle=-.1)
for j in range(3):plank('Journal line',(-.03,-.145,.98+j*.09),(.32,.015,.015),'Cream',mission,angle=-.1,bevel=.004)
for x,y in [(-1.7,-6),(2,-.7),(-1.7,5.5),(4,7)]:
 g=empty('Trail lantern',(x,y,height(x,y)),env);curve('Bent lamp post',[(0,0,0),(.02,0,1.55),(.15,0,1.8),(.4,0,1.8)],.05,'Dark timber',g);loft('Lantern housing',[(.4,0,1.3,.16,.16),(.4,0,1.7,.16,.16)],'Window light',8,g);loft('Lantern cap',[(.4,0,1.71,.24,.24),(.4,0,1.87,.03,.03)],'Copper',8,g)
# Carved treasure chest and layered creek ledges frame an original small cascade.
for x,y,size in [(-10.5,4.7,.9),(-7.3,4.9,.9),(-10.5,2.9,.85),(-7.2,2.7,.8)]:boulder('Cascade ledge',x,y,size)
chest=empty('Treasure chest',(-4,4,height(-4,4)),env)
for i in range(6):plank('Chest staves',(-.625+i*.25,0,.4),(.24,.85,.7),'Dark timber',chest,bevel=.025)
for side in [-1,1]:plank('Chest iron band',(side*.44,-.44,.45),(.1,.03,.76),'Copper',chest,bevel=.01)
for j in range(9):
 a=j*pi/8;plank('Rounded chest lid',(0,cos(a)*.44,.76+sin(a)*.28),(1.55,.18,.07),'Warm timber',chest,bevel=.025)
plank('Chest clasp',(0,-.48,.6),(.19,.08,.3),'Gold',chest,bevel=.03)
# Destinations are authored places in the same clearing, not menu-only entries.
def station(name,x,y):return empty('Station '+name,(x,y,height(x,y)),env)
cal=station('calendar',-4.2,-7.2)
for x in [-.5,.5]:tube('Calendar carved leg',[(x,0,0),(x,0,1.6)],[.09,.075],'Bark',cal,segments=7)
plank('Calendar oak frame',(0,0,1.3),(1.55,.22,1.05),'Warm timber',cal,bevel=.09)
plank('Calendar parchment',(0,-.14,1.3),(1.28,.025,.78),'Cream',cal,bevel=.025)
for row in range(3):
 for col in range(4):plank('Calendar day tile',(-.46+col*.30,-.165,1.05+row*.23),(.19,.025,.12),'Teal' if (row+col)%4 else 'Clay',cal,bevel=.018)
shop=station('workshop',-5.7,-3.6)
for x in [-.9,.9]:tube('Awning post',[(x,.2,0),(x,.2,2.15)],[.09,.07],'Dark timber',shop,segments=7)
plank('Workshop counter',(0,-.15,.8),(1.95,.95,.14),'Warm timber',shop,bevel=.06)
for x in [-.75,.75]:plank('Counter leg',(x,0,.4),(.12,.65,.8),'Dark timber',shop,bevel=.03)
roof=mesh('Workshop linen awning',[(-1.2,.5,2.2),(1.2,.5,2.2),(-1.2,-.85,1.92),(1.2,-.85,1.92)],[(0,1,3,2)],'Teal');roof.parent=shop
for x in [-1,-.5,0,.5,1]:loft('Awning scallop',[(x,-.85,1.88,.23,.035),(x,-.85,1.96,.23,.04)],'Teal light',8,shop)
plank('Workshop tool tray',(.3,-.15,.91),(.58,.45,.08),'Dark timber',shop,bevel=.025)
for x in [-.3,0,.3]:ellipsoid('Crafting pigment pot',(x,-.15,1.02),(.11,.11,.16),'Gold' if x<0 else 'Clay',shop,segments=9,rings=6)
wardrobe=station('wardrobe',5.2,-6.8)
for x in [-.65,.65]:tube('Wardrobe branch',[(x,0,0),(x,0,1.7),(x*.8,0,2)],[.1,.07,.045],'Bark',wardrobe,segments=7)
curve('Wardrobe crossbar',[(-.8,0,1.8),(0,0,1.9),(.8,0,1.8)],.075,'Warm timber',wardrobe)
cloth=mesh('Explorer cloak',[(-.32,-.04,1.7),(.32,-.04,1.7),(-.58,-.1,.55),(0,-.2,.63),(.58,-.1,.55)],[(0,1,3),(0,3,2),(1,4,3)],'Lilac');cloth.parent=wardrobe
loft('Spare explorer hat',[(.5,-.3,.5,.34,.3),(.5,-.3,.54,.34,.3),(.5,-.3,.57,.21,.2),(.5,-.3,.76,.18,.17)],'Gold',14,wardrobe)
portal=station('portal',8.3,-1.5)
for side in [-1,1]:
 for j in range(5):
  ob=plank('Portal carved stone',(side*(1.05-.08*j*j/4),0,.25+j*.4),(.46,.65,.44),'Roof moss',portal,angle=side*j*.055,bevel=.09)
loft('Portal keystone',[(0,0,2.15,.42,.35),(0,0,2.65,.30,.31)],'Warm timber',8,portal)
for side in [-1,1]:
 gem=ellipsoid('Portal jewel',(side*.9,-.36,1.1),(.08,.04,.12),'Window light',portal,segments=10,rings=6);gem['owner']='portal'
# Deliberate trail details: low stone kerbs, stepping stones, moss shelves and root groups.
for y in np.linspace(-10,10,26):
 for side in [-1,1]:
  x=path_x(y)+side*1.35
  if abs(y-river(x))>2.9:
   ob=boulder('Trail kerb',x,y,.13+random.random()*.08);ob.scale.z=.45
for x,y in [(-8.1,4.1),(-10.8,4.4),(-7.8,2.9)]:
 for j in range(3):
  ob=boulder('Waterfall terrace',x+(j%2)*.25,y,.75-j*.12);ob.location.z+=j*.28
export(env,'forest.glb')
activity=empty('Activity marker')
tube('Activity post',[(0,0,0),(0,0,1.2)],[.07,.055],'Dark timber',activity,segments=7)
plank('Activity journal',(0,-.03,1),(.58,.16,.46),'Teal',activity,angle=-.1,bevel=.045)
plank('Activity book spine',(-.22,-.13,1),(.05,.03,.39),'Gold',activity,bevel=.005)
for j in range(3):plank('Activity page line',(.02,-.13,.9+j*.09),(.25,.015,.02),'Cream',activity,bevel=.003)
export(activity,'activity.glb')
# Bent planks, supporting arches, hand-tied ropes, pegs, grain and bevels.
bridge=empty('Bridge')
for j in range(19):
 y=-1.2+j*.345;z=height(0,y)+.12+.48*sin((y+1.2)/6.21*pi);plank('Worn bridge board',(random.uniform(-.02,.02),y,z),(2.25+random.uniform(-.07,.07),.245,.13),'Warm timber' if j%3 else 'Dark timber',bridge,random.uniform(-.01,.01),.025)
 for x in [-.88,.88]:ellipsoid('Wooden peg',(x,y,z+.075),(.025,.025,.015),'Copper',bridge,segments=6,rings=4)
for x in [-1.08,1.08]:
 points=[]
 for j in range(6):
  y=-1.1+j*1.2;z=height(0,y)+.12+.48*sin((y+1.2)/6.2*pi);tube('Bridge post',[(x,y,z),(x-.03,y,z+1)],[.085,.065],'Bark',bridge,segments=8);points.append((x,y,z+.85))
  for i in range(1):curve('Rope binding',[(x+cos(a)*.1,y+sin(a)*.1,z+.65+i*.05) for a in np.linspace(0,2*pi,17)],.013,'Cream',bridge)
 curve('Carved timber handrail',points,.075,'Warm timber',bridge);curve('Arched beam',[(x,-1.4,.02),(x,.4,.3),(x,2,.5),(x,3.8,.3),(x,5.3,.02)],.13,'Dark timber',bridge)
export(bridge,'bridge.glb')
house=empty('Treehouse',(6,7,height(6,7)));tube('Ancient trunk',[(0,0,0),(-.1,.1,1.5),(-.15,.1,3.5),(-.5,.2,6.5),(-.8,.4,8.5)],[.82,.62,.42,.3,.06],'Bark',house,segments=18)
for j in range(6):
 a=j*pi/3;tube('House roots',[(0,0,.5),(cos(a)*1.1,sin(a)*1.1,.08),(cos(a)*1.8,sin(a)*1.8,.03)],[.3,.16,.015],'Bark',house,segments=8)
for j in range(17):plank('Deck plank',(-1.6+j*.2,-.4,2.7),(.19,3,.16),'Warm timber',house,bevel=.018)
for x in [-1.3,1.3]:curve('Platform brace',[(0,0,1.2),(x,-.6,2.65)],.12,'Dark timber',house)
for side in [-1,1]:
 for j in range(9):plank('Side weatherboard',(side*1.17,-.4,2.95+j*.21),(.12,2.25,.19),'Warm timber' if j%3 else 'Dark timber',house,bevel=.025)
for j in range(9):
 z=2.95+j*.21
 for side in [-1,1]:plank('Front siding',(side*.82,-1.53,z),(.63,.13,.19),'Warm timber',house,bevel=.02)
 plank('Rear siding',(0,.73,z),(2.35,.14,.19),'Dark timber',house,bevel=.02)
loft('Arched door',[(0,-1.56,2.82,.42,.055),(0,-1.56,4.1,.42,.055),(0,-1.56,4.33,.25,.055),(0,-1.56,4.4,.03,.055)],'Teal',14,house);curve('Door frame',[(-.47,-1.62,2.82),(-.47,-1.62,4.1),(0,-1.62,4.48),(.47,-1.62,4.1),(.47,-1.62,2.82)],.045,'Cream',house);ellipsoid('Door handle',(.25,-1.65,3.55),(.045,.06,.045),'Gold',house,segments=10,rings=6)
for side in [-1,1]:
 for row in range(6):
  x=side*(row+.3)*.255;z=5.52-(row/5)**1.25*1.05
  for col in range(4):
   y=-1.55+col*.73;tile=plank('Soft roof tile',(x,y,z+sin(col*.6)*.025),(.36,.79,.12),'Roof ochre',house,angle=sin(col)*.017,bevel=.050);tile.rotation_euler.y=side*.58
gable=mesh('Timber gable',[(-1.2,-1.54,4.75),(1.2,-1.54,4.75),(0,-1.54,5.55)],[(0,1,2)],'Warm timber');gable.parent=house
curve('Roof ridge',[(0,-1.9,5.58),(0,-.5,5.65),(0,1.3,5.58)],.09,'Dark timber',house);ellipsoid('Window glow',(1.245,-.25,4),(.035,.37,.37),'Window light',house,segments=24,rings=12);curve('Window frame',[(1.3,-.25+cos(a)*.4,4+sin(a)*.4) for a in np.linspace(0,2*pi,33)],.045,'Cream',house);curve('Window mullion',[(1.31,-.25,3.62),(1.31,-.25,4.38)],.023,'Dark timber',house);curve('Window transom',[(1.31,-.62,4),(1.31,.12,4)],.023,'Dark timber',house)
for x in [-1.6,1.6]:
 for y in [-1.8,.9]:tube('Deck post',[(x,y,2.7),(x,y,3.5)],[.07,.06],'Bark',house,segments=8)
 curve('Balcony rope',[(x,-1.8,3.45),(x,-.4,3.38),(x,.9,3.45)],.03,'Cream',house)
for j in range(13):
 a=-1.9+j*.12;plank('Branch stair',(cos(a)*1.4,sin(a)*1.4,.2+j*.2),(.9,.35,.1),'Warm timber',house,angle=a,bevel=.025)
defs=[]
for i in range(154):
 a=random.uniform(0,2*pi);r=random.random()**.5;defs.append(((-.8+cos(a)*2.6*r,1.8+sin(a)*2*r,6.9+random.random()*1.2),(cos(a),sin(a),.4),random.uniform(.7,1.2),.36,.08))
canopy=leaves_mesh('Treehouse crown',defs,parent=house);canopy['wind']=True;curve('Climbing vine',[(1.4,-1.3,2.8),(1.3,-1.5,3.5),(1.2,-1.5,4.3),(.9,-1.4,4.8)],.025,'Fern',house);export(house,'treehouse.glb')
# Expressive original child explorer: custom face topology, swept locks, tailored clothing.
davi=empty('Davi');parts=[]
def add(o):parts.append(o);return o
add(loft('Tailored shirt',[(0,0,.78,.22,.14),(0,0,.9,.24,.15),(0,0,1.12,.28,.16),(0,0,1.3,.26,.13),(0,0,1.36,.13,.1)],'Tunica',20,davi,'Spine'));add(loft('Shorts',[(0,0,.63,.22,.15),(0,0,.87,.24,.17)],'Shorts',16,davi,'Root'));add(loft('Neck',[(0,0,1.29,.105,.1),(0,0,1.48,.11,.1)],'Skin',14,davi,'Head'));add(loft('Sculpted face',[(0,0,1.38,.08,.1),(0,-.015,1.42,.21,.18),(0,-.015,1.52,.31,.255),(0,.005,1.68,.345,.275),(0,.02,1.83,.31,.28),(0,.03,1.94,.22,.21),(0,.03,1.99,.03,.035)],'Skin',32,davi,'Head'))
for side in [-1,1]:
 label='L' if side<0 else 'R';add(ellipsoid('Ear '+label,(side*.325,.005,1.63),(.075,.065,.12),'Skin',davi,'Head',14,10));add(ellipsoid('Ear fold '+label,(side*.355,-.04,1.64),(.035,.025,.065),'Cheek',davi,'Head',10,8));add(ellipsoid('Sclera '+label,(side*.145,-.251,1.697),(.101,.045,.126),'White',davi,'Head',20,14));add(ellipsoid('Iris '+label,(side*.145,-.291,1.69),(.063,.025,.083),'Iris',davi,'Head',18,12));add(ellipsoid('Pupil '+label,(side*.145,-.313,1.69),(.035,.013,.055),'Eye',davi,'Head',16,10));add(ellipsoid('Eye sparkle '+label,(side*.145-.021,-.327,1.728),(.02,.009,.026),'White',davi,'Head',10,6));add(curve('Upper eyelid '+label,[(side*.145-.096,-.265,1.73),(side*.145,-.29,1.81),(side*.145+.09,-.265,1.73)],.011,'Hair',davi,'Head'));add(curve('Soft brow '+label,[(side*.145-.09,-.24,1.855),(side*.145,-.275,1.875),(side*.145+.08,-.24,1.845)],.022,'Hair',davi,'Head'));add(ellipsoid('Warm cheek '+label,(side*.215,-.233,1.57),(.072,.012,.036),'Cheek',davi,'Head',16,8))
 for i in range(2):add(ellipsoid('Freckle '+label,(side*(.18+i*.035),-.248+i*.007,1.59+(i%2)*.018),(.007,.006,.007),'Hair light',davi,'Head',6,4))
add(ellipsoid('Nose sculpt',(0,-.28,1.59),(.066,.069,.059),'Skin',davi,'Head',18,12));add(ellipsoid('Smile opening',(0,-.270,1.502),(.088,.025,.052),'Hair',davi,'Head',14,8));add(ellipsoid('Smile warmth',(0,-.294,1.48),(.043,.009,.015),'Cheek',davi,'Head',10,6))
verts=[];faces=[];seg=32;rows=10
for j in range(rows+1):
 t=j/rows
 for i in range(seg+1):
  a=i/seg*2*pi;front=max(0,-sin(a));bottom=1.57+front*.28+.025*sin(a*5);z=bottom+(2.035-bottom)*t;rad=cos(t*pi/2);verts.append((cos(a)*.35*rad,.025+sin(a)*.30*rad,z))
for j in range(rows):
 for i in range(seg):a=j*(seg+1)+i;faces.append((a,a+1,a+seg+2,a+seg+1))
hair=mesh('Swept hair',verts,faces,'Hair');hair.parent=davi;bind(hair,'Head');add(hair)
for i in range(5):
 x=-.24+i*.107;add(tube('Rounded swept lock',[(x,.055,2.014),(x+.07,-.092,2.009),(x+.038,-.25,1.93+sin(i)*.037),(x-.059,-.287,1.84+sin(i)*.027)],[.079,.090,.068,.010],'Hair' if i%2 else 'Hair light',davi,'Head',12))
add(curve('Scarf collar',[(-.14,-.08,1.33),(0,-.17,1.3),(.14,-.08,1.33)],.035,'Gold',davi,'Spine'))
scarf=mesh('Folded scarf',[(-.06,-.19,1.29),(.08,-.19,1.29),(.1,-.205,1.05),(-.025,-.22,1.11),(0,-.235,1.25)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],'Gold');scarf.parent=davi;bind(scarf,'Spine');add(scarf)
for side in [-1,1]:
 label='L' if side<0 else 'R';x=side*.115;add(loft('Leg '+label,[(x,0,.22,.074,.075),(x,0,.42,.08,.08),(x,0,.68,.095,.09)],'Skin',14,davi,'Leg'+label));add(loft('Shorts leg '+label,[(x,0,.55,.115,.11),(x,0,.77,.12,.12)],'Shorts',14,davi,'Leg'+label));add(loft('Sock '+label,[(x,0,.18,.08,.08),(x,0,.32,.083,.083)],'Cream',14,davi,'Leg'+label));add(loft('Boot '+label,[(x,-.035,.05,.107,.15),(x,-.06,.1,.115,.19),(x,-.025,.2,.10,.155),(x,.0,.27,.08,.08)],'Boot',18,davi,'Foot'+label));add(loft('Boot sole '+label,[(x,-.065,.025,.113,.19),(x,-.065,.08,.116,.192)],'Sole',18,davi,'Foot'+label))
 for k in range(3):add(curve('Boot lace '+label,[(x-.065,-.13+k*.038,.19),(x+.065,-.13+k*.038,.19)],.009,'Cream',davi,'Foot'+label))
 add(tube('Sleeve '+label,[(side*.29,0,1.27),(side*.37,0,1.07)],[.105,.10],'Manga',davi,'Arm'+label,14));add(tube('Arm '+label,[(side*.35,0,1.15),(side*.39,-.015,.98),(side*.4,-.035,.85)],[.075,.065,.052],'Skin',davi,'Arm'+label,14));add(ellipsoid('Hand '+label,(side*.405,-.035,.81),(.065,.07,.09),'Skin',davi,'Arm'+label,14,10));add(ellipsoid('Thumb '+label,(side*.35,-.065,.83),(.035,.04,.055),'Skin',davi,'Arm'+label,12,8));add(curve('Sleeve stitching '+label,[(side*.31,-.09,1.11),(side*.38,-.09,1.08),(side*.4,-.07,1.06)],.004,'Cream',davi,'Arm'+label))
add(loft('Backpack',[(0,.17,.84,.19,.08),(0,.2,1,.21,.13),(0,.19,1.23,.17,.1),(0,.17,1.28,.09,.05)],'Dark timber',18,davi,'Spine'))
for side in [-1,1]:add(curve('Pack strap',[(side*.14,.18,1.25),(side*.2,-.13,1.22),(side*.16,-.17,.94)],.022,'Warm timber',davi,'Spine'))
add(ellipsoid('Compass badge',(-.15,-.174,1.16),(.055,.018,.055),'Gold',davi,'Spine',14,10))
hat=loft('Hat',[(0,.02,1.96,.47,.39),(0,.02,2.00,.48,.40),(0,.02,2.05,.34,.29),
                (0,.04,2.24,.30,.27),(0,.05,2.31,.22,.20),(0,.05,2.34,.035,.035)],'Hat felt',24,davi,'Head')
hat_band=loft('Hat_band',[(0,.022,2.071,.345,.303),(0,.027,2.13,.331,.293)],'Hat ribbon',24,davi,'Head')
hat_pin=ellipsoid('Hat_pin',(-.14,-.246,2.10),(.063,.022,.053),'Gold',davi,'Head',12,8)

# A shaped mantle wraps the shoulders and clears the backpack as it flares at the hem.
cape_rows=[
 [(-.245,-.065,1.28),(-.224,.19,1.31),(0,.30,1.32),(.224,.19,1.31),(.245,-.065,1.28)],
 [(-.365,.035,1.12),(-.30,.34,1.14),(0,.425,1.15),(.30,.34,1.14),(.365,.035,1.12)],
 [(-.43,.13,.81),(-.25,.35,.71),(0,.40,.72),(.28,.36,.73),(.43,.15,.83)],
 [(-.45,.16,.64),(-.27,.40,.57),(0,.46,.61),(.29,.40,.59),(.46,.20,.67)],
]
cape=mesh('Cape',[point for row in cape_rows for point in row],
          [(i,i+1,i+6,i+5) for i in range(15) if i%5!=4],'Lilac')
cape.parent=davi;bind(cape,'Spine')
cape_hem=curve('Cape_hem',cape_rows[-1],.019,'Cape lining',davi,'Spine')
cape_clasp=curve('Cape_clasp',[(-.27,-.095,1.25),(-.14,-.159,1.22),(.04,-.177,1.23),(.25,-.102,1.25)],.023,'Cape lining',davi,'Spine')
costume=[hat,hat_band,hat_pin,cape,cape_hem,cape_clasp]
# Warp the surfaces and their rest rig together, keeping the existing clips and names.
def chibi_point(point, pilot):
 x,y,z=point
 if pilot=='Davi':
  body=min(1,max(0,(z-1.31)/.075))
  height=float(np.interp(z,[0,.24,.70,1.30,1.385,2.35],[0,.164,.46,.884,.976,2.26]))
  return Vector((x*(1.18+.34*body),y*(1.13+.18*body),height))
 body=min(1,max(0,(z-.51)/.068))
 height=float(np.interp(z,[0,.24,.55,.62,1.17],[0,.172,.39,.49,1.18]))
 return Vector((x*(1.12+.24*body),y*(1.12+.21*body),height))
def chibi_shapes(parts, pilot):
 for obj in parts:
  matrix=obj.matrix_basis.copy(); inverse=matrix.inverted()
  for v in obj.data.vertices:v.co=inverse @ chibi_point(matrix @ v.co,pilot)
def chibi_bones(bones,pilot):
 return [(name,chibi_point(head,pilot),chibi_point(tail,pilot),parent) for name,head,tail,parent in bones]

def merge_skin(parts,root):
 groups={};accessories=[]
 for ob in parts:
  if ob.name.startswith(('Hat','Cape','Buddy scarf')):accessories.append(ob);continue
  key=('Blink_' if ob.name.startswith(('Sclera','Iris','Pupil','Eye sparkle')) else 'Surface_')+ob.data.materials[0].name
  groups.setdefault(key,[]).append(ob)
 result=[]
 for name,objects in groups.items():
  ob=join(objects,name);ob.parent=root;result.append(ob)
 return result+accessories
def rig_character(root,parts,bones,clips):
 bpy.ops.object.select_all(action='DESELECT');armdata=bpy.data.armatures.new(root.name+' skeleton');arm=bpy.data.objects.new(root.name+' rig',armdata);bpy.context.collection.objects.link(arm);arm.parent=root;bpy.context.view_layer.objects.active=arm;arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
 for name,head,tail,parent in bones:
  b=armdata.edit_bones.new(name);b.head=head;b.tail=tail
  if parent:b.parent=armdata.edit_bones[parent]
 bpy.ops.object.mode_set(mode='OBJECT');arm.select_set(False)
 for ob in parts:ob.parent=arm;mod=ob.modifiers.new('Deformation rig','ARMATURE');mod.object=arm
 for clip,length in clips:
  action=bpy.data.actions.new(clip);arm.animation_data_create();arm.animation_data.action=action
  for frame in range(1,length+1,3):
   phase=(frame-1)/(length-1)*2*pi
   for name,_,_,_ in bones:
    p=arm.pose.bones[name];p.rotation_mode='XYZ';p.rotation_euler=(0,0,0);p.location=(0,0,0)
    if root.name=='Davi':
     if clip=='Walk':
      if name.startswith('Leg'):p.rotation_euler.x=sin(phase+(0 if name.endswith('L') else pi))*.48
      if name.startswith('Foot'):p.rotation_euler.x=max(0,sin(phase+(0 if name.endswith('L') else pi)))*.18
      if name.startswith('Arm'):p.rotation_euler.x=sin(phase+(pi if name.endswith('L') else 0))*.37;p.rotation_euler.y=.05*(1 if name.endswith('L') else -1)
      if name=='Root':p.location.z=abs(sin(phase))*.025;p.rotation_euler.y=sin(phase)*.035
      if name=='Head':p.rotation_euler.z=sin(phase)*.038
     elif clip=='Wave':
      if name=='ArmR':p.rotation_euler.y=-1.74;p.rotation_euler.x=sin(phase*2)*.32
      if name=='Head':p.rotation_euler.y=.1*sin(phase)
     else:
      if name=='Spine':p.rotation_euler.x=.015*sin(phase)
      if name=='Head':p.rotation_euler.z=.035*sin(phase*.5)
      if name.startswith('Arm'):p.rotation_euler.y=(.04+.025*sin(phase))*(1 if name.endswith('L') else -1)
    else:
     if name=='Root':p.rotation_euler.y=sin(phase)*.043
     if name.startswith('Leg') and clip=='Walk':
      stride=phase+(0 if name.endswith('L') else pi)
      local_axes=p.bone.matrix_local.to_3x3().inverted()
      p.location=local_axes @ Vector((0,.082*cos(stride),.092*max(0,sin(stride))))
      p.rotation_euler.x=.61*cos(stride)
     if name.startswith('Wing'):p.rotation_euler.y=sin(phase*(2 if clip=='Walk' else 1))*.17*(1 if name.endswith('L') else -1)
     if name=='Head':p.rotation_euler.z=sin(phase)*(.065 if clip=='Walk' else .087)
    p.keyframe_insert('rotation_euler',frame=frame);p.keyframe_insert('location',frame=frame)
  arm.animation_data.action=None;track=arm.animation_data.nla_tracks.new();track.name=clip;track.strips.new(clip,1,action)
 bpy.context.scene.frame_set(1);return arm
bones=[('Root',(0,0,.72),(0,0,.9),None),('Spine',(0,0,.9),(0,0,1.32),'Root'),('Head',(0,0,1.32),(0,0,1.8),'Spine'),('LegL',(-.115,0,.7),(-.115,0,.24),'Root'),('LegR',(.115,0,.7),(.115,0,.24),'Root'),('FootL',(-.115,0,.24),(-.115,-.2,.08),'LegL'),('FootR',(.115,0,.24),(.115,-.2,.08),'LegR'),('ArmL',(-.27,0,1.27),(-.4,0,.85),'Spine'),('ArmR',(.27,0,1.27),(.4,0,.85),'Spine')]
chibi_shapes(parts+costume,'Davi')
rig_character(davi,merge_skin(parts+costume,davi),chibi_bones(bones,'Davi'),[('Idle',91),('Walk',25),('Wave',61)]);export(davi,'davi.glb',True)
pipo=empty('Pipo');parts=[]
add(loft('Pipo sculpted torso',[(0,0,.17,.09,.08),(0,0,.21,.18,.14),(0,0,.4,.22,.16),(0,0,.6,.15,.12)],'Teal light',24,pipo,'Root'));add(loft('Pipo head shell',[(0,0,.56,.12,.11),(0,0,.59,.29,.2),(0,0,.8,.32,.22),(0,0,.94,.24,.19),(0,0,.98,.07,.06)],'Pipo ceramic',28,pipo,'Head'));add(loft('Pipo eye visor',[(0,-.18,.64,.22,.045),(0,-.2,.76,.24,.055),(0,-.17,.86,.2,.04)],'Pipo screen',24,pipo,'Head'))
for side in [-1,1]:
 label='L' if side<0 else 'R';add(ellipsoid('Pipo expressive eye '+label,(side*.115,-.255,.76),(.052,.015,.072),'Pipo eye',pipo,'Head',16,10));add(ellipsoid('Pipo eye highlight '+label,(side*.115-.012,-.271,.786),(.014,.007,.018),'White',pipo,'Head',8,6));add(ellipsoid('Pipo ear joint '+label,(side*.3,0,.74),(.065,.08,.09),'Copper',pipo,'Head',14,10));wing=leaves_mesh('Pipo leaf fin '+label,[((side*.22,.01,.48),(side*.7,.1,.55),.42,.105,.025)],'Teal',pipo);bind(wing,'Wing'+label);add(wing);add(tube('Pipo articulated foot '+label,[(side*.1,0,.25),(side*.14,-.03,.11),(side*.15,-.09,.07)],[.045,.048,.037],'Pipo boot',pipo,'Leg'+label,10))
 add(ellipsoid('Pipo toe '+label,(side*.15,-.113,.068),(.074,.104,.051),'Pipo boot',pipo,'Leg'+label,14,8))
add(ellipsoid('Pipo lantern heart',(0,-.15,.4),(.095,.035,.1),'Window light',pipo,'Root',16,10));add(curve('Pipo antenna',[(0,0,.94),(.04,0,1.1),(.11,0,1.15)],.018,'Copper',pipo,'Head'));add(ellipsoid('Pipo antenna seed',(.11,0,1.15),(.05,.045,.06),'Gold',pipo,'Head',14,10))
scarf=[
 loft('Buddy scarf',[(0,-.025,.52,.235,.208),(0,-.029,.55,.252,.224),(0,-.019,.595,.244,.214)],'Scarf',20,pipo,'Root'),
 ellipsoid('Buddy scarf knot',(.16,-.233,.55),(.091,.038,.057),'Scarf',pipo,'Root',12,8),
 tube('Buddy scarf tail',[(.19,-.242,.546),(.233,-.257,.465),(.30,-.20,.39)],[.046,.05,.046],'Scarf',pipo,'Root',10),
 tube('Buddy scarf fringe',[(.193,-.241,.521),(.17,-.264,.446),(.19,-.246,.39)],[.034,.043,.041],'Cream',pipo,'Root',10),
]
parts.extend(scarf)
add(ellipsoid('Pipo smile',(0,-.232,.684),(.058,.021,.025),'Pipo eye',pipo,'Head',12,8));chibi_shapes(parts,'Pipo');rig_character(pipo,merge_skin(parts,pipo),chibi_bones([('Root',(0,0,.3),(0,0,.55),None),('Head',(0,0,.55),(0,0,.9),'Root'),('WingL',(-.2,0,.45),(-.45,0,.7),'Root'),('WingR',(.2,0,.45),(.45,0,.7),'Root'),('LegL',(-.1,0,.25),(-.15,-.09,.07),'Root'),('LegR',(.1,0,.25),(.15,-.09,.07),'Root')],'Pipo'),[('Hover',73),('Walk',25)]);export(pipo,'pipo.glb',True)
# Editable authoring scene as well as the reproducible source and exported game assets.
for root in [env,bridge,house,davi,pipo]:
 for ob in children(root):ob.hide_set(False);ob.hide_render=False
# Accessories are optional, so the authoring overview starts without them.
for piece in costume+scarf:piece.hide_set(True)
davi.location=(0,-4.5,height(0,-4.5));pipo.location=(-.8,-4.8,height(-.8,-4.8))
camera_data=bpy.data.cameras.new('Art review camera');camera=bpy.data.objects.new('Art review camera',camera_data);bpy.context.collection.objects.link(camera);camera.location=(6.8,-14.4,15.2);camera.rotation_euler=(Vector((0,-3.3,.9))-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.lens=42;bpy.context.scene.camera=camera
light_data=bpy.data.lights.new('Afternoon sun','AREA');light=bpy.data.objects.new('Afternoon sun',light_data);bpy.context.collection.objects.link(light);light.location=(-12,-10,24);light.rotation_euler=(Vector((0,0,0))-light.location).to_track_quat('-Z','Y').to_euler();light_data.energy=2100;light_data.shape='DISK';light_data.size=8;light_data.color=(1,.87,.64)
bpy.context.scene.render.resolution_x=1366;bpy.context.scene.render.resolution_y=900;bpy.context.scene.render.engine='CYCLES';bpy.context.scene.cycles.samples=32
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'forest-authoring.blend'),compress=True)
(OUT/'asset-report.json').write_text(json.dumps({'generator':'Blender '+bpy.app.version_string,'seed':1607,'assets':REPORT},indent=2),encoding='utf-8');print('ASSET_PIPELINE_COMPLETE',flush=True)
