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
    stem.grain(trunk, [.64, .38, .30, .23, .15, .047], bark, 16)
    for x,y in [(-1.64,-.30), (1.17,.78), (.60,-1.32), (-.82,1.01), (.10,1.56)]:
        stem.grain([trunk[1], (x*.42,y*.42,.19), (x*.77,y*.77,.07), (x,y,-.13)],
                   [.23,.20,.116,.022], bark, 9)
    sway = -.75 if variant else 1
    for line, radii in BOUGHS:
        stem.grain([(x*sway, y, z+variant*.25) for x,y,z in line], radii, bark, 10)
    colors = ("508157","5b955e","7ca764","508c62","66a362","80af66") if variant == 0 else (
        "517c62","51906d","6ca57b","57957a","437c66","87ad77")
    for i, (x,y,z,sx,sy,sz) in enumerate(CROWN):
        center = (sway*x, y, z+variant*.36)
        crown_lobe(leaves, center, (sx, sy, sz), colors[i], 90+i)
        crown_lobe(tips, (center[0]+.56, center[1]-.31, center[2]+.23),
                   (sx*.61, sy*.54, sz*.71), colors[(i+2)%6], 52-i, True)
        if i in (0,2,3,5):
            crown_lobe(economy,center,(sx*1.16,sy*1.32,sz*1.12),colors[i],90+i)
    for model in stem, leaves, tips, economy:
        model.export_mesh()


tree("Carvalho", OAK, 0)
tree("Amieiro", ALDER, 1)

# Asymmetric shale split along broad shelves with green mineral terraces.
outline = [(-.87,-.56), (-.23,-.78), (.55,-.69), (1.0,-.26), (.89,.38), (.27,.67), (-.51,.67), (-.99,.24)]
shale = Sculpture("Ardosia")
rings, tones = [], []
for row, (height, spread, shift, tint) in enumerate([
    (-.27,1.12,.04,"434f42"), (.06,1.07,.09,"556148"), (.39,.99,-.01,"748078"),
    (.52,1.00,-.09,"859086"), (.66,.91,-.12,"687766"), (.98,.81,-.04,"7e8b7c"),
    (1.37,.61,-.14,"929d87"), (1.62,.38,-.29,"9ea289")
]):
    rings.append([(x*spread+shift+.09*math.sin(i*1.51+row*.80),
                   y*spread+.06*math.cos(i*4.07-row*.6),
                   height+.14*math.sin(i*2.34)+.085*math.cos(i*1.19-row*.91))
                  for i,(x,y) in enumerate(outline)])
    tones.append([paint("798951" if (i+row*2)%7 < 2 else tint, .82+.24*math.sin(i*.95+row*.61)**2)
                  for i in range(len(outline))])
shale.rings(rings, tones)
shale.export_mesh()

for name, outline2, hue in [
    ("Passo_Pedra", [(-.7,-.19),(-.47,-.35),(.26,-.37),(.59,-.17),(.54,.20),(.02,.29),(-.45,.20)], "b4b6a3"),
    ("Passo_Casca", [(-.71,-.09),(-.63,-.23),(.07,-.16),(.59,-.13),(.68,.01),(.43,.13),(-.27,.17)], "916340"),
    ("Cascalho", [(-.44,-.31),(-.04,-.56),(.39,-.17),(.42,.08),(.11,.45),(-.46,.33)], "a3a38b"),
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
for j,(axis,radius,hue) in enumerate([(-1.19,.72,"463829"),(-1.09,1.01,"8b6347"),
                                     (-.29,1.08,"69523b"),(.65,1.08,"775336"),
                                     (1.18,.99,"987252"),(1.21,.89,"a27950"),(1.23,.84,"6a462f"),
                                     (1.25,.78,"c89a6c"),(1.20,.72,"786047"),(1.03,.66,"463c2c"),
                                     (.67,.66,"332e26"),(-.78,.67,"403426")]):
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

marker = Sculpture("Varal")
for x, tilt in [(-.72,-.10),(.72,.08)]:
    marker.grain([(x,0,-.07),(x-.035,.04,.67),(x+tilt*.3,.04,1.49),(x+tilt,0,2.51)],
                 [.079,.067,.057,.037], BARK, 9)
marker.grain([(-.87,.02,2.49),(-.42,.025,2.53),(.15,.039,2.48),(.90,.025,2.44)],
             [.038,.049,.042,.027], BARK, 9)
marker.grain([(-.79,-.055,2.39),(-.39,-.075,2.35),(.0,-.08,2.31),(.37,-.075,2.35),(.80,-.055,2.38)],
             [.014]*5, ["d1b880"], 5)
for i, (x, hue, length) in enumerate([(-.54,"dfb56c",.46),(-.22,"b86a50",.63),
                                      (.12,"ead497",.56),(.46,"c99754",.47)]):
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

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "bosque-authoring.blend"))
bpy.ops.export_scene.gltf(filepath=str(OUT / "bosque.glb"), export_format="GLB",
                         export_materials="EXPORT", export_yup=True, export_animations=False)
