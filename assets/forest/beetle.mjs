import * as T from '/vendor/three/three.module.min.js';

export function buildShelter(floor, leafUp) {
  const group = new T.Group();
  group.position.set(-10.45, floor(-10.45, -.06), -.06);
  const sphere = new T.SphereGeometry(1, 12, 8);
  const stick = new T.BoxGeometry(1, 1, 1);
  const drop = new T.OctahedronGeometry(1);
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
  const wood = '#826044', shell = '#a9563d', dark = '#31272a';
  // A shallow bend in the leaf carries water to one end of the fork.
  const hinge = new T.Group();
  hinge.position.set(-.24, .65, .01);
  group.add(hinge);
  const roof = part(hinge, leaf, '#a0bd5d', [0, 0, 0], [1.2, 1, 1.08]);
  roof.material.side = T.DoubleSide;
  part(hinge, sphere, '#e4d78d', [0, .13, -.04], [.035, .055, .65]);
  for (const side of [-1, 1]) {
    const leg = part(group, stick, wood, [-.24 + side * .48, .31, -.12], [.105, .68, .11]);
    leg.rotation.z = -side * .22;
  }
  const twig = part(group, stick, wood, [-.40, 1.39, -.47], [.11, .11, .96]);
  twig.rotation.x = .12;
  const stem = part(group, stick, wood, [-.43, .69, -.89], [.14, 1.48, .14]);
  stem.rotation.z = -.05;
  const water = '#63cfd1';
  const falling = part(group, drop, water, [-.31, 1.23, -.06], [.080, .16, .073]);
  const runnel = part(group, sphere, water, [-.24, .04, 0], [.105, .032, .33]);
  const pool = part(group, sphere, '#428c92', [-.35, .027, 0], [.43, .052, .25]);
  const ripple = part(group, sphere, '#a9eef0', [-.32, .074, 0], [.22, .014, .072]);
  const drip = part(group, drop, water, [-.24, .35, 0], [.067, .14, .067]);

  const beetle = new T.Group();
  beetle.scale.setScalar(1.18);
  group.add(beetle);
  part(beetle, sphere, dark, [0, .21, .04], [.26, .17, .35]);
  for (const side of [-1, 1]) {
    part(beetle, sphere, shell, [side * .137, .31, -.075], [.16, .16, .32]);
    part(beetle, sphere, '#e79857', [side * .17, .409, .035], [.075, .064, .103]);
  }
  part(beetle, sphere, dark, [0, .24, .29], [.206, .17, .162]);
  for (const side of [-1, 1]) {
    part(beetle, sphere, '#fff3d3', [side * .097, .28, .414], [.065, .072, .044]);
    part(beetle, sphere, dark, [side * .099, .285, .448], [.027, .033, .014]);
    const antenna = part(beetle, stick, dark, [side * .107, .417, .323], [.028, .21, .03]);
    antenna.rotation.z = -side * .45;
    part(beetle, sphere, '#e79857', [side * .154, .51, .323], [.042, .041, .04]);
  }
  const feet = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const foot = part(beetle, sphere, dark, [side * .252, .084, .14 - i * .188], [.152, .039, .039]);
      foot.rotation.y = (i - 1) * side * .48;
      feet.push(foot);
    }
  }
  const tile = part(beetle, leaf, '#d5ded0', [0, .49, -.23], [.65, .55, .62]);
  tile.material.side = T.DoubleSide;
  tile.rotation.x = -.16;

  let up = leafUp;
  let movedAt = -10;
  let seen = false;
  let arrivedAt = -10;
  const nowPosition = new T.Vector3();
  const oldPosition = new T.Vector3();
  function shelter(target) {
    const x = target ? -.30 : .57;
    const z = target ? .35 : .05;
    return [x, floor(group.position.x + x, group.position.z + z) - group.position.y + .015, z];
  }
  beetle.position.set(...shelter(up));
  function update(time, still) {
    const age = time - movedAt;
    const flip = still ? 1 : T.MathUtils.smoothstep(age, 0, .36);
    hinge.rotation.x = .22 + (up ? -1 : 1) * (.13 * (2 * flip - 1));
    hinge.rotation.z = (up ? 1 : -1) * (.21 * (2 * flip - 1));
    const side = (flip > .5 ? up : !up) ? -1 : 1;
    const phase = still ? .63 : (time * 1.35) % 1;
    const poolZ = side < 0 ? .98 : 1.24;
    const poolX = side < 0 ? -1.29 : -.20;
    runnel.position.set((poolX - .24) * .5, .71, poolZ * .43);
    runnel.rotation.set(-.22, Math.atan2(poolX + .24, poolZ), 0, 'YXZ');
    runnel.scale.z = side < 0 ? .55 : .40;
    const ground = floor(group.position.x + poolX, group.position.z + poolZ) - group.position.y;
    pool.position.set(poolX, ground + .028, poolZ);
    ripple.position.set(poolX, ground + .075, poolZ);
    ripple.scale.x = still ? .22 : .11 + phase * .21;
    falling.position.y = 1.27 - phase * .48;
    drip.position.set(poolX, T.MathUtils.lerp(.70, ground + .12, phase), poolZ);

    const start = T.MathUtils.smoothstep(age, .27, 1.30);
    if (still) beetle.position.set(...shelter(up));
    else if (start < 1) {
      nowPosition.set(...shelter(up));
      beetle.position.lerpVectors(oldPosition, nowPosition, start);
      beetle.position.y = floor(group.position.x + beetle.position.x, group.position.z + beetle.position.z)
        - group.position.y + .015;
    } else {
      beetle.position.set(...shelter(up));
      beetle.position.x += .24 * Math.sin(Math.PI * T.MathUtils.smoothstep(time - arrivedAt, 0, 1.45));
    }
    const stepping = !still && (start < 1 || time - arrivedAt < 1.45);
    feet.forEach((foot, i) => {
      foot.position.y = .084 + (stepping ? .036 * Math.sin(time * 19 + i * Math.PI) : 0);
    });
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
        pool: pool.getWorldPosition(new T.Vector3()).toArray(),
        leaf: hinge.getWorldPosition(new T.Vector3()).toArray(),
      };
    },
  };
}
