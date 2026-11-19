import * as T from '/vendor/three/three.module.min.js';
import { terrainHeight } from './navigation.mjs';
import { buildShelter } from './beetle.mjs';
import { inBosque, inSceneMaster, installBosque } from './bosque.mjs';
import { installRegions } from './regions.mjs';
import { boatProgress } from './boat.mjs';
import { createSight } from './sight.mjs';
import { gem } from './chibi.mjs';
import { buildWaterSurfaces, dressWaterWheel } from './cenario-agua.mjs';

let layout, grid;
export function configure(map, seamHeight) {
  layout = map;
  const bounds = [map.bounds[0], 29, -21, 22];
  grid = { n: 116, bounds, heights: [] };
  const [xmin,xmax,zmin,zmax] = bounds;
  for(let j=0;j<=grid.n;j++){
    const z=zmin+(zmax-zmin)*j/grid.n;
    const bank=seamHeight(z);
    const seamWidth=T.MathUtils.lerp(.52,3.1,T.MathUtils.smoothstep(z,3.45,4.7));
    for(let i=0;i<=grid.n;i++){
      const x=xmin+(xmax-xmin)*i/grid.n;
      const blend=T.MathUtils.smoothstep(x,xmin,xmin+seamWidth);
      grid.heights.push(T.MathUtils.lerp(bank,height(x,z),blend));
    }
  }
}
export const places = [
  { id: 'wheel', x: 0, z: 13, title: 'Soltar um barquinho' },
  { id: 'leaf', x: -9, z: 1.4, title: 'Virar a folha' },
  { id: 'echo', x: 7, z: 0.3, title: 'Bater na laje' },
  { id: 'falls', x: -4, z: -12.5, title: 'Olhar pela janela' },
  { id: 'patio-shop', action:'shop', x:9.9, z:-11.4, title:'Bancada dos Remendos', icon:'⚒' },
  { id: 'carving', x:10.8, z:-10.4, title:'Olhar os recortes' },
  { id: 'source', x:18.8, z:-5.8, title:'Acompanhar a roda alta' },
  { id: 'lookout', x:17.4, z:2.3, title:'Olhar o vale' },
];
export function region(x, z) {
  if (x >= 13.25 && z < 7.8) return 'Copa da Nascente';
  if (x >= 6 && z < -7.15) return 'Pátio dos Remendos';
  if (z > 8 || (x < -6 && z > 5)) return 'Soleira da Roda Baixa';
  if (z < -6.5) return 'Garganta das Duas Margens';
  return 'Bosque das Bainhas';
}
export function hint(x, z) {
  if (x > 13.25 && z < 3) return 'A roda alta tem uma saída pela encosta. Procure as pequenas bandeiras claras.';
  if (x > 6 && z < -7.15) return 'A água passa por cima da bancada. Acompanhe a calha até a subida.';
  if (z > 8) return 'A água chega pelo vão da sebe. A roda fica aqui na volta.';
  if (z < -6.5) return 'As lajes e a casca voltam ao varal. A roda fica depois dele.';
  if (x < -3) return 'Vi duas patinhas perto da ponta prateada.';
  if (x > 4.5) return 'Esta pedra tem uma irmã do outro lado do vale. Quer ouvir a resposta?';
  return 'Vejo casca de um lado e lajes do outro. Qual chão você quer experimentar?';
}
export function pathGap(x, z, trail) {
  let nearest = Infinity;
  for (let i = 1; i < trail.points.length; i++) {
    const [a, b] = trail.points[i - 1],
      [c, d] = trail.points[i],
      dx = c - a,
      dz = d - b;
    const t = T.MathUtils.clamp(((x - a) * dx + (z - b) * dz) / (dx * dx + dz * dz), 0, 1);
    nearest = Math.min(nearest, (x - a - dx * t)**2 + (z - b - dz * t)**2);
  }
  return Math.sqrt(nearest) - trail.width;
}
function edge(x, z) {
  return Math.min(
    ...layout.paths.map((p) => pathGap(x, z, p)),
    ...layout.clearings.map(([a, b, r]) => Math.hypot(x - a, z - b) - r)
  );
}
export function description(id) {
  return {
    wheel:'Um barquinho de papel passa sob a roda.',
    echo:'Toc! A pedra responde do outro lado.',
    falls:'A água cai pela janela de pedra e segue em direção à roda.',
    source:'As pás da roda apanham folhas na nascente e as soltam na calha.',
    lookout:'As bandeiras claras acompanham a descida até a roda baixa.',
    carving:'As duas peças formam um pássaro quando vistas pelo lado da bancada.',
  }[id]??'';
}
export function walkable(x, z) {
  const [xmin, xmax, zmin, zmax] = layout.bounds;
  if (!Number.isFinite(x + z) || x < xmin || x > xmax || z < zmin || z > zmax) return false;
  if (layout.blocked.some(([a, b, c, d]) => x > a && x < b && z > c && z < d)) return false;
  return edge(x, z) <= 0;
}
const bell = (x, z, a, b, w, h) => Math.exp(-(((x - a) / w) ** 2) - ((z - b) / h) ** 2);
function waterfall() {
  const positions=[], colors=[], indices=[];
  const teal=new T.Color('#57a7aa'), foam=new T.Color('#bce9d8');
  const color=new T.Color();
  const rows=14, width=8;
  for(let row=0;row<=rows;row++){
    const down=row/rows;
    for(let column=0;column<=width;column++){
      const across=column/width;
      const spread=.57+.22*down*down;
      const x=-4.13+(2*across-1)*spread+.08*Math.sin(down*2.1);
      const y=1.97-3.52*down+.12*Math.sin(Math.PI*across)*(1-down);
      const z=-16.19+1.04*down**.68+.06*Math.sin(across*13+down*3);
      positions.push(x,y,z);
      color.copy(teal).lerp(foam,.22+.37*Math.sin(across*18+down*1.7)**2+.17*down);
      colors.push(color.r,color.g,color.b);
      if(row<rows&&column<width){
        const a=row*(width+1)+column, b=a+width+1;
        indices.push(a,b,a+1,a+1,b,b+1);
      }
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new T.Mesh(geometry,new T.MeshStandardMaterial({
    vertexColors:true,side:T.DoubleSide,roughness:.42,
  }));
}
function waterInSlabs(material,geometry,instances,clock){
  geometry.setAttribute('waterSurface',new T.InstancedBufferAttribute(
    new Float32Array(instances.map(item=>Number(item.flowing))),1));
  const paint=material.clone();
  paint.name='Madeira e superfície da calha';
  paint.onBeforeCompile=shader=>{
    shader.uniforms.forestWaterClock=clock;
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>',`#include <common>
        attribute float waterSurface;
        varying vec3 vWaterSlab;`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        vWaterSlab=vec3(position.xz,waterSurface*max(0.0,normal.y));`);
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>
        uniform float forestWaterClock;
        varying vec3 vWaterSlab;`)
      .replace('#include <color_fragment>',`#include <color_fragment>
        if(vWaterSlab.z>.5){
          float lane=.48+.52*pow(abs(sin(vWaterSlab.x*9.0)),2.0);
          float phase=39.0*vWaterSlab.y-5.4*forestWaterClock+7.0*vWaterSlab.x;
          float streak=lane*smoothstep(.05,.92,sin(phase));
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.88,.98,1.0),.68*streak);
        }`);
  };
  return paint;
}
function height(x, z) {
  return (
    0.07 * Math.sin(z * 0.64) +
    1.55 * bell(x, z, 6, 0, 4.5, 5.5) +
    2.2 * bell(x, z, 0, -0.4, 2.9, 3.8) +
    0.65 * bell(x, z, -3, -11, 4, 4) +
    3.05 * bell(x,z,18.5,-5.3,5,6) +
    3.3 * bell(x,z,23,-18.2,6,4.5) -
    2.3 * T.MathUtils.smoothstep(-z, 13.7, 15.8) * (1-T.MathUtils.smoothstep(x,2,7))
  );
}
export const floor = (x, z) => terrainHeight(grid, x, z) + 0.012;

export function build(scene, leafUp, library, paint) {
  let seed = 7239;
  const random = () => (seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296;
  const group = new T.Group();
  scene.add(group);
  const material = paint.toon('#ffffff');
  const waterClock={value:0};
  const slatePaint=material.clone();
  slatePaint.name='Ardósia com pigmento mineral';
  slatePaint.vertexColors=true;
  const shapes = {
    slab: new T.BoxGeometry(1, 1, 1),
    stone: library.getObjectByName('Ardosia').geometry.clone().center().scale(.82,.93,1.03),
    crown: new T.SphereGeometry(1,10,6),
    trunk: new T.CylinderGeometry(.74,1,1,9),
    ring: new T.TorusGeometry(1, 0.19, 6, 16),
    leaf: new T.OctahedronGeometry(1),
  };
  const batches = new Map(),
    dummy = new T.Object3D(),
    fade = [];
  function piece(shape, color, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, shield = false, flowing = false) {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    if (!batches.has(shape)) batches.set(shape, []);
    batches
      .get(shape)
      .push({ matrix: dummy.matrix.clone(), color, shield, flowing });
  }
  const positions = [],
    colors = [],
    uv = [],
    indices = [];
  const grass = new T.Color('#a9e476'),
    earth = new T.Color('#f7d9a2'),
    stonePath = new T.Color('#efd0a1'),
    moss = new T.Color('#62b860');
  const groveLight=new T.Color('#9bd96d'),groveShade=new T.Color('#59b668');
  const groveColor=new T.Color(),rimColor=new T.Color('#e4b477');
  for (let j = 0; j <= grid.n; j++)
    for (let i = 0; i <= grid.n; i++) {
      const [xmin,xmax,zmin,zmax] = grid.bounds;
      const x = xmin + (i * (xmax-xmin)) / grid.n,
        z = zmin + (j * (zmax-zmin)) / grid.n,
        y = grid.heights[j * (grid.n + 1) + i],
        border = edge(x, z);
      const c = grass.clone().lerp(moss, 0.28 + 0.23 * Math.sin(x * 0.55 + z * 0.35));
      c.lerp(x > 3.7 && z < 5 ? stonePath : earth, 1 - T.MathUtils.smoothstep(border, -0.4, 0.33));
      const pigment = random();
      c.multiplyScalar(0.95 + pigment * 0.08);
      if (inSceneMaster(x,z)) {
        const roughEdge = border + .15*Math.sin(x*1.8-z*2.7) + .07*Math.cos(x*4.6+z*3.2);
        const pathLight = 1-T.MathUtils.smoothstep(roughEdge,-.32,.05);
        const variation = .5+.29*Math.sin(x*.98+z*.84)+.21*Math.sin(z*3.27-x*2.8);
        const soil = groveColor.copy(groveShade).lerp(groveLight,variation);
        soil.lerp(rimColor,1-T.MathUtils.smoothstep(roughEdge,.00,.26));
        soil.lerp(x>3.7&&z<5 ? stonePath : earth,pathLight);
        const dapple = Math.sin(x*1.88 + Math.cos(z*1.63)) * Math.sin(z*1.37-x*.89);
        soil.multiplyScalar(.94 + .08*variation + .06*dapple + .04*pigment);
        const edgeOfScene=z>8?Math.min(x+7,8-x,17.8-z):Math.min(x+13.2,10.7-x,z+4.2);
        const taper = T.MathUtils.smoothstep(edgeOfScene,0,1.7);
        c.lerp(soil,taper);
      }
      if(x>6&&z<-7.6)c.lerp(new T.Color('#c99873'),(1-T.MathUtils.smoothstep(border,-.8,.55))*.69);
      if(x>13&&z>-10)c.lerp(new T.Color('#9da882'),(1-T.MathUtils.smoothstep(border,-.6,.45))*.55);
      if(x<-6&&z>5)c.lerp(new T.Color('#c1a674'),(1-T.MathUtils.smoothstep(border,-.6,.44))*.66);
      colors.push(c.r, c.g, c.b);
      positions.push(x, y, z);
      uv.push(x/3.4,z/3.4);
      if (i < grid.n && j < grid.n) {
        const a = j * (grid.n + 1) + i,
          b = a + grid.n + 1;
        indices.push(a, b + 1, a + 1, a, b, b + 1);
      }
    }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const terrain = new T.Mesh(geometry, paint.toon('#ffffff',{ vertexColors:true }));
  terrain.receiveShadow = true;
  group.add(terrain);

  function rock(x, z, w, h, d, color = '#e3dfdc', rotation = 0) {
    if(inSceneMaster(x,z))return;
    piece('stone', color, x, floor(x, z) + h * 0.45, z, w, h * 0.74, d, 0, rotation, 0.08, true);
  }
  function tree(x, z, h) {
    const y = floor(x, z),
      tint = random() > 0.55 ? '#5bc46f' : '#46b377';
    const turnA=random()*3,turnB=random()*3;
    if(inSceneMaster(x,z))return;
    piece('trunk', '#a06d47', x, y + h * 0.38, z, 0.24, h * 0.76, 0.25, 0, 0, 0.03, true);
    piece('crown', tint, x, y + h * 0.83, z, h * 0.32, h * 0.39, h * 0.3, 0, turnA, 0, true);
    piece(
      'crown',
      '#7dd66c',
      x - 0.25,
      y + h * 1.03,
      z + 0.12,
      h * 0.22,
      h * 0.22,
      h * 0.21,
      0,
      turnB,
      0,
      true
    );
  }
  // Tree islands and layered outcrops keep the two paths out of each other's sight.
  [
    [-0.9, 8.5, 1.65, 3.4, 1.55],
    [-3.3, 8.9, 1.75, 3.1, 1.7],
    [0.1, 0.1, 2.2, 3.8, 2.4],
    [2, -0.6, 1.6, 3.2, 1.8],
    [-1.6, -1.4, 1.3, 3.6, 1.5],
    [2.4, -9.7, 1.4, 4.2, 1.6],
    [-5.5, -8.9, 1.3, 3.8, 1.3],
    [-7, -12.7, 1.15, 4.8, 1.7],
    [0.4, -13.1, 1.5, 5.3, 1.7],
  ].forEach(([x, z, w, h, d], i) => {
    if (!inBosque(x,z)) rock(x,z,w,h,d,['#d8dce0','#e1dfdc','#d2d6d9'][i%3],i*.65);
  });
  for (let i = 0; i < 235; i++) {
    const x = random() * 36 - 18,
      z = random() * 36 - 18;
    if (inBosque(x,z) || (x>6&&z<-2.5) || (x>13&&z<5) || z < -13 || edge(x, z) < 1.4 || Math.hypot(x, z - 14) < 4 || Math.hypot(x + 8, z - 2) < 3) continue;
    if (random() < 0.46) tree(x, z, 2.8 + random() * 3.8);
    else
      rock(
        x,
        z,
        0.4 + random() * 0.55,
        0.4 + random() * 0.58,
        0.55,
        random() > 0.5 ? '#ddd9de' : '#e6e2db',
        random() * 6
      );
  }
  for (let i = 0; i < 380; i++) {
    const x = random() * 26 - 13,
      z = random() * 32 - 15;
    if (inSceneMaster(x,z) || z < -13 || Math.abs(edge(x, z) - 0.44) > 0.72) continue;
    const y = floor(x, z);
    for (let k = 0; k < 3; k++)
      piece(
        'leaf',
        k ? '#8ba566' : '#c5bd77',
        x + k * 0.08,
        y + 0.19,
        z,
        0.065,
        0.29,
        0.055,
        0.33 - k * 0.3,
        0,
        k * 0.35 - 0.3
      );
    if (i % 3 === 0) piece('crown', '#ebbb71', x, y + 0.38, z, 0.1, 0.09, 0.1);
  }
  const water=buildWaterSurfaces(floor,waterClock);
  group.add(water);
  const wheel=dressWaterWheel(group,paint,floor);
  const moving = (parent, shape, tint, x, y, z, sx, sy, sz) => {
    const mesh = new T.Mesh(shapes[shape], paint.toon(tint));
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
  };
  piece('slab', '#56c8f2', -1.38, 0.21, 11.15, 0.82, 0.12, 5.7,0,0,0,false,true);
  const boat = new T.Group();
  boat.name='Soleira:Barquinho';
  boat.position.set(-1.38, 0.35, 9);
  boat.scale.set(1.18, 1, 1.14);
  group.add(boat);
  const hull=new T.Shape().moveTo(-.39,.10).lineTo(-.22,-.025).lineTo(.22,-.025).lineTo(.39,.10).closePath();
  const sail=new T.Shape().moveTo(-.21,.10).lineTo(.23,.10).lineTo(0,.42).closePath();
  const boatParts=[];
  for(const [shape,color,depth] of [[hull,'#fff8e8',.23],[sail,'#eaf9ff',.055]]){
    const geometry=new T.ExtrudeGeometry(shape,{depth,bevelThickness:.025,bevelSize:.025,bevelSegments:2});
    geometry.translate(0,0,-depth/2).rotateY(Math.PI/2);
    const mesh=new T.Mesh(geometry,paint.toon(color));
    boat.add(mesh);
    paint.outline(mesh,1.35);
    const highlight=paint.outline(mesh,2.75,gem);
    boatParts.push(highlight);
  }
  const wake=Array.from({length:3},(_,i)=>
    moving(boat,'leaf','#ebfcff',0,.018,-.42-i*.16,.29+i*.065,.013,.026));
  // The original treads outside the art sample continue towards the gorge.
  for (const [index, color] of [
    [1, '#8b6241'],
    [2, '#bdba9a'],
  ]) {
    const line = layout.paths[index].points;
    for (let i = 1; i < line.length; i++) {
      const [a, b] = line[i - 1],
        [c, d] = line[i],
        count = Math.ceil(Math.hypot(c - a, d - b) / 0.72);
      for (let k = 0; k < count; k++) {
        const t = (k + 0.5) / count,
          x = a + (c - a) * t,
          z = b + (d - b) * t;
        if (inBosque(x,z)) continue;
        piece(
          'slab',
          color,
          x,
          floor(x, z) + 0.003,
          z,
          index === 1 ? 1.2 : 1.28,
          0.045,
          index === 1 ? 0.25 : 0.38,
          0,
          Math.atan2(c - a, d - b),
          0
        );
      }
    }
  }
  const art = installBosque(group, library, layout, floor, edge,paint);
  const regions = installRegions(group, library, layout, floor, edge);
  const shelter = buildShelter(floor, leafUp,paint);
  group.add(shelter.group);
  for (let i = 0; i < 3; i++) rock(8 + 0.22 * i, 0.9 - 0.65 * i, 0.43, 0.8 + i * 0.3, 0.35, '#e2ded7');
  const pulse = moving(group, 'ring', '#f9da8e', 7.8, floor(7.8, 0.35) + 1, 0.35, 0.1, 0.1, 0.1);
  // Water drops through a notch between two limestone faces, beyond the walkable shelf.
  for (let i = 0; i < 7; i++) {
    const x = -7.5 + i * 0.98;
    if (i === 3 || i === 4) continue;
    piece('stone', '#c6c6cf', x, -0.05, -16, 1.25, 2.25, 1, 0, i * 0.35);
    piece('stone', '#d8d9de', x, 1.02, -16.4, 1.16, 1.55, 1.1, 0, 0.42 * i);
  }
  piece('slab', '#499a9c', -4, -1.55, -17, 12, 0.18, 4);
  group.add(waterfall());
  for (let i = 0; i < 8; i++) piece('crown', '#c7e5d3', -4.9 + 0.28 * i, -1.44, -15.2, 0.46, 0.21, 0.45);
  for (let i = 0; i < 4; i++)
    piece('slab', '#927350', -5.15 + i * 0.67, floor(-5.15 + i * 0.67, -13.55) + 0.43, -13.55, 0.1, 0.9, 0.1);
  piece('slab', '#c7a174', -4.15, floor(-4.15, -13.55) + 0.82, -13.55, 2.4, 0.1, 0.13);
  const blockers = [];
  const gaze=createSight();
  const lowLandmarks=[wheel.position,new T.Vector3(-1.38,.30,11.8),new T.Vector3(-1.38,.30,9.25)];
  const forkLandmarks=[[1.25,4.72],[3.72,4.21],[4.2,3.8]].map(([x,z])=>new T.Vector3(x,floor(x,z),z));
  const logLandmarks=[shelter.group.position.clone().add(new T.Vector3(-.59,.78,.10)),
    new T.Vector3(-8.36,floor(-8.36,1.03)+.84,1.03)];
  const noLandmarks=[];
  for (const [shape, list] of batches) {
    const geometry=shapes[shape];
    const paint=shape==='stone'?slatePaint:shape==='slab'?waterInSlabs(material,geometry,list,waterClock):material;
    const mesh = new T.InstancedMesh(geometry, paint, list.length);
    mesh.name='Trilha:'+(shape==='stone'?'Ardosia_estratificada':shape);
    if(list.some(item=>item.shield))geometry.computeBoundingSphere();
    list.forEach((p, i) => {
      mesh.setMatrixAt(i, p.matrix);
      mesh.setColorAt(i, new T.Color(p.color));
      if (p.shield){
        const bounds=geometry.boundingSphere.clone().applyMatrix4(p.matrix);
        fade.push({mesh,i,item:p,bounds,foreground:shape==='stone'});
      }
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (list.some((p) => p.shield)) blockers.push({ mesh, list });
  }
  let echoAt = -10,
    boatAt = null,
    echoPending = false;
  const hideMatrix = new T.Matrix4().makeScale(0, 0, 0);
  return {
    group,
    terrain,
    shelter,
    setEconomy(low) { art.setEconomy(low); regions.setEconomy(low); },
    living() { return { lowWheel:wheel.rotation.z, lowBoat:boat.position.toArray(), lowWater:waterClock.value, stonePressure:art.stonePressure(), ...regions.living() }; },
    blocksTap(ray, hit) {
      if (art.blocksTap(ray,hit)) return true;
      return blockers.some(({ mesh, list }) =>
        ray
          .intersectObject(mesh, false)
          .some((p) => p.distance + 0.02 < hit.distance && list[p.instanceId].shield&&!list[p.instanceId].hidden)
      );
    },
    interact(id, t) {
      if (id === 'echo') {
        echoAt = t;
        echoPending = true;
        window.DaviGame?.sound();
        return 'Toc! A pedra responde do outro lado. Pipo levanta a cabeça.';
      }
      if (id === 'wheel') {
        boatAt = t;
        return 'O barquinho entra na calha. Pipo olha por onde ele passou.';
      }
      regions.interact(id,t);
      return description(id);
    },
    tick(t, still, camera, hero, buddy, action, moving) {
      const landmarks=Math.hypot(hero.x,hero.z-13)<3.6?lowLandmarks
        :Math.hypot(hero.x-2.68,hero.z-6.5)<3.0?forkLandmarks
        :Math.hypot(hero.x+9,hero.z-1.4)<3.4?logLandmarks:noLandmarks;
      art.clearSight(camera,hero,buddy,landmarks);
      art.step(hero,still,moving);
      shelter.highlight(action==='leaf');
      regions.tick(t,still,hero,camera,buddy,landmarks);
      gaze.update(camera,hero,buddy,landmarks);
      waterClock.value=still?0:t;
      water.visible=hero.z<16 && hero.z>-.5 && hero.x>-8 && hero.x<12;
      const progress=boatProgress(t,boatAt,still,3.6);
      if(!still && boatAt!==null)wheel.rotation.z=-(progress-.08)*5.5;
      boat.position.z=8.65+progress*5.85;
      boat.position.y=(progress>.82?.29:.35)+(still||boatAt===null?0:Math.sin(t*5)*.022);
      for(const highlight of boatParts)highlight.visible=action==='wheel';
      for(const mark of wake)mark.visible=progress>.08;
      const age = t - echoAt;
      pulse.visible = age < 1.8;
      if (echoPending && age > 0.48) {
        echoPending = false;
        window.DaviGame?.sound();
      }
      if (pulse.visible) pulse.scale.setScalar(still ? 0.6 : 0.2 + (age % 0.6));
      for (const {mesh,i,item,bounds,foreground} of fade) {
        const obscures=gaze.covers(bounds.center,bounds.radius*.83,.13,foreground);
        if (obscures !== !!item.hidden) {
          mesh.setMatrixAt(i,obscures?hideMatrix:item.matrix);
          mesh.instanceMatrix.needsUpdate=true;
          item.hidden=obscures;
        }
      }
    },
  };
}
