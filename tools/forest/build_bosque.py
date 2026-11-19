"""Author the Bosque das Bainhas library. Run with Blender 4.5 in background mode."""
import math
import random
from pathlib import Path

import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parents[2] / "assets" / "forest"
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

material = bpy.data.materials.new("Pigmentos do Bosque")
material.use_nodes = True
nodes = material.node_tree.nodes
primer = nodes.get("Principled BSDF")
primer.inputs["Roughness"].default_value = .73
pigment = nodes.new("ShaderNodeVertexColor")
pigment.layer_name = "Pigmento"
material.node_tree.links.new(pigment.outputs["Color"], primer.inputs["Base Color"])


def linear(value):
    return ((value + .055) / 1.055) ** 2.4 if value > .04045 else value / 12.92


def paint(hex_code, tone):
    return tuple(linear(min(1, int(hex_code[i:i+2], 16) / 255 * tone)) for i in (0, 2, 4)) + (1,)


class Sculpture:
    def __init__(self, name):
        self.name = name
        self.points, self.faces, self.pigments = [], [], []

    def surface(self, points, faces, colors):
        start = len(self.points)
        self.points.extend(points)
        self.faces.extend(tuple(start + i for i in face) for face in faces)
        self.pigments.extend(colors)

    def rings(self, rings, colors, close=True):
        n = len(rings[0])
        faces = [(j*n+i, j*n+(i+1)%n, (j+1)*n+(i+1)%n, (j+1)*n+i)
                 for j in range(len(rings)-1) for i in range(n)]
        if close:
            faces += [tuple(reversed(range(n))), tuple(range((len(rings)-1)*n, len(rings)*n))]
        self.surface([p for row in rings for p in row], faces, [c for row in colors for c in row])

    def grain(self, line, radii, hues, ribs=12):
        rings, colors = [], []
        for j, center in enumerate(line):
            tangent = Vector(line[min(j+1, len(line)-1)]) - Vector(line[max(j-1, 0)])
            across = tangent.cross(Vector((0, 1, 0))).normalized()
            other = tangent.normalized().cross(across)
            ring = []
            for i in range(ribs):
                phase = math.tau * i / ribs
                wedge = 1 + .13 * math.sin(i * 2.04 + .28*j) + .06 * math.sin(i * 4.3 - j*.51)
                ring.append(Vector(center) + radii[j] * wedge *
                            (across * math.cos(phase) + other * math.sin(phase)))
            rings.append(ring)
            colors.append([paint(hues[i % len(hues)], .77 + .051*j + .13*math.cos(i*2.7+j*.4))
                           for i in range(ribs)])
        self.rings(rings, colors)

    def blade(self, base, tip, width, hue, wave=.08):
        base, tip = Vector(base), Vector(tip)
        direction = tip-base
        side = Vector((-direction.y, direction.x, 0)).normalized() * width
        points = [base, base+.34*direction-side, base+.68*direction-.76*side,
                  tip, base+.68*direction+.76*side, base+.34*direction+side,
                  base+.47*direction+Vector((0, 0, wave))]
        self.surface(points, [(i, (i+1)%6, 6) for i in range(6)],
                     [paint(hue, t) for t in (.75, .91, .98, 1.22, 1.02, .86, 1.12)])

    def export_mesh(self, smooth=True):
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.points, [], self.faces)
        mesh.update()
        attr = mesh.color_attributes.new(name="Pigmento", type="FLOAT_COLOR", domain="POINT")
        for i, color in enumerate(self.pigments):
            attr.data[i].color = color
        mesh.materials.append(material)
        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.collection.objects.link(obj)
        for poly in mesh.polygons:
            poly.use_smooth = smooth
        return obj


BARK = ("79513c", "4d392c", "926246", "593e32", "a66c49", "6d5136", "473b32")
OAK = [(0, 0, -.26), (-.15, -.05, .72), (-.30, -.11, 1.84), (-.11, -.13, 3.16),
       (-.38, -.23, 4.24), (-.65, -.36, 5.43)]
ALDER = [(0, 0, -.23), (.12, .02, .76), (.28, .10, 1.83), (.22, .15, 3.18),
         (.40, -.22, 4.43), (.72, -.51, 5.68)]
HAZEL = [(0, 0, -.24), (.04, -.08, .58), (.47, -.26, 1.46), (.82, -.42, 2.48),
         (.97, -.72, 3.46), (1.45, -.80, 4.89)]
BOUGHS = [
    ([(-.2, -.1, 2.25), (-.94, -.33, 3.05), (-1.46, -.77, 3.76), (-2.38, -.70, 4.16)], [.22, .15, .10, .033]),
    ([(-.2, -.1, 3.04), (.53, .16, 3.57), (1.03, .63, 4.24), (1.94, 1.08, 4.36)], [.23, .16, .098, .033]),
    ([(-.24, -.18, 3.83), (-.08, -.94, 4.32), (.51, -1.35, 4.96)], [.17, .098, .025]),
    ([(-.36, -.14, 4.04), (-.83, .66, 4.58), (-1.45, 1.37, 5.17)], [.16, .095, .028]),
]
CROWN = [(-2.08, -.7, 4.67, 1.25, 1.19, .70), (-1.11, -.96, 4.94, 1.29, 1.21, .89),
         (.40, -1.32, 5.17, 1.42, 1.10, .76), (1.49, .98, 4.99, 1.28, 1.35, .77),
         (-1.20, 1.04, 5.42, 1.65, 1.34, 1.08), (-.16, .06, 5.93, 1.47, 1.36, 1.05)]


def crown_lobe(model, center, scales, hue, seed, tuft=False):
    x, y, z = center
    sx, sy, sz = scales
    rings, colors = [], []
    outline = [(-1, .08), (-.83, .52), (-.54, .86), (-.10, 1), (.38, .91), (.75, .69), (1, .21),
               (.96, -.28), (.63, -.71), (.16, -.89), (-.35, -.88), (-.80, -.57)]
    rng = random.Random(seed)
    for j, (h, radius, offset) in enumerate([(-.86,.30,-.12), (-.39,.83,.04), (.14,1,.02),
                                             (.66,.77,-.12), (.97,.30,-.22)]):
        rows = [(x+sx*(u*radius+offset+rng.uniform(-.032,.032)),
                 y+sy*(v*radius+.085*math.sin(j+2*u)),
                 z+sz*(h+.057*math.sin(i*2.3+j*.88))) for i, (u,v) in enumerate(outline)]
        rings.append(list(reversed(rows)))
        colors.append([paint(hue, .83+j*.084+.042*math.sin(i*1.71+seed)+rng.uniform(-.04,.04))
                       for i in range(len(rows))])
        if tuft and j in (1, 2, 3):
            for i, (px, py, pz) in enumerate(rows):
                u, v = outline[i]
                if (i+j+seed)%3 == 0:
                    continue
                model.blade((px-u*.33, py-v*.33, pz+.17),
                            (px+u*.24, py+v*.24, pz-.13), .14, hue, .11)
    model.rings(rings, colors)


def tree(kind, trunk, variant):
    stem, leaves, tips, economy = (Sculpture(kind+s) for s in ("_Tronco","_Copa","_Pontas","_Copa_economica"))
    bark = BARK if variant == 0 else ("99785a", "685343", "b49b70", "5c4d3d", "8e7460")
    if variant == 2:
        bark = ("82634e", "694b45", "997160", "b78b61", "70604c")
    stem.grain(trunk, [.64, .38, .30, .23, .15, .047], bark, 16)
    for x,y in [(-1.64,-.30), (1.17,.78), (.60,-1.32), (-.82,1.01), (.10,1.56)]:
        stem.grain([trunk[1], (x*.42,y*.42,.19), (x*.77,y*.77,.07), (x,y,-.13)],
                   [.23,.20,.116,.022], bark, 9)
    sway = (1,-.75,1)[variant]
    boughs=BOUGHS if variant!=2 else [
        ([(.47,-.26,1.46),(-.10,.22,2.39),(-1.05,.72,3.18),(-2.15,.64,3.73)],[.29,.22,.16,.041]),
        ([(.82,-.42,2.48),(1.40,-1.12,2.93),(2.21,-1.49,3.78)],[.25,.16,.039]),
        ([(.65,-.37,2.07),(.79,.48,2.91),(.09,1.31,4.02)],[.24,.14,.029]),
        ([(.97,-.72,3.46),(1.89,.03,4.00),(2.45,.78,4.29)],[.17,.10,.029]),
    ]
    for line, radii in boughs:
        stem.grain([(x*sway,y,z+(.25 if variant==1 else 0)) for x,y,z in line],radii,bark,10)
    colors = ("49ab65","54bd6c","86d87b","43a869","73c96c","8fda74") if variant == 0 else (
        "429d70","56b67c","6bc894","53bd8b","359f76","85d9a1")
    clusters=CROWN
    if variant==2:
        colors=("65b963","8bd06a","94d56e","6fbe62","56ab68","a3de76")
        clusters=[(-1.91,.62,4.01,1.36,1.15,.72),(-.73,.88,4.37,1.40,1.30,.85),
                  (1.98,-1.35,4.09,1.35,1.20,.74),(2.31,.82,4.53,1.33,1.40,.80),
                  (.48,1.16,4.45,1.43,1.25,.80),(1.28,-.64,5.06,1.36,1.13,.98)]
    for i, (x,y,z,sx,sy,sz) in enumerate(clusters):
        center = (sway*x, y, z+(.36 if variant==1 else 0))
        crown_lobe(leaves, center, (sx, sy, sz), colors[i], 90+i)
        crown_lobe(tips, (center[0]+.56, center[1]-.31, center[2]+.23),
                   (sx*.61, sy*.54, sz*.71), colors[(i+2)%6], 52-i, True)
        if i in (0,2,3,5):
            crown_lobe(economy,center,(sx*1.16,sy*1.32,sz*1.12),colors[i],90+i)
    for model in stem, leaves, tips, economy:
        model.export_mesh()


tree("Carvalho", OAK, 0)
tree("Amieiro", ALDER, 1)
tree("Aveleira", HAZEL, 2)

# Cool slate with a thin, recessed seam and moss on one sheltered shoulder.
outline = [(-.87,-.56), (-.23,-.78), (.55,-.69), (1.0,-.26), (.89,.38), (.27,.67), (-.51,.67), (-.99,.24)]
shale = Sculpture("Ardosia")
rings, tones = [], []
for row, (height, spread, shift, tint) in enumerate([
    (-.22,1.08,.04,"79708f"), (.09,1.04,.06,"9995bc"), (.38,1.00,-.02,"a9a6cb"),
    (.45,.964,-.045,"d6d2eb"), (.48,.924,-.06,"8e82a8"), (.56,.97,-.09,"aea7cc"),
    (1.13,.69,-.17,"c5bddc"), (1.37,.38,-.28,"ccc5e4")
]):
    rings.append([(x*spread+shift+.045*math.sin(i*1.51+row*.25),
                   y*spread+.032*math.cos(i*4.07-row*.25),
                   height+.10*x+.052*math.sin(i*2.34))
                  for i,(x,y) in enumerate(outline)])
    tones.append([paint("91cd67" if row==6 and i in (1,2) else tint, .94+.11*math.sin(i*.95+row*.61)**2)
                  for i in range(len(outline))])
shale.rings(rings, tones)
shale.export_mesh()

# Two different silhouettes with the moss and fissures painted into the stone.
def rounded_stone(name, outline, levels, palette):
    stone=Sculpture(name)
    rings,colors=[],[]
    for row,(height,spread,shift) in enumerate(levels):
        ring,tonal=[],[]
        for i,(x,y) in enumerate(outline):
            seam=.085 if name=="Pedra_fendida" and i==3 and row in (2,3) else 0
            ring.append((x*spread+shift, y*spread+.055*math.sin(i*2.2+row), height-seam+.06*math.sin(i*1.9)))
            hue=palette[1] if row==len(levels)-2 and i in (0,1) else palette[0]
            if row==2 and i in (4,5,6):hue="bcb3d1"
            if seam:hue=palette[2]
            tonal.append(paint(hue,.88+row*.054+.08*math.cos(i*1.76)))
        rings.append(ring)
        colors.append(tonal)
    stone.rings(rings,colors)
    stone.export_mesh()

rounded_stone("Seixo_musgo",[(-1,-.26),(-.76,-.61),(-.15,-.77),(.52,-.57),(.94,-.27),
                           (1.02,.20),(.65,.57),(.06,.72),(-.65,.57),(-.98,.17)],
              [(-.12,.81,.02),(.15,1,.02),(.56,.96,.10),(.80,.71,.04),(.86,.33,-.16)],
              ("969097","879661","696778"))
rounded_stone("Pedra_fendida",[(-.92,-.40),(-.43,-.73),(.02,-.64),(.34,-.68),(.91,-.37),
                              (.80,.27),(.31,.61),(-.40,.68),(-.95,.24)],
              [(-.16,.89,.10),(.12,1,.03),(.65,.92,-.04),(1.04,.78,-.20),(1.36,.56,-.28),(1.43,.28,-.41)],
              ("9397a4","8a9962","575c70"))

# Rounded blueberry foliage and a lower shrub with pointed, warm azalea leaves.
for kind,petal,foliage,spread in [
    ("Mirtilo","596ad2",("6c9f57","538754","83ad66"),1),
    ("Azaleia","eda581",("809052","a5aa69","6f924c"),1.25),
]:
    shrub=Sculpture(kind)
    for j in range(6):
        angle=j*2.39996
        dx,dy=math.cos(angle),math.sin(angle)
        reach=(.46+(.04*(j%3)))*spread
        top=.30+.12*(j%3)
        shrub.grain([(0,0,-.05),(dx*reach*.53,dy*reach*.52,top*.65),(dx*reach,dy*reach,top)],
                     [.021,.024,.013],["675940"],5)
        for i in range(4):
            a=angle+(i-1.40)*.7
            x,y=math.cos(a),math.sin(a)
            shrub.blade((dx*reach*.63,dy*reach*.63,top*.78),
                        (dx*reach+x*.20,dy*reach+y*.23,top+.10),
                        .135 if kind=="Mirtilo" else .078,foliage[i%3],.105)
        for i in [-1,1]:
            x,y=dx*reach+.074*i,dy*reach-.041*i
            if kind=="Mirtilo":
                shrub.grain([(x,y,top-.015),(x,y,top+.03),(x,y,top+.105)],
                             [.041,.074,.035],[petal,"899be1"],6)
            else:
                for a in range(5):
                    turn=a*math.tau/5
                    shrub.blade((x,y,top+.04),(x+.13*math.cos(turn),y+.13*math.sin(turn),top+.12),
                                .061,petal if j%2 else "f5bfab",.085)
                shrub.blade((x-.03,y,top+.07),(x+.03,y+.015,top+.10),.026,"ead070",.025)
    shrub.export_mesh()

for name, outline2, hue in [
    ("Passo_Pedra", [(-.7,-.19),(-.47,-.35),(.26,-.37),(.59,-.17),(.54,.20),(.02,.29),(-.45,.20)], "c4bfdb"),
    ("Passo_Casca", [(-.71,-.09),(-.63,-.23),(.07,-.16),(.59,-.13),(.68,.01),(.43,.13),(-.27,.17)], "916340"),
    ("Cascalho", [(-.44,-.31),(-.04,-.56),(.39,-.17),(.42,.08),(.11,.45),(-.46,.33)], "cbc5de"),
]:
    model = Sculpture(name)
    model.rings([[(x,y,-.065) for x,y in outline2],
                 [(x*.93,y*.96,.014+.019*math.sin(i*5)) for i,(x,y) in enumerate(outline2)],
                 [(x*.77,y*.77,.04+.011*math.cos(i*3)) for i,(x,y) in enumerate(outline2)]],
                [[paint(hue, hint+.13*math.sin(i*3+r)) for i in range(len(outline2))]
                 for r,hint in enumerate((.62,.84,1.06))])
    model.export_mesh()

fern = Sculpture("Samambaia")
for branch, (rotation, span, rise) in enumerate([(0,.94,.48),(1.18,.86,.55),(2.62,1.06,.44),(3.74,.74,.67),(5.13,1.10,.40)]):
    u = Vector((math.cos(rotation), math.sin(rotation), 0))
    v = Vector((-u.y, u.x, 0))
    def frond(t):
        return u*span*t + Vector((0, 0, rise*math.sin(t*2.59)+.03))
    fern.blade(frond(0), frond(.96), .027, "97a54d", rise*.54)
    for j in range(1, 7):
        t = j*.134
        for side in (-1, 1):
            tip = frond(t+.118) + v*side*(.26*(math.sin(t*math.pi)**.6)*(1-t*.7))
            fern.blade(frond(t), tip, .063*(1-t*.68), ("719537","6e973d","4e8637")[branch%3], .06)
fern.export_mesh()

sorrel = Sculpture("Trevo")
for i, (angle,h,length) in enumerate([(.1,.16,.33),(1.70,.28,.28),(3.18,.19,.40),(4.72,.24,.27),(5.69,.38,.28)]):
    root = Vector((0,0,0))
    stem = Vector((length*.8*math.cos(angle),length*.8*math.sin(angle),h))
    sorrel.blade(root, stem, .024, "82964a")
    for offset in [-.72, .72, 2.85]:
        tip = stem + Vector((length*.55*math.cos(angle+offset),length*.55*math.sin(angle+offset),-.035))
        sorrel.blade(stem, tip, .091, ("4a8043","637e43","6d9d4b")[i%3])
sorrel.export_mesh()

flowers = Sculpture("Flores")
for x,y,h in [(-.30,-.15,.24), (.03,.02,.42), (.24,.27,.29),(.20,-.23,.31)]:
    flowers.grain([(0,0,-.03), (x*.75,y*.64,h*.63), (x,y,h)], [.012,.013,.009], ["678848"], 4)
    for i in range(5):
        a = math.tau*i/5
        flowers.blade((x,y,h),(x+.085*math.cos(a),y+.085*math.sin(a),h+.008),.045,"e0cbc3",.031)
    flowers.blade((x-.026,y,h+.017),(x+.031,y,h+.025),.026,"e8b24f",.015)
flowers.export_mesh()

log = Sculpture("Tronco_Oco")
n = 30
rings, colors = [], []
for j,(axis,radius,hue) in enumerate([(-1.19,.72,"463829"),(-1.09,1.01,"a06d47"),
                                     (-.29,1.08,"96613e"),(.65,1.08,"a6744b"),
                                     (1.18,.99,"c08d62"),(1.21,.89,"e8b77c"),(1.23,.84,"b07b53"),
                                     (1.25,.78,"efd3a0"),(1.20,.72,"a66e47"),(1.03,.66,"56352c"),
                                     (.67,.66,"39283c"),(-.78,.67,"403426")]):
    ring = []
    for i in range(n):
        a = math.tau*i/n
        r = radius*(1+.07*math.sin(i*2.67)+.028*math.sin(j*.6+i*.3))
        ring.append((math.cos(a)*r, axis+.05*math.sin(i*2.8+j*.4), math.sin(a)*r*.94))
    rings.append(ring)
    colors.append([paint(hue,.82+.18*math.sin(i*3.4+j*.1)+.06*math.sin(i*.73)) for i in range(n)])
log.rings([list(reversed(row)) for row in rings+[rings[0]]],
          [list(reversed(row)) for row in colors+[colors[0]]], False)
log.export_mesh()

mushrooms = Sculpture("Cogumelos")
for x, y, scale, cap in [(-.18,.04,1,"ff7567"),(.20,.13,.72,"ff9b62"),(.06,-.19,.49,"ee7291")]:
    mushrooms.grain([(x,y,-.02),(x,y,.17*scale),(x+.03,y,.34*scale)],
                    [.072*scale,.071*scale,.050*scale], ["fff1d8"], 10)
    rings, pigments = [], []
    for level, radius, tint in [(.25,.16,"efe0ca"),(.30,.236,cap),(.40,.21,cap),(.49,.145,cap),(.53,.035,cap)]:
        rings.append([(x+scale*radius*math.cos(i*math.tau/14),y+scale*radius*math.sin(i*math.tau/14),
                       scale*level) for i in range(14)])
        pigments.append([paint(tint,1)]*14)
    mushrooms.rings(rings,pigments)
    for angle, distance, level in [(0,.16,.47),(1.8,.14,.48),(3.1,.18,.451),(4.6,.16,.47)]:
        px=x+scale*distance*math.cos(angle)
        py=y+scale*distance*math.sin(angle)
        spot=[(px+scale*.046*math.cos(i*math.tau/8),py+scale*.046*math.sin(i*math.tau/8),
               scale*level) for i in range(8)]
        mushrooms.surface(spot,[tuple(range(8))],[paint("fff5ec",1)]*8)
mushrooms.export_mesh()

marker = Sculpture("Varal")
for x, tilt in [(-.72,-.10),(.72,.08)]:
    marker.grain([(x,0,-.07),(x-.035,.04,.67),(x+tilt*.3,.04,1.49),(x+tilt,0,2.51)],
                 [.079,.067,.057,.037], BARK, 9)
marker.grain([(-.87,.02,2.49),(-.42,.025,2.53),(.15,.039,2.48),(.90,.025,2.44)],
             [.038,.049,.042,.027], BARK, 9)
marker.grain([(-.79,-.055,2.39),(-.39,-.075,2.35),(.0,-.08,2.31),(.37,-.075,2.35),(.80,-.055,2.38)],
             [.014]*5, ["d1b880"], 5)
for i, (x, hue, length) in enumerate([(-.54,"f7cf80",.46),(-.22,"ff7a65",.63),
                                      (.12,"62d2c4",.56),(.46,"ae94ed",.47)]):
    panels, pigments = [], []
    for row in range(5):
        for col in range(5):
            gy, gx = row/4, (col/4-.5)*.275
            panels.append((x+gx*(1+.14*gy)+gy*.06*math.sin(i*2.1),
                           -.085+.039*math.sin(col*1.83+row*.61+i*.8),
                           2.35-length*gy+.022*math.cos(col*1.08+i*.9)*gy))
            pigments.append(paint(hue,.88+.16*math.sin(col*.87+row*.29)**2+.05*(row==4)))
    marker.surface(panels, [(a,a+1,a+6,a+5) for a in range(20) if a%5!=4], pigments)
marker.export_mesh()


def round_lobe(model, center, radii, hue, ribs=12, rows=6, wobble=.05):
    """Closed, gently uneven sculpted volume with shared smooth normals."""
    x, y, z = center
    sx, sy, sz = radii
    rings, colors = [], []
    for row in range(rows):
        tilt = -math.pi/2+(row+.40)*math.pi/(rows-.20)
        level = math.sin(tilt)
        ring = []
        for i in range(ribs):
            a = math.tau*i/ribs
            radius = math.cos(tilt)*(1+wobble*math.sin(a*3+.7*row))
            ring.append((x+sx*(radius*math.cos(a)+level*.13),
                         y+sy*radius*math.sin(a), z+sz*level))
        rings.append(ring)
        colors.append([paint(hue,.89+.14*(level+1)/2)]*ribs)
    model.rings(rings,colors)


chibi_trees = [
    ("Carvalho", "55bd65", "7ad46a", 4.32, 1.29),
    ("Amieiro", "43a96e", "65cd86", 4.29, 1.17),
    ("Aveleira", "6ac358", "9cdb69", 3.92, 1.28),
]
for kind, green, tips, height, spread in chibi_trees:
    stem = Sculpture(kind+"_Chibi_Tronco")
    stem.grain([(0,0,-.18),(.03,0,.20),(.05,.015,1.50),(-.13,.04,2.75),(-.19,.07,height)],
               [.39,.28,.21,.18,.095], ["9e6543","ae754b","906044"], 12)
    stem.grain([(.04,.02,1.83),(.29,.07,2.39),(.65,.19,2.99),(1.07,.25,height-.56)],
               [.138,.11,.082,.048], ["a8734d","966142"], 9)
    stem.grain([(-.06,.01,2.3),(-.39,-.18,2.75),(-.83,-.34,height-.36)],
               [.12,.092,.056], ["a8734d","966142"], 9)
    for root_x,root_y in [(.65,.32),(-.40,.45),(-.29,-.55)]:
        stem.grain([(0,0,.30),(root_x*.42,root_y*.42,.13),(root_x,root_y,-.015)],
                   [.14,.12,.025], ["a8734d","936044"], 8)
    stem.export_mesh()
    for low in (True,False):
        crown = Sculpture(kind+"_Chibi_Copa"+("_economica" if low else ""))
        lobes = [(-.14,.07,.14,1.22,1.15,1.07,green),(-.92,-.28,-.38,.79,.74,.70,green),
                 (.85,.24,-.42,.84,.74,.68,green),(.24,-.64,-.06,.78,.68,.61,tips),
                 (-.35,.80,.04,.77,.71,.69,tips)]
        if low:
            lobes.pop()
        else:
            lobes += [(.68,-.33,.53,.54,.52,.55,tips),(-.69,.29,.49,.62,.69,.60,green)]
        for x,y,z,sx,sy,sz,hue in lobes:
            round_lobe(crown,(x*spread,y*spread,height+z),(sx*spread,sy*spread,sz),
                       hue,10 if low else 14, 6 if low else 8)
        crown.export_mesh()


berry = Sculpture("Moita_de_Bagas")
for center, radii, hue in [
    ((-.28,0,.36),(.61,.50,.43),"56b861"),
    ((.30,.075,.33),(.56,.48,.39),"63c265"),
    ((.04,-.13,.50),(.46,.43,.42),"78cf6a"),
]:
    round_lobe(berry,center,radii,hue,10,5)
for x,y,z,s,hue in [(-.58,-.19,.63,.10,"7e71cf"),(-.36,-.34,.69,.092,"956cd9"),
                    (.34,-.23,.73,.107,"877cdb"),(.51,-.12,.68,.084,"6872ca"),
                    (.12,.15,.90,.091,"a488e2")]:
    round_lobe(berry,(x,y,z),(s,s,s*.92),hue,7,3)
berry.export_mesh()

petals = Sculpture("Flores_Chibi")
for index,(x,y,z,s,tint) in enumerate([
    (-.24,-.02,.26,.83,"f1a5c3"),(.07,.04,.38,1,"fff4da"),
    (.28,.13,.30,.9,"b996ef"),(.12,-.27,.23,.66,"ffce71"),
]):
    petals.grain([(x*.77,y*.77,-.01),(x,y,z*.49),(x+.02,y,z)], [.024,.02,.015], ["6cb553"], 5)
    petals.blade((x,y,z*.31),(x-.13,y+.09,z*.77),.042,"76c95f",.042)
    petals.blade((x,y,z*.35),(x+.12,y-.07,z*.67),.043,"82d66a",.039)
    # One scalloped corolla, painted through the throat, plus its center.
    rings=[]
    for radius,top in [(.049,-.032),(.112,0),(.053,.018),(.027,.037)]:
        ring=[]
        for i in range(15):
            a=math.tau*i/15+index*.46
            rr=radius*(1+.21*math.sin(a*5))
            ring.append((x+s*rr*math.cos(a),y+s*rr*math.sin(a),z+s*(top+.04*math.sin(a))))
        rings.append(ring)
    petals.rings(rings,[[paint(pigment,.97)]*15 for pigment in (tint,tint,tint,"edbe62")])
petals.export_mesh()

stone = Sculpture("Seixo_da_Travessia")
round_lobe(stone,(0,0,-.008),(.50,.36,.15),"aaa0c8",13,7,.12)
round_lobe(stone,(.13,.04,.106),(.26,.175,.036),"91cd6b",9,4,.14)
stone.export_mesh()

stone_bank = Sculpture("Seixo_de_Margem")
round_lobe(stone_bank,(0,0,.17),(.72,.61,.47),"bab1d6",13,7,.17)
round_lobe(stone_bank,(.13,-.14,.48),(.46,.35,.14),"96c96d",10,5,.12)
stone_bank.export_mesh()

bark = Sculpture("Casca_da_Trilha")
bark.rings([
    [(x,y,z) for x,y in [(-.53,-.11),(-.19,-.27),(.20,-.29),(.52,-.10),(.42,.20),(.07,.25),(-.36,.20)]]
    for z in [-.068,.022]
],[[paint("a06b47",tone)]*7 for tone in (.80,1.10)])
bark.blade((-.31,.015,.024),(.31,-.024,.023),.029,"d39b63",.012)
bark.export_mesh()

log = Sculpture("Tronco_Chibi")
log_profile = [
    (-1.23,.82,"6d4635"),(-1.16,.96,"a16a45"),(.25,.96,"a16b49"),
    (1.14,.94,"b47d56"),(1.22,.88,"e8b683"),(1.231,.77,"c58a57"),
    (1.235,.71,"f0ca94"),(1.223,.652,"bd885d"),(1.13,.61,"7c5037"),
    (.66,.58,"4c302f"),(-1.12,.56,"3b2934"),(-1.15,.28,"322534"),
    (-1.16,.005,"322534"),(-1.23,.82,"6d4635"),
]
log_rings,log_paint = [],[]
for axis,radius,tint in log_profile:
    ring,pigments=[],[]
    for i in range(32):
        a=math.tau*i/32
        r=radius*(1+.036*math.sin(3*a+.6)+.024*math.cos(7*a))
        ring.append((r*math.cos(a),axis+.026*math.sin(5*a),r*math.sin(a)))
        pigments.append(paint(tint,.91+.10*math.sin(a)+.045*math.cos(9*a)))
    log_rings.append(list(reversed(ring)))
    log_paint.append(list(reversed(pigments)))
log.rings(log_rings,log_paint,False)
for x,y,z,sx,sy,sz in [(-.28,-.61,.86,.33,.47,.16),(.29,-.26,.89,.43,.42,.15),
                        (.08,.43,.94,.40,.47,.15),(-.37,.59,.79,.30,.31,.17)]:
    round_lobe(log,(x,y,z),(sx,sy,sz),"83c66a",10,5)
log.export_mesh()

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "bosque-authoring.blend"))
bpy.ops.export_scene.gltf(filepath=str(OUT / "bosque.glb"), export_format="GLB",
                         export_materials="EXPORT", export_yup=True, export_animations=False)
