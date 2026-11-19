"""Build the three modular world kits. Run with Blender Python or the bpy package."""
from contextlib import contextmanager
from math import cos, pi, sin
from pathlib import Path

import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parents[2] / 'assets/worlds'
MATERIALS = {}
PARENT = None


def material(pigment, glow=False):
    key = pigment, glow
    if key not in MATERIALS:
        rgb = [int(pigment[i:i+2], 16)/255 for i in (0, 2, 4)]
        linear = tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb)
        mat = bpy.data.materials.new(pigment)
        mat.use_nodes = True
        shader = mat.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = (*linear, 1)
        shader.inputs['Roughness'].default_value = .8
        if glow:
            shader.inputs['Emission Color'].default_value = (*linear, 1)
            shader.inputs['Emission Strength'].default_value = .65
        MATERIALS[key] = mat
    return MATERIALS[key]


def coordinate(point):
    x, y, z = point
    return x, -z, y


@contextmanager
def group(name, point=(0, 0, 0)):
    global PARENT
    before = PARENT
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    root.parent = before
    root.location = coordinate(point)
    PARENT = root
    try:
        yield
    finally:
        PARENT = before


def finish(point, pigment, smooth=False, glow=False):
    obj = bpy.context.object
    obj.parent = PARENT
    obj.location = coordinate(point)
    obj.data.materials.append(material(pigment, glow))
    if smooth:
        for poly in obj.data.polygons:
            poly.use_smooth = True
    return obj


def sphere(point, size, pigment, glow=False):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8)
    obj = finish(point, pigment, True, glow)
    obj.scale = coordinate((size[0], size[1], -size[2]))
    return obj


def stone(point, size, pigment, yaw=0):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2)
    obj = finish(point, pigment)
    obj.scale = coordinate((size[0], size[1], -size[2]))
    obj.rotation_euler.z = yaw


def box(point, size, pigment, bevel=.07, yaw=0):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = finish(point, pigment)
    obj.dimensions = coordinate((size[0], size[1], -size[2]))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new('Soft edges', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 2
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.rotation_euler.z = yaw
    return obj


def rod(a, b, radius, pigment, tip=None, sides=12, glow=False):
    start, end = Vector(coordinate(a)), Vector(coordinate(b))
    direction = end-start
    bpy.ops.mesh.primitive_cone_add(vertices=sides, radius1=radius, radius2=radius if tip is None else tip, depth=direction.length)
    obj = finish(tuple((x+y)/2 for x,y in zip(a,b)), pigment, False, glow)
    obj.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
    return obj


def torus(point, radius, thickness, pigment, upright=False, glow=False):
    bpy.ops.mesh.primitive_torus_add(major_segments=24, minor_segments=8, major_radius=radius, minor_radius=thickness)
    obj = finish(point, pigment, True, glow)
    obj.rotation_euler.x = pi/2 if upright else 0


def eyes(x, y, z, spacing=.25):
    for side in (-1, 1):
        p = x+side*spacing
        sphere((p,y,z),(.11,.13,.055),'304251')
        sphere((p-.031,y+.043,z+.044),(.031,.034,.018),'fff7db')


def leaf(point, size, yaw, pigment):
    x,y,z=size
    vertices=[(-x,0,0),(-x*.23,0,z),(x,0,0),(-x*.23,0,-z),(0,y,0),(0,-y*.27,0)]
    faces=[(i,(i+1)%4,4) for i in range(4)]+[((i+1)%4,i,5) for i in range(4)]
    mesh=bpy.data.meshes.new('Folded leaf')
    mesh.from_pydata([coordinate(v) for v in vertices],[],faces)
    mesh.materials.append(material(pigment))
    obj=bpy.data.objects.new('Folded leaf',mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent=PARENT
    obj.location=coordinate(point)
    obj.rotation_euler.z=yaw


def palm():
    points = [(0,0,0),(-.05,1,0),(.12,2.1,0),(.43,3.05,0)]
    for a,b in zip(points,points[1:]):
        rod(a,b,.24,'bd8164',.19,9)
        torus((b[0],b[1]-.22,0),.195,.028,'9f644c')
    for j in range(8):
        t=j*pi/4
        u,v=cos(t),sin(t)
        leaf=sphere((.43+.84*u,3.13,.84*v),(.95,.125,.32),['62a877','48936d','85ba76'][j%3])
        leaf.rotation_euler.z=-t
        rod((.43,3.19,0),(.43+1.43*u,3.21,1.43*v),.022,'acc87d',.012)
    for x,z in ((.2,.18),(.57,.2),(.56,-.21)):
        sphere((x,2.96,z),(.15,.15,.15),'9c6b52')


def lighthouse():
    rod((0,0,0),(0,.37,0),1.35,'bca490',1.18)
    for level in range(6):
        r=1.07-level*.085
        rod((0,.31+level*.71,0),(0,1.02+level*.71,0),r,'e98779' if level%2 else 'fff1d9',r-.083)
    box((0,.52,.93),(.54,1.0,.13),'5e8791',.19)
    box((-.06,2.42,.86),(.26,.37,.12),'6a8f94',.07)
    rod((0,4.57,0),(0,4.8,0),.9,'5f9ca2')
    rod((0,4.8,0),(0,5.47,0),.57,'ffd07d',glow=True)
    with group('idle_lens',(0,5.1,0)):
        rod((0,0,-.64),(0,0,.64),.19,'fff2ad',glow=True)
        torus((0,0,.64),.25,.045,'ffbd74',True)
    for i in range(8):
        x,z=.60*cos(i*pi/4),.60*sin(i*pi/4)
        rod((x,4.78,z),(x,5.5,z),.032,'fcf1d8')
    rod((0,5.49,0),(0,6.32,0),.79,'ce766a',.065)
    sphere((0,6.34,0),(.12,.12,.12),'ffe0a1',True)


def crab():
    shell='ed876e'
    sphere((0,.51,0),(.54,.36,.36),shell)
    sphere((0,.43,.21),(.39,.24,.20),'ffac86')
    for s in (-1,1):
        for z in (-.17,.01,.18):
            rod((s*.30,.39,z),(s*.59,.22,z+.03),.065,'cc685d')
            rod((s*.59,.22,z+.03),(s*.65,.09,z+.13),.056,'cc685d')
        with group(f'idle_claw_{s}',(s*.35,.55,.06)):
            rod((0,0,0),(s*.25,.19,.12),.083,shell)
            sphere((s*.31,.25,.13),(.19,.22,.17),shell)
            sphere((s*.40,.39,.14),(.105,.11,.13),'f99d7a')
        rod((s*.22,.66,.12),(s*.23,.93,.20),.07,shell)
        sphere((s*.23,.94,.24),(.15,.16,.12),'ffebd0')
    eyes(0,.95,.34,.23)
    sphere((0,.48,.397),(.095,.045,.025),'8d5859')


def chest():
    box((0,.31,0),(1.58,.61,1.03),'be7951',.12)
    box((0,.63,0),(1.67,.11,1.11),'9e614d',.06)
    for s in (-1,1):
        box((s*.57,.31,.51),(.14,.63,.065),'efc46a',.03)
    with group('effect_chest',(0,.66,-.51)):
        box((0,.10,.51),(1.64,.26,1.06),'cf8e57',.12)
        for s in (-1,1):
            box((s*.57,.244,.51),(.14,.045,1.04),'f4c971',.018)
        box((0,.06,1.07),(.26,.24,.07),'eac674',.06)
        sphere((0,.06,1.113),(.045,.06,.021),'80644f')
    with group('prize_chest'):
        sphere((0,.83,.05),(.27,.27,.27),'fff0ae',True)
        torus((0,.87,.05),.40,.032,'ffd478',False,True)
        for i,pigment in enumerate(('e5a7b4','e9ba70','89d8e2')):
            t=(i-1)*.78
            sphere((.57*sin(t),.70,.56*cos(t)),(.11,.08,.15),pigment,True)


def umbrella():
    rod((0,0,0),(0,2.06,0),.057,'e5c38b')
    for i in range(10):
        a,b=(i-.5)*pi/5,(i+.5)*pi/5
        for c,d in ((a,(a+b)/2),((a+b)/2,b)):
            rod((0,2.1,0),(1.22*cos(c),1.80,1.22*sin(c)),.039,'e0af81')
            verts=[coordinate(v) for v in [(0,2.12,0),(1.26*cos(c),1.78,1.26*sin(c)),(1.26*cos(d),1.78,1.26*sin(d))]]
            mesh=bpy.data.meshes.new('Canvas');mesh.from_pydata(verts,[],[(0,1,2),(2,1,0)])
            obj=bpy.data.objects.new('Canvas',mesh);bpy.context.collection.objects.link(obj);obj.parent=PARENT
            mesh.materials.append(material('e98f77' if i%2 else 'fff1cc'))
    sphere((0,2.14,0),(.09,.09,.09),'f2c774')


def hut():
    box((0,.19,0),(2.9,.33,2.26),'ba8b65',.12)
    box((0,1.0,-.13),(2.56,1.67,1.88),'7fb6b1',.15)
    box((0,.91,.84),(1.65,.77,.14),'f2ce98',.09)
    box((0,1.38,.85),(1.51,.63,.07),'527d84',.09)
    box((0,1.03,1.03),(1.8,.13,.43),'f0bc87',.05)
    for i in range(8):
        r=1.38-i*.135
        box((0,1.83+i*.095,0),(r*2,.18,1.98-i*.09),'e58d74' if i%2 else 'eda78a',.08)
    rod((-1.1,1.57,1),(-1.1,.24,1),.083,'e4b888')
    rod((1.1,1.57,1),(1.1,.24,1),.083,'e4b888')
    torus((1.1,1.39,1.02),.24,.059,'f7c282',True)


def shell(theme):
    base, *blades = {
        'rose': ('e6a6ae','f9d0c5','eda7a0','f0b2ad'),
        'gold': ('e5a76c','ffe4a0','f2c078','f0b881'),
        'blue': ('7cb8c3','bfeced','8bd1d9','a2d9e7'),
    }[theme]
    sphere((0,.14,0),(.28,.125,.22),base)
    for i in range(7):
        angle=(i-3)*.25
        blade=sphere((.17*sin(angle),.22,-.06+.13*cos(angle)),(.078,.11,.20),blades[i%3])
        blade.rotation_euler.z=angle


def wreck():
    for y in range(6):
        for x in range(-4,5):
            edge=(x/4)**2
            for side in (-1,1):
                box((x*.54,.17+y*.17+edge*.42,side*(.36+y*.105)*(1-.52*edge)),(.59,.21,.15),['b4815b','a87258','cb9a70'][y%3],.055,side*x*.04)
    rod((0,.3,0),(.48,3.95,-.15),.16,'8f6b58',.085)
    rod((-.92,2.9,-.06),(1.36,3.22,-.10),.075,'a57c5f')
    for i in range(5):
        h=1.18-i*.11
        box((-0.63+i*.38,2.54+h*.15,-.05),( .39,h,.055),'efdfbd' if i%2 else 'f0c2a0',.025)


def fern():
    for i in range(7):
        t=i*2*pi/7
        u,v=cos(t),sin(t)
        rod((0,0,0),(u*.96,.89,v*.96),.029,'61832d',.013)
        for j in range(1,5):
            s=j*.18
            for side in (-1,1):
                leaf((u*s-v*.12*side,s+.16,v*s+u*.12*side),(.26-.028*j,.052,.073),-t-side*.66,['86a94b','659949','abc35e'][(i+j)%3])


def cliff():
    for x,y,z,h,r,pigment in [(-.9,0,.1,2.45,.92,'bf795f'),(.28,0,.1,3.0,1.02,'da9470'),(.92,0,-.36,2.1,.82,'b56f56'),(-1.2,0,-.44,1.3,.64,'e5a47b')]:
        for j in range(4):
            rod((x,h*j/4,z),(x+.09,h*(j+1)/4,z),r*(1-j*.09),pigment if j%2 else 'd59673',r*(.94-j*.09),7)
        stone((x+.05,h,z),(r*.72,.27,r*.75),'db9c76',x)


def cave(arch=False):
    for side in (-1,1):
        for j in range(4):
            stone((side*(1.52-j*.09),.39+j*.62,-.07),(1.0-j*.09,.72,.72),['b67962','e4a178','c48160','d89774'][j],j*.2)
    with group('cover_cave'):
        stone((0,2.83,0),(1.73,.70,.65),'ca8969',.07)
        if not arch:
            box((0,2.54,-1.03),(2.59,.52,2.1),'a87864',.16)
    if not arch:
        box((0,1.27,-2.17),(3.10,2.48,.54),'6c5756',.23)
        for s in (-1,1):
            stone((s*1.6,.79,-1.28),(.72,1.13,1.12),'a9715c',s*.44)
            stone((s*1.48,1.85,-1.51),(.70,1.1,.98),'bb8366',s*.37)
            for i in range(3):
                rod((s*(.90+i*.17),.02,-.71-i*.34),(s*(1+i*.17),.54+i*.25,-.71-i*.34),.13,'ffc66b',.0,5,True)


def dino(long_neck=False):
    skin, belly=('7eb8a0','b7d2a1') if long_neck else ('e5a86f','f9d392')
    sphere((0,.83,0),(.60,.58,.88),skin)
    sphere((0,.64,.33),(.54,.39,.60),belly)
    for x in (-.41,.41):
        for z in (-.46,.43):
            sphere((x,.33,z),(.216,.35,.25),skin)
            sphere((x,.102,z+.06),(.234,.115,.27),skin)
            for n in (-1,0,1):
                sphere((x+n*.091,.101,z+.296),(.04,.045,.037),belly)
    with group('idle_tail',(0,.80,-.47)):
        rod((0,0,0),(0,-.17,-1.01),.30,skin,.08)
    if long_neck:
        for a,b,r in [((0,.95,.41),(0,1.65,.59),.32),((0,1.65,.59),(0,2.47,.78),.27),((0,2.47,.78),(0,2.92,1.02),.24)]:
            rod(a,b,r,skin,r-.035)
            sphere(b,(r,r,r),skin)
        cy,cz=2.98,1.18
    else:
        cy,cz=1.16,.68
        sphere((0,cy+.15,cz-.15),(.65,.51,.24),'c0806c')
        for j in range(7):
            t=j*pi/6
            sphere((.61*cos(t),cy+.15+.46*sin(t),cz+.015),(.074,.087,.057),belly)
    with group('idle_head',(0,cy,cz)):
        sphere((0,0,0),(.47,.38,.39),skin)
        sphere((0,-.13,.27),(.35,.23,.24),belly)
        eyes(0,.065,.335,.24)
        for s in (-1,1):
            sphere((s*.25,-.105,.37),(.077,.044,.038),'e9a583')
            if not long_neck:
                rod((s*.27,.27,.23),(s*.31,.48,.40),.092,'ffdcac',.008)


def fossil(board=False, part='ribs'):
    height=.14 if not board else 1.08
    if board:
        box((0,.97,0),(2.65,1.51,.25),'b38366',.15)
        box((0,.97,.15),(2.40,1.29,.08),'526a65',.12)
        for s in (-1,1):rod((s*1.02,0,-.03),(s*1.02,1.55,-.03),.105,'a37955')
        box((0,1.67,.08),(2.73,.17,.49),'d8a670',.07)
        for x in (-.67,.07,.69):
            torus((x,1.05,.201),.19,.015,'95ae8c',True)
    else:
        sphere((0,.035,0),(1.05,.10,.79),'ba9272')
    with group('prize_fossil-board' if board else 'bones'):
        color='fae0aa'
        if board:
            with group('assemble_head',(-.66,height+.17,.24)):
                sphere((0,0,0),(.32,.22,.09),color)
                sphere((-.07,.06,.075),(.085,.08,.035),'65585b')
            with group('assemble_ribs',(.02,height,.25)):
                rod((-.45,0,0),(.39,0,0),.055,color,.044)
                for j in range(6):
                    x=-.36+j*.131
                    rod((x,0,0),(x+.04,-.24+.018*j,.02),.039,color)
            with group('assemble_tail',(.40,height,.25)):
                rod((0,0,0),(.68,.17,0),.044,color,.014)
                for i in range(4):sphere((i*.14,.04*i,.016),(.073-i*.012,.062,.047),color)
        elif part=='head':
            sphere((-.11,.16,0),(.43,.13,.36),color)
            sphere((.29,.145,0),(.35,.10,.21),color)
            for z in (-.17,.17):sphere((-.09,.248,z),(.095,.037,.073),'a5836b')
        elif part=='tail':
            for i in range(7):
                x=(i-3)*.21
                sphere((x,.13,.45*x*x),(.15-i*.012,.087-i*.007,.135-i*.009),color)
        else:
            for j in range(6):
                t=j*pi/5
                rod((0,height,0),(.62*cos(t),height,.43*sin(t)),.049,color)


def gear(x,y,z,r,pigment):
    rod((x,y,z-.073),(x,y,z+.073),r*.86,pigment,sides=16)
    for j in range(10):
        t=j*pi/5
        obj=box((x+r*.91*cos(t),y+r*.91*sin(t),z),(.20*r,.29*r,.19),pigment,.035)
        obj.rotation_euler.y=-t
    torus((x,y,z+.1),r*.51,.034,'ffe0ac',True)
    sphere((x,y,z+.12),(r*.18,r*.18,.08),'79758d')


def workshop(paint, kind):
    box((0,.20,0),(4.15,.34,2.75),'a48b9d',.13)
    box((0,1.38,0),(3.82,2.46,2.47),paint,.19)
    box((0,2.53,0),(4.12,.32,2.71),'f2d9ac',.15)
    roof={'press':'a56370','optic':'618795','coil':'9b79a7','clock':'81a18f'}[kind]
    box((0,2.77,0),(3.81,.32,2.47),roof,.16)
    for s in (-1,1):
        box((1.15*s,1.62,1.25),(.81,.87,.11),'f8e0b5',.14)
        box((1.15*s,1.62,1.31),(.62,.67,.10),'739daf',.11)
        box((1.15*s,1.62,1.38),(.043,.61,.05),'e2d7b0',.02)
    box((0,.81,1.26),(.93,1.46,.17),'686a86',.17)
    sphere((.27,.77,1.38),(.063,.063,.061),'f9ca82')
    if kind=='optic':
        torus((0,2.42,1.41),.28,.063,'f3d293',True)
        rod((0,2.42,1.37),(0,2.42,1.45),.23,'8fd1d7',glow=True)
        rod((0,2.87,.10),(.55,3.83,-.23),.21,'c58a86',.36)
    elif kind=='coil':
        for y in (2.25,2.37,2.49):torus((0,y,1.43),.22,.028,'a07c9e')
        sphere((0,3.42,0),(.29,.31,.29),'d5b9ee',True)
        rod((0,2.89,0),(0,3.42,0),.055,'827c9a')
    elif kind=='clock':
        torus((0,2.43,1.39),.28,.037,'f2d49d',True)
        rod((0,2.43,1.41),(.13,2.56,1.41),.034,'69817e')
        rod((0,2.43,1.41),(-.13,2.46,1.41),.034,'69817e')
    else:
        gear(0,2.43,1.39,.32,'eccc91')
    for j in range(8):
        box((-.98+j*.28,1.93,1.48),(.29,.08,.45),roof if j%2 else 'f3d4a4',.04)
    for x in (-1.17,1.13):
        rod((x,2.86,-.55),(x,3.66,-.55),.19,'c6887e')
        torus((x,3.61,-.55),.20,.052,'f0c488')


def robot(large=False):
    with group('effect_automaton' if large else 'character'):
        palette=('a396bf','e7ae82') if large else ('79b7b9','f7c390')
        steel,trim=palette
        for s in (-1,1):
            box((s*.24,.13,0),(.37,.25,.46),trim,.10)
            rod((s*.22,.16,-.03),(s*.22,.43,-.03),.105,'8184a3')
            box((s*.57,.69,.01),(.23,.47,.26),steel,.085)
            sphere((s*.55,.45,.03),(.13,.13,.14),trim)
        box((0,.67,0),(.93,.68,.60),steel,.16)
        box((0,.67,.305),(.47,.32,.056),'f0d4aa',.09)
        sphere((0,.68,.344),(.079,.079,.032),'f49881',large)
        box((0,1.33,.02),(1.03,.61,.66),trim,.20)
        box((0,1.34,.35),(.80,.39,.07),'64758e',.15)
        for s in (-1,1):
            sphere((s*.20,1.36,.40),(.075,.09,.036),'fff0b3',True)
        box((0,1.25,.396),(.16,.032,.015),'dce6d5',.014)
        rod((0,1.57,0),(0,1.91,0),.043,'7c7691')
        sphere((0,1.93,0),(.10,.10,.10),'f7c687',True)


def clock():
    box((0,.21,0),(3.33,.35,2.37),'aa96ac',.13)
    box((0,1.78,0),(2.60,3.40,1.96),'df9e91',.19)
    box((0,.94,1.01),(1.20,1.48,.12),'797994',.26)
    for x in (-.97,.97):
        box((x,1.77,1.03),(.21,2.85,.14),'f1caa5',.08)
    rod((0,3.36,0),(0,5.09,0),1.63,'9291b2',.10,4)
    torus((0,2.67,1.035),.70,.088,'f6cd92',True)
    rod((0,2.67,1.01),(0,2.67,1.11),.62,'f7e5c5',sides=24)
    for i in range(12):
        t=i*pi/6
        sphere((.49*cos(t),2.67+.49*sin(t),1.138),(.036,.036,.022),'9e7992')
    rod((0,2.67,1.15),(.31,2.78,1.15),.037,'757291')
    rod((0,2.67,1.15),(-.14,2.99,1.15),.032,'757291')


def console(theme):
    box((0,.18,0),(1.23,.31,1.00),'9184a2',.11)
    box((0,.60,0),(.93,.71,.72),'c0a3be',.16)
    box((0,.97,0),(1.28,.33,.87),'e4ae8c',.12)
    box((-.15,1.145,0),(.55,.045,.51),'6e859b',.07)
    if theme=='pressure':
        torus((-.20,1.43,.10),.25,.040,'e8c693',True)
        rod((-.20,1.43,.04),(-.20,1.43,.12),.218,'f0d6aa',sides=20)
        with group('dial_pressure',(-.20,1.43,.17)):
            rod((0,0,0),(-.13,.10,0),.027,'9b6d80')
    elif theme=='coil':
        rod((-.16,1.12,0),(-.16,1.88,0),.087,'8b80a7')
        for i in range(5):torus((-.16,1.17+i*.127,0),.191,.042,'c991a0')
        sphere((-.16,1.86,0),(.16,.16,.16),'d5c1ef',True)
    else:
        for z in (-.24,0,.24):
            box((-.16,1.188,z),(.25,.081,.16),'efd3a5',.025)
    with group('prize_'+theme):
        for z in (-.19,0,.19):
            sphere((.34,1.17,z),(.086,.042,.08),'bbdf9b',True)


def garnish(kind):
    if kind=='sandstone':
        stone((0,.43,0),(1.03,.63,.65),'d8b28c',.4)
        stone((-.4,.25,.23),(.58,.39,.47),'e9c39d',.8)
    elif kind=='jetty':
        for i in range(9):
            z=i*.33
            box((0,.24,z),(1.19,.13,.31),'b58a65',.04)
            if i%4==0:
                for s in (-1,1):rod((s*.54,-.36,z),(s*.54,.66,z),.082,'9c765e')
    elif kind=='buoy':
        sphere((0,0,0),(.30,.28,.30),'f49f82')
        torus((0,.02,0),.285,.038,'fbe0ad')
    elif kind=='eggs':
        torus((0,.13,0),.63,.12,'af8865')
        for i,p in enumerate(((-.28,.32,0),(.23,.34,-.17),(.24,.33,.23))):
            sphere(p,(.20,.30,.20),['f0d39c','c2d1a1','e0bc92'][i])
    elif kind=='tracks':
        for x,z in ((-.22,-.62),(.23,.2),(-.14,.88)):
            for side in (-1,0,1):
                sphere((x+side*.12,.023,z+abs(side)*.08),(.088,.017,.18),'b19168')
    elif kind=='gear-fountain':
        rod((0,0,0),(0,.24,0),1.22,'aa9db8')
        rod((0,.25,0),(0,.30,0),1.04,'83bad1',glow=True)
        torus((0,.28,0),1.07,.14,'e6c4aa')
        box((0,.71,0),(.39,1.02,.48),'a18eae',.13)
        with group('spin_fountain',(-.49,1.48,.13)):gear(0,0,0,.63,'d49c85')
        with group('spin_fountain_reverse',(.43,1.06,.13)):gear(0,0,0,.45,'efc683')
    elif kind=='lamp':
        rod((0,0,0),(0,2.16,0),.063,'83839e')
        sphere((0,2.14,0),(.22,.26,.22),'ffdfa0',True)
        rod((0,2.29,0),(0,2.52,0),.30,'a293af',.07)
    elif kind=='planter':
        box((0,.28,0),(1.32,.54,.91),'bd9eab',.13)
        for i in range(5):
            sphere((-.49+i*.25,.64,sin(i)*.12),(.23,.25,.31),['84b3a0','95ba9c','aecca3'][i%3])
    elif kind=='vent':
        rod((0,0,0),(0,.58,0),.50,'a68eab')
        torus((0,.59,0),.47,.079,'e1ad90')
        for x in (-.2,0,.2):box((x,.56,0),(.073,.08,.7),'736e89',.026)
    elif kind=='canal-bridge':
        for j in range(11):box((j*.38-1.9,.18,0),(.35,.18,1.8),'c89386',.038)
    elif kind=='automaton':
        rod((0,0,0),(0,.34,0),1.35,'aa9ab9')
        rod((0,.33,0),(0,.47,0),1.24,'e3c1a3')
        for s in (-1,1):
            rod((s*1.14,.26,-.54),(s*1.14,2.15,-.54),.085,'a076a6')
            sphere((s*1.14,2.21,-.54),(.145,.16,.14),'f8cc8b',True)
        rod((-1.14,2.15,-.54),(1.14,2.15,-.54),.05,'e5bb83')
        with group('prize_automaton'):
            torus((0,.48,0),1.15,.046,'ffd37e',glow=True)
        with group('stage',(0,.49,0)):robot(True)


def beach_detail(kind):
    if kind=='dune-plants':
        for i in range(10):
            t=i*2.4
            r=.22+.083*i
            x,z=r*cos(t),r*sin(t)
            for j in range(3):
                leaf((x+.07*cos(j*2),.13+j*.026,z+.07*sin(j*2)),(.18,.10+j*.042,.075),t+j*.8,['639e7b','8fb97e','b8ca81'][j])
            if i%3==0:sphere((x,.19,z),(.061,.066,.061),'e6a3a0')
    elif kind=='packing':
        for x,z,yaw in ((-.39,.14,.21),(.31,-.21,-.2)):
            box((x,.25,z),(.61,.48,.57),'ba805a',.068,yaw)
            for y in (.14,.34):box((x,y,z+.286),(.58,.047,.052),'d3a177',.014,yaw)
        torus((.28,.49,-.19),.21,.041,'dec18e')
        torus((.25,.51,-.18),.142,.031,'b19a70')
    elif kind=='pennant':
        for s in (-1,1):
            rod((s*1.38,0,0),(s*1.38,2.31,0),.067,'af8065')
            sphere((s*1.38,2.35,0),(.094,.11,.094),'f1ce94')
        for i in range(7):
            x=-1.2+i*.40
            y=1.94+.19*x*x
            rod((x-.21,y+.08,0),(x+.22,y,0),.024,'e8cc95')
            box((x,y-.10,.019),(.22,.26,.033),('d87978','68b6b9','f5cf94')[i%3],.025,i*.035)
    elif kind=='tide-pool':
        sphere((0,.025,0),(1.36,.07,.99),'b4e1db')
        sphere((.04,.073,-.05),(1.11,.044,.79),'6fc4c9')
        for i in range(10):
            t=i*pi*.2
            if i%4!=1:
                stone((1.25*cos(t),.15,.86*sin(t)),(.26,.17,.20),('e0bc96','cba88b','ecc99f')[i%3],t)
        for i in range(5):
            t=i*pi*.4
            rod((-.37,.135,.06),(-.37+.23*cos(t),.136,.06+.23*sin(t)),.04,'eb9b8c',.009,7)
    elif kind=='snail':
        sphere((0,.13,0),(.36,.16,.18),'d09b6c')
        sphere((-.08,.28,-.02),(.24,.26,.22),'ebb183')
        torus((-.09,.28,.156),.126,.025,'bd7963',True)
        for z in (-.085,.085):rod((.22,.19,z),(.25,.32,z),.024,'b3815e')


def dino_detail(kind):
    if kind=='cycad':
        rod((0,0,0),(0,.92,0),.26,'9c744d',.17,9)
        for j in range(5):torus((0,.14+j*.15,0),.23-j*.012,.029,'b28956')
        for ring in range(2):
            for i in range(7):
                t=i*pi*2/7+ring*.45
                r=.55-ring*.17
                leaf((r*cos(t),.94+ring*.28,r*sin(t)),(.67-ring*.16,.20,.23),-t,['538560','739d63','96af6c'][i%3])
    elif kind=='horsetail':
        for i in range(9):
            t=i*2.4
            r=.16+i*.069
            x,z=r*cos(t),r*sin(t)
            h=.39+(1-i/10)*.54
            rod((x,0,z),(x*1.2,h,z*1.24),.041,'7c9556',.023,7)
            for j in (1,2,3):
                y=j*h/4
                for k in (0,1,2):
                    a=t+k*pi*2/3
                    leaf((x+.13*cos(a),y,z+.13*sin(a)),(.14,.04,.028),-a,'91aa65')
    elif kind=='strata':
        for j in range(5):
            rod((0,j*.43,0),(j*.033,.43+j*.43,.04),1.35-j*.14,['c48860','e4a979','b1785a','dfa071','edbe89'][j],1.29-j*.14,9)
        stone((.12,2.11,.05),(.68,.34,.63),'c99670',.33)
        for x,z in ((-.7,.65),(-.94,-.47),(.64,.68)):
            stone((x,.14,z),(.41,.25,.32),'b49a73',x)
    elif kind=='amber':
        for i in range(5):
            t=i*2.4
            r=i*.14
            x,z=r*cos(t),r*sin(t)
            rod((x,0,z),(x+.13,.59+i*.16,z+.083),.16,'efbb5f' if i%2 else 'ffc66e',0,5,True)
    elif kind=='trail-sign':
        rod((0,0,0),(0,1.21,0),.062,'a57b53')
        box((0,1.06,0),(.62,.32,.085),'dfab71',.08)
        for s in (-1,0,1):sphere((s*.09,1.08+abs(s)*.026,.05),(.043,.077,.018),'775f53')


def city_detail(kind):
    if kind=='market':
        box((0,.14,0),(2.83,.25,1.47),'b89187',.07)
        box((0,.61,0),(2.57,.87,.94),'b28392',.11)
        box((0,1.07,0),(2.78,.12,1.22),'edc59b',.065)
        for s in (-1,1):
            rod((s*1.21,0,-.48),(s*1.21,2.12,-.48),.066,'8c7899')
            rod((s*1.21,0,.48),(s*1.21,1.85,.48),.066,'8c7899')
        for i in range(8):
            roof=box((i*.337-1.18,2.02,0),(.34,.09,1.25),'d88e91' if i%2 else 'f5d8a9',.045)
            roof.rotation_euler.x=.20
        for x,paint in ((-.85,'76aaa6'),(-.24,'d08b84'),(.46,'a991b0')):
            gear(x,1.30,.16,.20,paint)
    elif kind=='post':
        rod((0,0,0),(0,1.66,0),.056,'7a7895')
        for y,turn,paint in ((1.37,.11,'d59793'),(1.11,-.14,'8eadae')):
            box((.03,y,.055),(.75,.20,.087),paint,.055,turn)
            rod((.12,y,.103),(.30,y,.103),.030,'f4d893')
    elif kind=='cable-lamp':
        for i in range(9):
            x=i*.42-1.69
            h=2.22+.41*(x/1.70)**2
            if i:
                u=x-.42
                rod((u,2.22+.41*(u/1.70)**2,0),(x,h,0),.017,'927c8d',sides=7)
            if i%2:sphere((x,h-.068,0),(.089,.11,.078),['ebaa9c','f4dca4','c5d8c5'][i%3],True)
    elif kind=='industrial':
        box((0,.19,0),(1.66,.35,1.02),'ad8ba2',.14)
        rod((-.37,.30,0),(-.37,1.37,0),.30,'cf9589')
        torus((-.37,1.33,0),.277,.054,'f5cd99')
        rod((.39,.3,0),(.39,1.08,0),.28,'858ea6')
        torus((.39,1.04,0),.249,.042,'c6b5bd')
        gear(.04,.72,.48,.23,'ebb87d')
    elif kind=='delivery':
        box((0,.14,0),(1.30,.25,.75),'9fa0b4',.064)
        box((.11,.38,0),(1.11,.29,.67),'c58683',.089)
        for x in (-.41,.42):
            for s in (-1,1):rod((x,.145,s*.23),(x,.145,s*.41),.142,'738194',sides=12)
        box((-.23,.55,0),(.34,.19,.48),'dcbb88',.05)


def export(key, models):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for name, build in models.items():
        with group(name):
            build()
    # Join static mesh pieces by pigment within each transform or animation pivot.
    for root in [obj for obj in bpy.context.scene.objects if obj.type=='EMPTY']:
        by_material = {}
        for obj in root.children:
            if obj.type=='MESH':
                by_material.setdefault(obj.data.materials[0].name, []).append(obj)
        for objects in by_material.values():
            if len(objects)<2:
                continue
            bpy.ops.object.select_all(action='DESELECT')
            for obj in objects:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = objects[0]
            bpy.ops.object.join()
    bpy.ops.export_scene.gltf(filepath=str(OUT / f'{key}.glb'), export_format='GLB', export_animations=False)


if __name__ == '__main__':
    export('praia',dict(lighthouse=lighthouse,crab=crab,chest=chest,hut=hut,wreck=wreck,umbrella=umbrella,palm=palm,
                        **{f'shell-{key}':lambda key=key:shell(key) for key in ['rose','gold','blue']},
                        **{key:lambda key=key:garnish(key) for key in ['sandstone','jetty','buoy']},
                        **{key:lambda key=key:beach_detail(key) for key in ['dune-plants','packing','pennant','tide-pool','snail']}))
    export('dinossauros',{'sauropod':lambda:dino(True),'trico':dino,'cave':cave,'arch':lambda:cave(True),'fossil-board':lambda:fossil(True),
                         **{f'fossil-{key}':lambda key=key:fossil(part=key) for key in ['head','ribs','tail']},
                         'cliff':cliff,'fern':fern,**{key:lambda key=key:garnish(key) for key in ['eggs','tracks']},
                         **{key:lambda key=key:dino_detail(key) for key in ['cycad','horsetail','strata','amber','trail-sign']}})
    export('inventores',{'clock':clock,'robot':robot,
                        **{f'console-{key}':lambda key=key:console(key) for key in ['pressure','coil','commands']},
                        **{f'workshop-{key}':lambda pigment=pigment,kind=kind:workshop(pigment,kind)
                           for key,pigment,kind in [('red','df9c91','press'),('blue','94b5c6','optic'),('yellow','e8ba8f','coil'),('mint','98bba3','clock')]},
                        **{key:lambda key=key:garnish(key) for key in ['gear-fountain','automaton','lamp','planter','vent','canal-bridge']},
                        **{key:lambda key=key:city_detail(key) for key in ['market','post','cable-lamp','industrial','delivery']}})
