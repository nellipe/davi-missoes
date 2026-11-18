import * as T from '/vendor/three/three.module.min.js';
import { terrainHeight } from './navigation.mjs';
import { buildShelter } from './beetle.mjs';
import { inBosque, installBosque } from './bosque.mjs';
import { installRegions } from './regions.mjs';

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
    wheel:'Um barquinho de folha passa sob a roda.',
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

export function build(scene, leafUp, library, grain) {
  let seed = 7239;
  const random = () => (seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296;
  const group = new T.Group();
  scene.add(group);
  const material = new T.MeshStandardMaterial({ roughness: .83 });
  const shapes = {
    slab: new T.BoxGeometry(1, 1, 1),
    stone: library.getObjectByName('Ardosia').geometry.clone().center().scale(.82,.93,1.03).deleteAttribute('color'),
    crown: new T.SphereGeometry(1,10,6),
    trunk: new T.CylinderGeometry(.74,1,1,9),
    ring: new T.TorusGeometry(1, 0.19, 6, 16),
    leaf: new T.OctahedronGeometry(1),
  };
  const batches = new Map(),
    dummy = new T.Object3D(),
    fade = [];
  function piece(shape, color, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, shield = false) {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    if (!batches.has(shape)) batches.set(shape, []);
    batches
      .get(shape)
      .push({ matrix: dummy.matrix.clone(), color, shield, x, y, z, top:y+sy*.65, r: Math.max(sx, sz) * 0.85 });
  }
  const positions = [],
    colors = [],
    uv = [],
    indices = [];
  const grass = new T.Color('#709258'),
    earth = new T.Color('#d4b681'),
    stonePath = new T.Color('#d8cfaa'),
    moss = new T.Color('#426e55');
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
      if (inBosque(x,z)) {
        const roughEdge = border + .24*Math.sin(x*2.4-z*3.5) + .14*Math.cos(x*6.2+z*3.6);
        const pathLight = 1-T.MathUtils.smoothstep(roughEdge,-.77,.65);
        const variation = .5+.29*Math.sin(x*.98+z*.84)+.21*Math.sin(z*3.27-x*2.8);
        const soil = new T.Color('#496b49').lerp(new T.Color('#7a8951'),variation);
        const clay = new T.Color(x>3.7&&z<5 ? '#b2a999' : '#b9905c');
        soil.lerp(clay,pathLight);
        const dapple = Math.sin(x*1.88 + Math.cos(z*1.63)) * Math.sin(z*1.37-x*.89);
        soil.multiplyScalar(.91 + .14*variation + .20*dapple + .15*pigment);
        const taper = T.MathUtils.smoothstep(Math.min(x+13.2,10.7-x,z+4.2,9.8-z),0,2);
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
  const terrain = new T.Mesh(geometry, new T.MeshStandardMaterial({
    vertexColors: true, roughness: 1, map: grain,
  }));
  terrain.receiveShadow = true;
  group.add(terrain);

  function rock(x, z, w, h, d, color = '#68847b', rotation = 0) {
    piece('stone', color, x, floor(x, z) + h * 0.45, z, w, h * 0.74, d, 0, rotation, 0.08, true);
  }
  function tree(x, z, h) {
    const y = floor(x, z),
      tint = random() > 0.55 ? '#4d8467' : '#397460';
    piece('trunk', '#977e60', x, y + h * 0.38, z, 0.24, h * 0.76, 0.25, 0, 0, 0.03, true);
    piece('crown', tint, x, y + h * 0.83, z, h * 0.32, h * 0.39, h * 0.3, 0, random() * 3, 0, true);
    piece(
      'crown',
      '#83a06a',
      x - 0.25,
      y + h * 1.03,
      z + 0.12,
      h * 0.22,
      h * 0.22,
      h * 0.21,
      0,
      random() * 3,
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
    if (!inBosque(x,z)) rock(x,z,w,h,d,['#677e73','#7e9381','#597674'][i%3],i*.65);
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
        random() > 0.5 ? '#739269' : '#9ca889',
        random() * 6
      );
  }
  for (let i = 0; i < 380; i++) {
    const x = random() * 26 - 13,
      z = random() * 32 - 15;
    if (inBosque(x,z) || z < -13 || Math.abs(edge(x, z) - 0.44) > 0.72) continue;
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
  // The mill, trough and recurring leaf boats identify home even in silhouette.
  const wheel = new T.Group();
  wheel.position.set(-1.28, floor(-1.28, 13) + 0.83, 13);
  group.add(wheel);
  const moving = (parent, shape, tint, x, y, z, sx, sy, sz) => {
    const mesh = new T.Mesh(shapes[shape], new T.MeshStandardMaterial({ color: tint, roughness:.72 }));
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
  };
  moving(wheel, 'ring', '#895534', 0, 0, 0, 0.81, 0.81, 0.54);
  for (const [count,tint,scale,radius] of [[6,'#bc8a59',[.088,1.65,.11],0],[10,'#e2b97d',[.19,.26,.43],.82]]) {
    const ringParts=new T.InstancedMesh(shapes.slab,new T.MeshStandardMaterial({color:tint,roughness:.70}),count);
    for(let i=0;i<count;i++){
      const a=i*(radius?Math.PI*2:Math.PI)/count;
      dummy.position.set(Math.cos(a)*radius,Math.sin(a)*radius,0);
      dummy.scale.set(...scale);
      dummy.rotation.set(0,0,a);
      dummy.updateMatrix();
      ringParts.setMatrixAt(i,dummy.matrix);
    }
    wheel.add(ringParts);
  }
  piece('trunk', '#5b5142', -1.28, wheel.position.y, 13, 0.16, 1.35, 0.16, Math.PI / 2);
  for (const x of [-1.84, -0.92]) piece('slab', '#97744e', x, 0.08, 11.15, 0.13, 0.46, 5.7);
  piece('slab', '#76b9af', -1.38, 0.21, 11.15, 0.82, 0.12, 5.7);
  const boat = new T.Group();
  boat.position.set(-1.38, 0.35, 9);
  group.add(boat);
  moving(boat, 'leaf', '#b77432', 0, -0.025, 0, 0.22, 0.085, 0.48);
  for (const sign of [-1, 1]) {
    const side = moving(boat, 'leaf', '#ecc15f', sign * 0.105, 0.04, 0, 0.135, 0.055, 0.46);
    side.rotation.z = sign * 0.45;
  }
  moving(boat, 'slab', '#715c3c', 0, 0.07, 0, 0.027, 0.045, 0.69);
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
  const art = installBosque(group, library, layout, floor, edge);
  const regions = installRegions(group, library, layout, floor, edge);
  const shelter = buildShelter(floor, leafUp);
  group.add(shelter.group);
  for (let i = 0; i < 3; i++) rock(8 + 0.22 * i, 0.9 - 0.65 * i, 0.43, 0.8 + i * 0.3, 0.35, '#abac94');
  const pulse = moving(group, 'ring', '#f9da8e', 7.8, floor(7.8, 0.35) + 1, 0.35, 0.1, 0.1, 0.1);
  // Water drops through a notch between two limestone faces, beyond the walkable shelf.
  for (let i = 0; i < 7; i++) {
    const x = -7.5 + i * 0.98;
    if (i === 3 || i === 4) continue;
    piece('stone', '#587577', x, -0.05, -16, 1.25, 2.25, 1, 0, i * 0.35);
    piece('stone', '#89a09a', x, 1.02, -16.4, 1.16, 1.55, 1.1, 0, 0.42 * i);
  }
  piece('slab', '#499a9c', -4, -1.55, -17, 12, 0.18, 4);
  for (let i = 0; i < 6; i++)
    piece('slab', i % 2 ? '#a5dcd2' : '#72bdbb', -4.72 + i * 0.22, 0.18, -15.68, 0.26, 3.6, 0.2);
  for (let i = 0; i < 8; i++) piece('crown', '#c7e5d3', -4.9 + 0.28 * i, -1.44, -15.2, 0.46, 0.21, 0.45);
  for (let i = 0; i < 4; i++)
    piece('slab', '#927350', -5.15 + i * 0.67, floor(-5.15 + i * 0.67, -13.55) + 0.43, -13.55, 0.1, 0.9, 0.1);
  piece('slab', '#c7a174', -4.15, floor(-4.15, -13.55) + 0.82, -13.55, 2.4, 0.1, 0.13);
  const blockers = [];
  for (const [shape, list] of batches) {
    const mesh = new T.InstancedMesh(shapes[shape], material, list.length);
    list.forEach((p, i) => {
      mesh.setMatrixAt(i, p.matrix);
      mesh.setColorAt(i, new T.Color(p.color));
      if (p.shield) fade.push({ mesh, i, ...p, hidden: false });
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (list.some((p) => p.shield)) blockers.push({ mesh, list });
  }
  let echoAt = -10,
    boatAt = 0,
    echoPending = false;
  const hideMatrix = new T.Matrix4().makeScale(0, 0, 0);
  return {
    group,
    terrain,
    shelter,
    setEconomy(low) { art.setEconomy(low); regions.setEconomy(low); },
    blocksTap(ray, hit) {
      if (art.blocksTap(ray,hit)) return true;
      return blockers.some(({ mesh, list }) =>
        ray
          .intersectObject(mesh, false)
          .some((p) => p.distance + 0.02 < hit.distance && list[p.instanceId].shield)
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
    tick(t, still, camera, hero) {
      art.clearSight(camera,hero);
      regions.tick(t,still,hero,camera);
      if (!still) wheel.rotation.z = -t * 0.65;
      boat.position.z = 9.0 + (still ? 0.76 : ((t - boatAt) % 7) / 7) * 4.5;
      const age = t - echoAt;
      pulse.visible = age < 1.8;
      if (echoPending && age > 0.48) {
        echoPending = false;
        window.DaviGame?.sound();
      }
      if (pulse.visible) pulse.scale.setScalar(still ? 0.6 : 0.2 + (age % 0.6));
      const dx = camera.x - hero.x,
        dz = camera.z - hero.z,
        length = dx * dx + dz * dz;
      for (const p of fade) {
        const k = ((p.x - hero.x) * dx + (p.z - hero.z) * dz) / length;
        const obscures =
          k > 0 &&
          k < 1.12 &&
          Math.hypot(hero.x + k * dx - p.x, hero.z + k * dz - p.z) < p.r + 1.45 &&
          p.top >= hero.y - 0.7 + k * (camera.y - hero.y);
        if (obscures !== p.hidden) {
          p.mesh.setMatrixAt(p.i, obscures ? hideMatrix : p.matrix);
          p.mesh.instanceMatrix.needsUpdate = true;
          p.hidden = obscures;
        }
      }
    },
  };
}
