import * as T from '/vendor/three/three.module.min.js';

const FLIP_SECONDS = .58;
const CARRY_START = 1.02;
const CARRY_END = 2.42;

export function buildShelter(floor, leafUp) {
  const group = new T.Group();
  group.position.set(-10.45, floor(-10.45, -.06), -.06);
  const sphere = new T.SphereGeometry(1, 14, 9);
  const stick = new T.BoxGeometry(1, 1, 1);
  const drop = new T.OctahedronGeometry(1);
  const thread = new T.CylinderGeometry(.85, 1, 1, 6, 1, true);
  const materials = new Map();
  function part(parent, geometry, color, position, size) {
    if (!materials.has(color)) materials.set(color, new T.MeshStandardMaterial({ color }));
    const mesh = new T.Mesh(geometry, materials.get(color));
    mesh.position.set(...position);
    mesh.scale.set(...size);
    parent.add(mesh);
    return mesh;
  }

  const leaf = new T.BufferGeometry();
  leaf.setAttribute('position', new T.Float32BufferAttribute([
    0, 0, -.83, -.44, .07, -.37, -.54, .02, .16, -.31, .05, .51, 0, 0, .72,
    .31, .05, .51, .54, .02, .16, .44, .07, -.37, 0, .17, -.05,
  ], 3));
  leaf.setIndex([8, 0, 1, 8, 1, 2, 8, 2, 3, 8, 3, 4, 8, 4, 5, 8, 5, 6, 8, 6, 7, 8, 7, 0]);
  leaf.computeVertexNormals();
  const wood = '#826044', shell = '#ba6336', dark = '#352525';
  const hinge = new T.Group();
  hinge.position.set(-.59, .73, .02);
  group.add(hinge);
  const roof = part(hinge, leaf, '#91a64c', [0, 0, 0], [1.55, 1, 1.15]);
  roof.material.side = T.DoubleSide;
  roof.material.roughness = .72;
  part(hinge, sphere, '#d3b967', [0, .13, -.04], [.031, .052, .69]);
  for (const side of [-1, 1]) {
    const leg = part(group, stick, wood, [-.59 + side * .25, .36, -.28], [.087, .77, .10]);
    leg.rotation.z = side * .29;
  }
  const twig = part(group, stick, wood, [-.59, 1.40, -.66], [.12, .11, .81]);
  twig.rotation.x = .18;
  const stem = part(group, stick, wood, [-.62, .68, -1.08], [.14, 1.42, .14]);
  stem.rotation.z = -.05;
  const water = '#39aebc';
  const glint = '#b5ecdf';
  const inlet = new T.Vector3(-.59, 1.34, -.28);
  const fall = part(group, thread, water, [0, 0, 0], [1, 1, 1]);
  const spill = part(group, thread, water, [0, 0, 0], [1, 1, 1]);
  const falling = part(group, drop, glint, [0, 0, 0], [.034, .073, .034]);
  const dropAtLip = part(group, drop, glint, [0, 0, 0], [.060, .12, .060]);
  const ring = new T.RingGeometry(.78, 1, 16);
  ring.rotateX(-Math.PI / 2);
  const ripple = part(group, ring, glint, [0, 0, 0], [.18, 1, .14]);
  const splash = [-1, 0, 1].map(() => part(group, drop, glint, [0, 0, 0], [.033, .05, .028]));
  const left = createBasin(-1.33, 1.02, -.55);
  const right = createBasin(.20, 1.27, .58);
  const basins = [left, right];

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
    stones.rotation.y = side * .3;
    part(stones, sphere, '#534d36', [0, .029, 0], [.45, .021, .28]);
    const pool = part(stones, sphere, '#258c99', [0, .051, 0], [.45, .024, .28]);
    pool.material.roughness = .33;
    const groove = new T.CatmullRomCurve3([
      new T.Vector3(0, .17, -.27), new T.Vector3(side * .30, .19, .05),
      new T.Vector3(side * .74, .116, .29), new T.Vector3(side, .057, .48),
    ]);
    const strip = part(hinge, new T.TubeGeometry(groove, 12, .046, 5, false),
      water, [0, 0, 0], [1, 1, 1]);
    return { pool, fill: 0, startFill: 0, strip, groove, impact: new T.Vector3(x, ground + .083, z) };
  }

  const beetle = new T.Group();
  beetle.scale.setScalar(1.32);
  group.add(beetle);
  part(beetle, sphere, dark, [0, .21, .04], [.26, .17, .35]);
  for (const side of [-1, 1]) {
    const wing = part(beetle, sphere, shell, [side * .141, .31, -.075], [.154, .16, .32]);
    wing.material.roughness = .39;
    part(beetle, sphere, '#e8a253', [side * .17, .433, .035], [.073, .045, .101]);
  }
  part(beetle, sphere, dark, [0, .24, .29], [.206, .17, .162]);
  const antennae = [];
  for (const side of [-1, 1]) {
    part(beetle, sphere, '#fff3d3', [side * .102, .28, .414], [.077, .080, .047]);
    part(beetle, sphere, dark, [side * .099, .285, .448], [.027, .033, .014]);
    const feeler = new T.Group();
    feeler.position.set(side*.067,.34,.323);
    beetle.add(feeler);
    antennae.push({ feeler, side });
    const antenna = part(feeler, stick, dark, [side * .04, .077, 0], [.028, .21, .03]);
    antenna.rotation.z = -side * .45;
    part(feeler, sphere, '#e79857', [side * .087, .177, 0], [.049, .046, .042]);
  }
  const feet = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const foot = part(beetle, sphere, dark, [side * .252, .084, .14 - i * .188], [.152, .039, .039]);
      foot.rotation.y = (i - 1) * side * .48;
      feet.push({ foot, side, index: i, restingZ: foot.position.z });
    }
  }
  const carriedLeaf = new T.Group();
  carriedLeaf.position.set(0, .51, -.26);
  beetle.add(carriedLeaf);
  const tile = part(carriedLeaf, leaf, '#d5e1aa', [0, 0, 0], [.79, .68, .72]);
  tile.material.side = T.DoubleSide;
  part(carriedLeaf, sphere, '#8d9753', [0, .095, -.01], [.022, .025, .46]);
  carriedLeaf.rotation.x = -.13;

  let up = leafUp;
  let movedAt = -10;
  let seen = false;
  let arrivedAt = -10;
  let streamSide = up ? 0 : 1;
  let startingRoll = up ? .40 : -.43;
  let age = 10;
  const oldPosition = new T.Vector3();
  const destination = new T.Vector3();
  const vertical = new T.Vector3(0, 1, 0);
  const direction = new T.Vector3();
  const leafLip = new T.Vector3();
  const splashPoint = new T.Vector3();
  const leafInlet = new T.Vector3();
  function shelter(target) {
    const x = target ? .48 : -1.18;
    const z = target ? .12 : .31;
    return [x, floor(group.position.x + x, group.position.z + z) - group.position.y + .015, z];
  }
  const shelters = [shelter(true), shelter(false)];
  beetle.position.set(...shelters[streamSide]);
  basins[streamSide].fill = 1;

  function connect(mesh, start, end, radius) {
    direction.subVectors(end, start);
    const length = direction.length();
    mesh.position.copy(start).lerp(end, .5);
    mesh.quaternion.setFromUnitVectors(vertical, direction.divideScalar(length));
    mesh.scale.set(radius, length, radius);
  }

  function update(time, still) {
    age = still ? 10 : time - movedAt;
    const target = up ? 0 : 1;
    const flip = T.MathUtils.smoothstep(age, 0, FLIP_SECONDS);
    hinge.rotation.set(.17, .04, T.MathUtils.lerp(startingRoll, up ? .40 : -.43, flip));
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
    connect(fall, inlet, leafInlet, .028);
    connect(spill, leafLip, wet.impact, .047 + (!still && age > .39 && age < .97 ? .014 : 0));
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
    const look = Math.sin(Math.PI * T.MathUtils.smoothstep(age, .51, 2.5));
    beetle.rotation.y = (up ? 1 : -1) * (look * .92) + .04;
    const stepping = !still && (moving || time - arrivedAt < 1.42);
    const gait = age * 19;
    carriedLeaf.rotation.z = stepping ? .13 * Math.sin(gait) : -.13 * (up ? 1 : -1);
    carriedLeaf.rotation.x = -.13 - look * .15;
    carriedLeaf.position.y = .51 + look * .07 + (stepping ? .041 * Math.cos(gait * 2) : 0);
    for(const { feeler, side } of antennae)
      feeler.rotation.z = still ? 0 : side * (.07 + .12*Math.sin(time*(stepping?9:2.7)));
    for (const { foot, restingZ, side, index } of feet) {
      const footfall = stepping ? Math.sin(gait + (index + Number(side > 0)) * Math.PI) : 0;
      foot.position.y = .084 + Math.max(0,footfall) * .06;
      foot.position.z = restingZ + footfall * .071;
    }
  }
  update(0, true);
  return {
    group,
    // The same crease can be used directly or through the contextual action.
    pickLeaf(ray, groundHit) {
      const picked = ray.intersectObject(roof, false)[0];
      return picked && (!groundHit || picked.distance < groundHit.distance) ? picked : null;
    },
    set(value, time) {
      oldPosition.copy(beetle.position);
      startingRoll = hinge.rotation.z;
      for (const basin of basins) basin.startFill = basin.fill;
      up = value;
      movedAt = time;
    },
    tick(time, still, near) {
      const reaction = near && !seen;
      if (reaction) arrivedAt = time;
      seen = near;
      update(time, still);
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
