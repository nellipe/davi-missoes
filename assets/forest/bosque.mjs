import * as T from '/vendor/three/three.module.min.js';

const trees = [
  ['Carvalho', -2.2, 7.5, 1.08, -.42],
  ['Amieiro', 6.35, 8.15, .96, .7],
  ['Carvalho', -.05, 1.65, .89, -.34],
  ['Amieiro', 3.35, -.69, .92, 1.8],
  ['Amieiro', -5.25, 5.9, 1.07, -.64],
  ['Carvalho', -8.75, 5.15, .91, 1.38],
  ['Amieiro', -12.5, 3.2, 1.08, -.79],
  ['Carvalho', -11.44, -3.55, .88, 2.1],
  ['Amieiro', -7.42, -2.83, .83, .93],
  ['Carvalho', 8.32, 2.62, 1.02, -.85],
  ['Amieiro', 9.38, 5.35, .96, 1.38],
  ['Carvalho', 9.42, -.71, 1.09, .79],
  ['Amieiro', 4.55, -3.58, .91, -1.53],
  ['Carvalho', .66, -3.90, .85, -.83],
  ['Amieiro', -2.43, -3.33, .77, .45],
];

const shelves = [
  [-.90, 8.50, 1.55, 1.59, 1.17, .63],
  [-3.30, 8.90, 1.10, 1.37, 1.18, .30],
  [ .10, .10, 2.02, 1.62, 1.73, -.40],
  [ 2.00, -.60, 1.55, 1.76, 1.49, 1.80],
  [-1.55, -1.40, 1.34, 1.54, 1.24, .76],
  [ 4.90, 1.45, 1.06, .90, .69, -.9],
  [ 6.86, 5.70, 1.10, 1.31, 1.48, -.30],
  [ 8.66, 4.15, 1.20, 1.10, 1.1, .6],
  [-11.66, -1.62, .72, .55, .74, .7],
  [-11.82, .55, .45, .37, .40, -.4],
  [-6.47, 4.58, .73, .6, .78, -.6],
  [-4.3, 5.58, .62, .55, .70, 1.3],
  [-4.2, -.11, .94, .79, .81, -.3],
  [ 2.57, 3.33, .53, .48, .82, -.82],
  [ 3.36, 3.51, .45, .32, .65, .15],
];

export function inBosque(x, z) {
  return x > -13.2 && x < 10.7 && z > -4.2 && z < 9.8;
}

export function installBosque(group, library, layout, floor, edge) {
  const art = new T.Group();
  const details = new T.Group();
  const blockers = [];
  const crowns = [];
  const trunks = [];
  group.add(art);
  art.add(details);
  const material = library.getObjectByName('Carvalho_Copa').material.clone();
  material.vertexColors = true;
  let seed = 24049;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const get = (name) => library.getObjectByName(name).geometry;
  const batches = new Map();
  function place(name, x, z, sx, sy, sz, turn, { detail = false, solid = false, lift = 0 } = {}) {
    const parent = detail ? details : art;
    const geometry = get(name);
    if (solid) {
      const mesh = new T.Mesh(geometry, material);
      mesh.position.set(x, floor(x, z) + lift, z);
      mesh.scale.set(sx, sy, sz);
      mesh.rotation.y = turn;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      blockers.push(mesh);
      return mesh;
    }
    const key = name + (detail ? '.detail' : '');
    if (!batches.has(key)) batches.set(key, { parent, geometry, poses: [] });
    batches.get(key).poses.push([x, z, sx, sy, sz, turn, lift]);
  }
  for (const [kind, x, z, size, turn] of trees) {
    const trunk=place(kind + '_Tronco', x, z, size, size, size, turn, { solid: true });
    trunks.push({ trunk, x, z, height: 5.4*size, radius: 1.12*size });
    place(kind + '_Copa', x, z, size, size, size, turn);
    place(kind + '_Pontas', x, z, size, size, size, turn, { detail: true });
  }
  for (const [x, z, sx, sy, sz, turn] of shelves) {
    place('Ardosia', x, z, sx, sy, sz, turn, { solid: sy >= .75 });
  }
  place('Tronco_Oco', -7.78, .24, 1, 1, 1, Math.PI+.21, { solid: true, lift: .87 });
  place('Varal', 2.95, 2.95, 1, 1, 1, -.06, { solid: true });

  // Irregular widths, chords and gaps follow the same center lines as the previous treads.
  for (const index of [1, 2]) {
    const line = layout.paths[index].points;
    for (let i = 1; i < line.length; i++) {
      const [a, b] = line[i - 1], [c, d] = line[i];
      const steps = Math.ceil(Math.hypot(c-a, d-b) / .70);
      for (let k = 0; k < steps; k++) {
        const t = (k + .44 + random()*.12) / steps;
        const x = T.MathUtils.lerp(a, c, t), z = T.MathUtils.lerp(b, d, t);
        if (!inBosque(x,z)) continue;
        const skew = (random()-.5)*.34;
        const width = .89 + random()*.31;
        const turn = Math.atan2(c-a,d-b);
        place(index === 1 ? 'Passo_Casca' : 'Passo_Pedra',
          x + skew*Math.cos(turn), z - skew*Math.sin(turn), width, .86, .67+random()*.24,
          turn+(random()-.5)*.28, { lift: -.015 });
      }
    }
  }

  // Colonies follow the light and rock footings. The recanto and the touchable exits stay open.
  const colonies = [
    [-1.40, 7.0, .9], [-2.8, 5.6, 1.05], [.25, 6.32, .7], [4.66, 7.9, .64],
    [5.68, 5.69, .8], [2.96, 3.1, .69], [1.33, 2.32, .88], [-.5, 2.16, .71],
    [-4.5, 4.5, .92], [-7.2, 4.6, .76], [-8.8, 3.5, .76], [-12.05, 2.3, .61],
    [-11.95, -.32, .74], [-8.3, -1.32, .83], [-6.95, .15, .59],
    [4.65, 2.8, .66], [7.72, 2.23, .72], [8.51, .97, .92], [6.49, -.87, .70],
    [-1.08, -.43, .76], [2.9, -1.45, .81],
  ];
  for (const [x,z,s] of colonies) {
    for (let i=0;i<7;i++) {
      const angle = random()*Math.PI*2;
      const range = .12+random()*.92;
      const u = x+range*Math.cos(angle), v = z+range*Math.sin(angle);
      if (edge(u,v)<.30 || (u < -8.6 && u > -11.99 && v > -.76 && v < 1.93)) continue;
      const name = i < 2 ? 'Samambaia' : i === 2 ? 'Flores' : 'Trevo';
      const size = s*(i < 2 ? .65+random()*.66 : .65+random()*.40);
      place(name, u, v, size, size, size, angle, { detail: i === 2 || i > 4 });
    }
  }
  for (let i=0;i<560;i++) {
    const x=1+random()*24-13, z=random()*12-3;
    const rim=edge(x,z);
    if (rim < -.40 || rim > 1.04 || (x < -8.6 && x > -12.05 && z > -.7 && z < 1.9)) continue;
    const s=.13+random()*.31, turn=random()*6.28;
    place('Cascalho',x,z,s,.26+s*.25,s,turn,{detail:i%3===0});
    if (rim > -.10 && i % 3 === 1)
      place('Trevo',x,z,s,s,s,turn,{detail:true});
  }
  const pose = new T.Object3D();
  const surfaceUp = new T.Vector3();
  const vertical = new T.Vector3(0,1,0);
  const turnAroundY = new T.Quaternion();
  const invisible = new T.Matrix4().makeScale(0,0,0);
  for (const [name, { parent, geometry, poses }] of batches) {
    const mesh = new T.InstancedMesh(geometry,material,poses.length);
    const canopy = /_Copa|_Pontas/.test(name);
    const tread = name.startsWith('Passo');
    poses.forEach(([x,z,sx,sy,sz,turn,lift],i) => {
      pose.position.set(x,floor(x,z)+lift,z);
      pose.scale.set(sx,sy,sz);
      pose.rotation.y=turn;
      if(tread){
        surfaceUp.set(floor(x-.30,z)-floor(x+.30,z),.60,floor(x,z-.30)-floor(x,z+.30)).normalize();
        pose.quaternion.setFromUnitVectors(vertical,surfaceUp).multiply(turnAroundY.setFromAxisAngle(vertical,turn));
      }
      pose.updateMatrix();
      mesh.setMatrixAt(i,pose.matrix);
      if(canopy) crowns.push({
        mesh, i, matrix:pose.matrix.clone(), center: new T.Vector3(x,pose.position.y+4.95*sy,z),
        radius: 2.25*sy, hidden: false,
      });
    });
    mesh.castShadow = parent === art;
    mesh.receiveShadow = true;
    parent.add(mesh);
  }
  const cameraToHero = new T.Vector3();
  const offset = new T.Vector3();
  const sight = new T.Vector3();
  return {
    setEconomy(low) { details.visible = !low; },
    clearSight(camera, hero) {
      const dx=hero.x-camera.x, dz=hero.z-camera.z;
      const distanceSq=dx*dx+dz*dz;
      for(const { trunk,x,z,height,radius } of trunks){
        const t=((x-camera.x)*dx+(z-camera.z)*dz)/distanceSq;
        const rayY=T.MathUtils.lerp(camera.y,hero.y+.8,t);
        const inFront=t>-.15 && t<.93;
        const nearRay=(x-camera.x-t*dx)**2+(z-camera.z-t*dz)**2<(radius+.92)**2;
        trunk.visible=!(inFront && nearRay && rayY<trunk.position.y+height);
      }
      cameraToHero.copy(hero).sub(camera).y += .9;
      const length = cameraToHero.length();
      sight.copy(cameraToHero).divideScalar(length);
      for(const crown of crowns){
        offset.copy(crown.center).sub(camera);
        const distance = offset.dot(sight);
        const radius = crown.radius;
        const blocks = distance > -radius && distance < length && (
          offset.lengthSq()-distance*distance < (radius+1.05)**2
        );
        if (blocks !== crown.hidden) {
          crown.hidden=blocks;
          crown.mesh.setMatrixAt(crown.i,blocks?invisible:crown.matrix);
          crown.mesh.instanceMatrix.needsUpdate=true;
        }
      }
    },
    blocksTap(ray, hit) {
      return blockers.some(mesh => mesh.visible && ray.intersectObject(mesh,false)[0]?.distance + .02 < hit.distance);
    },
  };
}
