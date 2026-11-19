import * as T from '/vendor/three/three.module.min.js';
import { gem } from './chibi.mjs';
import { recanto, visibleSpot } from './recanto.mjs';

const FLIP_SECONDS = .58;
const CARRY_START = 1.02;
const CARRY_END = 2.42;
const LEAF_PITCH = .045;
const leafRoll = up => up ? .18 : -.19;

function woodlandLeaf() {
  const positions=[], colors=[], faces=[];
  const spine=new T.Color('#aad967'), shade=new T.Color('#589639');
  const rows=[
    // z, midrib offset and height, left and right blade widths
    [-.67, .035, .015, .015, .025],
    [-.52, .014, .059, .27, .22],
    [-.33, -.012, .079, .46, .49],
    [-.14, -.037, .105, .58, .54],
    [.10, -.036, .103, .55, .58],
    [.30, -.065, .079, .45, .46],
    [.49, -.095, .039, .27, .32],
    [.74, -.16, -.018, .009, .009],
  ];
  for(const [i,[z,x,h,left,right]] of rows.entries()){
    for(const [j,t] of [-1,-.58,-.055,0,.055,.58,1].entries()){
      const bend=Math.abs(t);
      positions.push(x+t*(t<0?left:right),h-(.064+.014*Math.sin(i*1.5))*bend**1.4,
        z+.084*bend*Math.sin(Math.PI*i/(rows.length-1)));
      const color=spine.clone().lerp(shade,.17+.70*bend+(t<0?.055:0));
      colors.push(color.r,color.g,color.b);
      if(i<rows.length-1&&j<6){
        const a=i*7+j;
        faces.push(a,a+7,a+1,a+1,a+7,a+8);
      }
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setIndex(faces);
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  return geometry;
}

export function buildShelter(floor, leafUp, paint) {
  const group = new T.Group();
  const [leafX,leafZ] = recanto.leaf;
  group.position.set(leafX, floor(leafX,leafZ), leafZ);
  const sphere = new T.SphereGeometry(1, 14, 9);
  const stick = new T.BoxGeometry(1, 1, 1);
  const drop = new T.OctahedronGeometry(1);
  const thread = new T.CylinderGeometry(.85, 1, 1, 6, 1, true);
  const materials = new Map();
  function part(parent, geometry, color, position, size) {
    if (!materials.has(color)) materials.set(color, paint.toon(color));
    const mesh = new T.Mesh(geometry, materials.get(color));
    mesh.position.set(...position);
    mesh.scale.set(...size);
    parent.add(mesh);
    return mesh;
  }

  const carriedShape = new T.BufferGeometry();
  carriedShape.setAttribute('position', new T.Float32BufferAttribute([
    0, 0, -.83, -.44, .07, -.37, -.54, .02, .16, -.31, .05, .51, 0, 0, .72,
    .31, .05, .51, .54, .02, .16, .44, .07, -.37, 0, .17, -.05,
  ], 3));
  carriedShape.setIndex([8, 0, 1, 8, 1, 2, 8, 2, 3, 8, 3, 4, 8, 4, 5, 8, 5, 6, 8, 6, 7, 8, 7, 0]);
  carriedShape.computeVertexNormals();
  const leaf=woodlandLeaf();
  const wood = '#a67749', shell = '#dd7946', dark = '#34264a';
  const hinge = new T.Group();
  hinge.position.y=.195;
  group.add(hinge);
  const roof=new T.Mesh(leaf,paint.toon('#ffffff',{vertexColors:true,side:T.DoubleSide}));
  hinge.add(roof);
  const leafEdge=part(hinge,leaf,'#365c37',[0,-.018,0],[1.031,1,1.026]);
  const leafMark=part(hinge,leaf,gem,[0,-.027,0],[1.086,1,1.075]);
  leafEdge.material=new T.MeshBasicMaterial({color:0x365c37,side:T.DoubleSide});
  leafMark.material=new T.MeshBasicMaterial({color:gem,side:T.DoubleSide});
  const petiole=part(hinge,sphere,'#797846',[.056,-.038,-.75],[.035,.028,.20]);
  petiole.rotation.x=-.29;
  // A fallen twig drips onto the midrib and lies low enough to step over.
  const twig=part(group,sphere,wood,[.17,.218,-.58],[.052,.048,.40]);
  twig.rotation.x=-.48;
  twig.rotation.y=-.075;
  const water = '#39aebc';
  const glint = '#b5ecdf';
  const inlet = new T.Vector3(.14, .405, -.225);
  const fall = part(group, thread, water, [0, 0, 0], [1, 1, 1]);
  const spill = part(group, thread, water, [0, 0, 0], [1, 1, 1]);
  const falling = part(group, drop, glint, [0, 0, 0], [.034, .073, .034]);
  const dropAtLip = part(group, drop, glint, [0, 0, 0], [.060, .12, .060]);
  const ring = new T.RingGeometry(.78, 1, 16);
  ring.rotateX(-Math.PI / 2);
  const ripple = part(group, ring, glint, [0, 0, 0], [.18, 1, .14]);
  const splash = [-1, 0, 1].map(() => part(group, drop, glint, [0, 0, 0], [.033, .05, .028]));
  const basins = recanto.basins.map(([x,z],i)=>createBasin(x,z,i===0?-1:1));

  function createBasin(x, z, side) {
    const ground = floor(group.position.x + x, group.position.z + z) - group.position.y;
    const rim = new T.BufferGeometry();
    const positions = [], indices = [], colors = [];
    const rockColor = new T.Color(side < 0 ? '#858775' : '#998872');
    for (const [band, radius, elevation, shade] of [[0, 1, .015, .61], [1, .88, .108, 1.17], [2, .71, .062, .87]]) {
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6;
        const contour = radius * (1 + .075 * Math.sin(i * 2.52 + side));
        positions.push(.58 * Math.cos(angle) * contour, elevation + .024 * Math.sin(i * 1.8),
          .37 * Math.sin(angle) * contour);
        const color = rockColor.clone().multiplyScalar(shade + .11 * Math.sin(i * 3 + band));
        colors.push(color.r, color.g, color.b);
        const a = band * 12 + i, b = band * 12 + (i + 1) % 12;
        if (band < 2) indices.push(a, a + 12, b, b, a + 12, b + 12);
      }
    }
    rim.setIndex(indices);
    rim.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    rim.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    rim.computeVertexNormals();
    const stones = new T.Mesh(rim, new T.MeshStandardMaterial({ vertexColors: true, side: T.DoubleSide }));
    group.add(stones);
    stones.position.set(x, ground, z);
    stones.rotation.y = side * .18;
    part(stones, sphere, '#534d36', [0, .029, 0], [.45, .021, .28]);
    const pool = part(stones, sphere, '#258c99', [0, .051, 0], [.45, .024, .28]);
    const groove = new T.CatmullRomCurve3([
      new T.Vector3(.12, .115, -.225), new T.Vector3(side * .16, .116, -.075),
      new T.Vector3(side * .34, .093, .16), new T.Vector3(side * .51, .057, .34),
    ]);
    const strip = part(hinge, new T.TubeGeometry(groove, 12, .024, 5, false),
      water, [0, 0, 0], [1, 1, 1]);
    return { pool, fill: 0, startFill: 0, strip, groove, impact: new T.Vector3(x, ground + .083, z) };
  }

  const beetle = new T.Group();
  beetle.name='Recanto:Besouro';
  beetle.scale.setScalar(1.39);
  group.add(beetle);
  part(beetle, sphere, dark, [0, .21, .04], [.26, .17, .35]);
  for (const side of [-1, 1]) {
    part(beetle, sphere, shell, [side * .141, .31, -.075], [.154, .16, .32]);
    part(beetle, sphere, '#e8a253', [side * .17, .433, .035], [.073, .045, .101]);
  }
  part(beetle, sphere, dark, [0, .24, .29], [.206, .17, .162]);
  const antennae = [];
  for (const side of [-1, 1]) {
    part(beetle, sphere, '#fff3d3', [side * .102, .28, .414], [.077, .080, .047]);
    part(beetle, sphere, dark, [side * .099, .285, .448], [.027, .033, .014]);
    part(beetle, sphere, '#ffffff', [side*.099+.009,.298,.461], [.011,.011,.007]);
    part(beetle, sphere, '#ff9ca3', [side*.159,.234,.401], [.037,.019,.025]);
    const feeler = new T.Group();
    feeler.position.set(side*.067,.34,.323);
    beetle.add(feeler);
    antennae.push({ feeler, side });
    const antenna = part(feeler, stick, dark, [side * .04, .077, 0], [.028, .21, .03]);
    antenna.rotation.z = -side * .45;
    part(feeler, sphere, '#e79857', [side * .087, .177, 0], [.049, .046, .042]);
  }
  // The face and the painted shell marks share their materials. Antennae
  // remain separate so they can react while the beetle carries the leaf.
  const surfaces=new Map();
  for(const part of beetle.children){
    if(part.geometry!==sphere)continue;
    if(!surfaces.has(part.material))surfaces.set(part.material,[]);
    surfaces.get(part.material).push(part);
  }
  for(const [paint,parts] of surfaces){
    const instance=new T.InstancedMesh(sphere,paint,parts.length);
    parts.forEach((part,i)=>{
      part.updateMatrix();
      instance.setMatrixAt(i,part.matrix);
      part.removeFromParent();
    });
    beetle.add(instance);
  }
  const feet = [];
  const feetMesh=new T.InstancedMesh(sphere,materials.get(dark),6);
  feetMesh.frustumCulled=false;
  beetle.add(feetMesh);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const foot=new T.Object3D();
      foot.position.set(side*.252,.084,.14-i*.188);
      foot.scale.set(.152,.046,.042);
      foot.rotation.y = (i - 1) * side * .48;
      feet.push({ foot, side, index: i, restingZ: foot.position.z });
    }
  }
  const carriedLeaf = new T.Group();
  carriedLeaf.position.set(0, .51, -.33);
  beetle.add(carriedLeaf);
  const tile = part(carriedLeaf, carriedShape, '#bbce88', [0, 0, 0], [.53, .65, .51]);
  tile.material.side = T.DoubleSide;
  part(carriedLeaf, sphere, '#8d9753', [0, .095, -.01], [.022, .025, .33]);
  carriedLeaf.rotation.x = -.13;

  let up = leafUp;
  let movedAt = -10;
  let seen = false;
  let arrivedAt = -10;
  let streamSide = up ? 0 : 1;
  let startingRoll = leafRoll(up);
  let age = 10;
  const oldPosition = new T.Vector3();
  const destination = new T.Vector3();
  const vertical = new T.Vector3(0, 1, 0);
  const direction = new T.Vector3();
  const leafLip = new T.Vector3();
  const splashPoint = new T.Vector3();
  const leafInlet = new T.Vector3();
  const shelters = recanto.shelters.map(([x,z])=>
    [x, floor(leafX+x,leafZ+z)-group.position.y+.015, z]);
  beetle.position.set(...shelters[streamSide]);
  basins[streamSide].fill = 1;

  function connect(mesh, start, end, radius) {
    direction.subVectors(end, start);
    const length = direction.length();
    mesh.position.copy(start).lerp(end, .5);
    mesh.quaternion.setFromUnitVectors(vertical, direction.divideScalar(length));
    mesh.scale.set(radius, length, radius);
  }

  let faceYaw=0, sidestepX=0, sidestepZ=0;
  function update(time, still, camera, hero, buddy, dt, reachable) {
    age = still ? 10 : time - movedAt;
    const target = up ? 0 : 1;
    const flip = T.MathUtils.smoothstep(age, 0, FLIP_SECONDS);
    hinge.rotation.set(LEAF_PITCH, .04, T.MathUtils.lerp(startingRoll, leafRoll(up), flip));
    hinge.updateMatrix();
    if (flip > .58) streamSide = target;
    const wet = basins[streamSide];
    const init = basins[target];
    const drain = T.MathUtils.smoothstep(age, .32, 1.72);
    const fill = T.MathUtils.smoothstep(age, .45, 1.29);
    for (const basin of basins) {
      basin.fill = T.MathUtils.lerp(basin.startFill, basin === init ? 1 : 0, basin === init ? fill : drain);
      basin.pool.visible = basin.fill > .025;
      basin.pool.scale.set(.45 * Math.sqrt(basin.fill), .024, .28 * Math.sqrt(basin.fill));
      basin.strip.visible = basin === wet;
    }
    leafInlet.copy(wet.groove.points[0]).applyMatrix4(hinge.matrix);
    leafLip.copy(wet.groove.points.at(-1)).applyMatrix4(hinge.matrix);
    const phase = still ? .66 : (time * 1.38) % 1;
    connect(fall, inlet, leafInlet, .018);
    connect(spill, leafLip, wet.impact, .028 + (!still && age > .39 && age < .97 ? .009 : 0));
    falling.position.copy(inlet).lerp(leafInlet, phase);
    dropAtLip.position.copy(leafLip).lerp(wet.impact, phase ** 1.6);
    splashPoint.copy(wet.impact).y += .009;
    ripple.position.copy(splashPoint);
    ripple.scale.set(.110 + phase * .24, 1, .066 + phase * .13);
    const landing = age > .46 && age < .9 ? (age - .46) / .44 : phase;
    for (const [i, bead] of splash.entries()) {
      bead.visible = !still && landing > .48;
      const hop = (landing - .48) / .52;
      bead.position.copy(splashPoint);
      bead.position.x += (i - 1) * hop * .24;
      bead.position.y += Math.sin(hop * Math.PI) * (.15 + i % 2 * .055);
      bead.position.z += hop * .16;
    }

    const walk = T.MathUtils.smoothstep(age, CARRY_START, CARRY_END);
    const moving = walk > 0 && walk < 1;
    destination.set(...shelters[target]);
    if (walk < 1) {
      beetle.position.lerpVectors(oldPosition, destination, walk);
      beetle.position.z += .23 * Math.sin(Math.PI * walk);
      beetle.position.y = floor(group.position.x + beetle.position.x, group.position.z + beetle.position.z)
        - group.position.y + .015;
    } else {
      beetle.position.copy(destination);
      if (!still)
        beetle.position.x += (up ? -.11 : .16) * Math.sin(Math.PI * T.MathUtils.smoothstep(time - arrivedAt, 0, 1.42));
    }
    if(reachable){
      const x=beetle.position.x+leafX,z=beetle.position.z+leafZ;
      const [u,v]=moving?[x,z]:visibleSpot(x,z,camera,hero,buddy,reachable);
      sidestepX=still?u-x:T.MathUtils.damp(sidestepX,u-x,13,dt);
      sidestepZ=still?v-z:T.MathUtils.damp(sidestepZ,v-z,13,dt);
      beetle.position.x+=sidestepX;
      beetle.position.z+=sidestepZ;
      beetle.position.y=floor(beetle.position.x+leafX,beetle.position.z+leafZ)-group.position.y+.015;
    }
    const look = Math.sin(Math.PI * T.MathUtils.smoothstep(age, .51, 2.5));
    if(camera){
      const yaw=Math.atan2(camera.x-leafX-beetle.position.x,camera.z-leafZ-beetle.position.z);
      const delta=Math.atan2(Math.sin(yaw-faceYaw),Math.cos(yaw-faceYaw));
      faceYaw+=delta*(still?1:.15);
    }
    beetle.rotation.y = faceYaw+(up ? 1 : -1)*look*.55;
    const stepping = !still && (moving || time - arrivedAt < 1.42);
    const gait = age * 19;
    carriedLeaf.rotation.z = stepping ? .13 * Math.sin(gait) : -.13 * (up ? 1 : -1);
    carriedLeaf.rotation.x = -.13 - look * .15;
    carriedLeaf.position.y = .51 + look * .07 + (stepping ? .041 * Math.cos(gait * 2) : 0);
    for(const { feeler, side } of antennae)
      feeler.rotation.z = still ? 0 : side * (.07 + .12*Math.sin(time*(stepping?9:2.7)));
    for (const [i,{ foot, restingZ, side, index }] of feet.entries()) {
      const footfall = stepping ? Math.sin(gait + (index + Number(side > 0)) * Math.PI) : 0;
      foot.position.y = .084 + Math.max(0,footfall) * .06;
      foot.position.z = restingZ + footfall * .071;
      foot.updateMatrix();
      feetMesh.setMatrixAt(i,foot.matrix);
    }
    feetMesh.instanceMatrix.needsUpdate=true;
  }
  update(0, true);
  return {
    group,
    beetle,
    highlight(active) { leafMark.visible=active; },
    // The same crease can be used directly or through the contextual action.
    pickLeaf(ray, groundHit) {
      const picked = ray.intersectObject(roof, false)[0];
      return picked && (!groundHit || picked.distance < groundHit.distance) ? picked : null;
    },
    set(value, time) {
      oldPosition.copy(beetle.position);
      sidestepX=sidestepZ=0;
      startingRoll = hinge.rotation.z;
      for (const basin of basins) basin.startFill = basin.fill;
      up = value;
      movedAt = time;
    },
    tick(time, still, near, camera, hero, buddy, dt, reachable) {
      const reaction = near && !seen;
      if (reaction) arrivedAt = time;
      seen = near;
      update(time, still, camera, hero, buddy, dt, reachable);
      return reaction;
    },
    diagnostics() {
      return {
        leafUp: up,
        beetle: beetle.getWorldPosition(new T.Vector3()).toArray(),
        pool: group.localToWorld(basins[streamSide].impact.clone()).toArray(),
        leaf: hinge.getWorldPosition(new T.Vector3()).toArray(),
        leafRoll: hinge.rotation.z,
        wetBasin: streamSide,
        basinFill: basins.map(basin => basin.fill),
        phase: age < FLIP_SECONDS ? 'flip' : age < CARRY_START ? 'water' : age < CARRY_END ? 'carry' : 'rest',
      };
    },
  };
}
