/* Original procedural 3D art. Three.js is pinned and served locally. */
import * as T from "/vendor/three/three.module.min.js";
let host,
  data,
  realm,
  renderer,
  scene,
  camera,
  player,
  pipo,
  frame = 0,
  abort,
  observer,
  stage,
  canvas;
let angle = 0.62,
  zoom = 20,
  target = null,
  last = 0,
  elapsed = 0,
  dirty = false,
  saving = false,
  modal = null,
  selection = [],
  quality = "auto",
  still = false,
  paused = false;
let keys = new Set(),
  meshes = [],
  animated = [],
  materials = new Map(),
  geometries = new Map(),
  labels = [],
  stats = { frames: 0, ms: 0 },
  lastSave = 0;
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const btn = (label, action, extra = "", cls = "") =>
  `<button type="button" class="r3-button ${cls}" data-action="r3-${action}" ${extra}>${label}</button>`;
const own = (id) => data.economy.inventory.includes(id);
const model = () => data.presets[realm.preset];
const group = (parent, x = 0, y = 0, z = 0) => {
  const g = new T.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
};
function mat(color, metal = 0, emit = 0) {
  const key = color + ":" + metal + ":" + emit;
  if (!materials.has(key))
    materials.set(
      key,
      new T.MeshStandardMaterial({
        color,
        roughness: metal ? 0.35 : 0.83,
        metalness: metal,
        emissive: color,
        emissiveIntensity: emit,
      }),
    );
  return materials.get(key);
}
function geo(kind, args) {
  const key = kind + args.join(",");
  if (!geometries.has(key)) geometries.set(key, new T[kind](...args));
  return geometries.get(key);
}
function mesh(
  parent,
  kind,
  args,
  color,
  x = 0,
  y = 0,
  z = 0,
  scale = null,
  metal = 0,
  emit = 0,
) {
  const m = new T.Mesh(geo(kind, args), mat(color, metal, emit));
  m.position.set(x, y, z);
  if (scale) m.scale.set(...scale);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const sphere = (p, c, x, y, z, s = [1, 1, 1]) =>
  mesh(p, "SphereGeometry", [1, 12, 8], c, x, y, z, s);
const box = (p, c, x, y, z, s = [1, 1, 1]) =>
  mesh(p, "BoxGeometry", [1, 1, 1], c, x, y, z, s);
const cyl = (p, c, x, y, z, r = 1, h = 1, rt = r) =>
  mesh(p, "CylinderGeometry", [rt, r, h, 16], c, x, y, z);
function beam(p, a, b, r, color) {
  const delta = new T.Vector3(...b).sub(new T.Vector3(...a)),
    m = cyl(
      p,
      color,
      ...new T.Vector3(...a)
        .add(new T.Vector3(...b))
        .multiplyScalar(0.5)
        .toArray(),
      r,
      delta.length(),
    );
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
  return m;
}
function tree(parent, x, z, scale = 1, palm = false) {
  const g = group(parent, x, 0, z);
  g.scale.setScalar(scale);
  if (palm) {
    beam(g, [0, 0, 0], [0.4, 4, 0], 0.22, "#a98057");
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const leaf = sphere(
        g,
        "#51a68b",
        Math.sin(a) * 1.2,
        4,
        Math.cos(a) * 1.2,
        [0.45, 0.22, 1.8],
      );
      leaf.rotation.y = a;
      leaf.rotation.z = 0.22;
    }
    sphere(g, "#a78256", 0.35, 3.7, 0, [0.25, 0.3, 0.25]);
  } else {
    cyl(g, "#a67e5f", 0, 1.4, 0, 0.28, 2.8);
    beam(g, [0, 1.5, 0], [1.1, 2.7, 0], 0.15, "#a67e5f");
    sphere(g, "#5d9b6e", 0, 3.2, 0, [1.65, 1.8, 1.55]);
    sphere(g, "#7fbb7d", -0.6, 3.7, 0.2, [1.45, 1.4, 1.3]);
    sphere(g, "#b4d595", 0.35, 4.3, 0.1, [0.95, 1, 1]);
  }
  return g;
}
function rock(parent, x, z, s = 1, color = model().rock) {
  const m = mesh(
    parent,
    "DodecahedronGeometry",
    [1, 0],
    color,
    x,
    0.38 * s,
    z,
    [s, 0.8 * s, s],
  );
  m.rotation.set(0.2, x, 0.3);
  return m;
}
function flower(parent, x, z, c = "#f7d383") {
  cyl(parent, "#649b73", x, 0.22, z, 0.035, 0.44);
  for (let i = 0; i < 5; i++)
    sphere(
      parent,
      c,
      x + Math.sin(i * 1.256) * 0.16,
      0.47,
      z + Math.cos(i * 1.256) * 0.16,
      [0.13, 0.08, 0.13],
    );
  sphere(parent, "#fff1be", x, 0.5, z, [0.08, 0.08, 0.08]);
}
function crystal(parent, x, z, size = 1, color = "#b5ece7") {
  const g = group(parent, x, 0, z);
  for (let i = 0; i < 3; i++) {
    let m = mesh(
      g,
      "CylinderGeometry",
      [0, 0.45 * size, 2.4 * size, 5],
      i === 0 ? color : "#91bacc",
      (i - 1) * 0.55 * size,
      1.2 * size,
      0,
    );
    m.rotation.z = (i - 1) * -0.3;
  }
  return g;
}
function lantern(parent, x, z) {
  cyl(parent, "#786f71", x, 1, z, 0.075, 2);
  box(parent, "#8b7360", x, 2, z, [0.5, 0.6, 0.5]);
  mesh(
    parent,
    "SphereGeometry",
    [0.2, 10, 8],
    "#ffe5a0",
    x,
    2,
    z,
    null,
    0,
    0.65,
  );
  mesh(parent, "ConeGeometry", [0.5, 0.4, 4], "#78978e", x, 2.5, z);
}
function bridge(parent, path) {
  const [a, b, c, d] = path,
    wide = b - a > d - c,
    steps = Math.ceil((wide ? b - a : d - c) / 0.65),
    g = group(parent);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    box(
      g,
      "#d5b88b",
      wide ? a + (b - a) * t : (a + b) / 2,
      0.04,
      wide ? (c + d) / 2 : c + (d - c) * t,
      wide ? [0.5, 0.16, d - c] : [b - a, 0.16, 0.5],
    );
  }
  for (const side of [-1, 1]) {
    if (wide) {
      beam(
        g,
        [a, 0.8, (c + d) / 2 + (side * (d - c)) / 2],
        [b, 0.8, (c + d) / 2 + (side * (d - c)) / 2],
        0.07,
        "#a78865",
      );
      for (let x = a; x <= b; x += 2)
        cyl(g, "#a78865", x, 0.42, (c + d) / 2 + (side * (d - c)) / 2, 0.08, 1);
    } else {
      beam(
        g,
        [(a + b) / 2 + (side * (b - a)) / 2, 0.8, c],
        [(a + b) / 2 + (side * (b - a)) / 2, 0.8, d],
        0.07,
        "#a78865",
      );
      for (let z = c; z <= d; z += 2)
        cyl(g, "#a78865", (a + b) / 2 + (side * (b - a)) / 2, 0.42, z, 0.08, 1);
    }
  }
}
function portal(parent, x, z, paid = false) {
  const g = group(parent, x, 0, z);
  const color = paid ? "#b6a7ed" : realm.color;
  cyl(g, "#a2a8a8", 0, 0.12, 0, 1.7, 0.25);
  cyl(g, "#d6d7be", 0, 0.3, 0, 1.4, 0.18);
  const ring = mesh(
    g,
    "TorusGeometry",
    [1.18, 0.23, 10, 40],
    color,
    0,
    1.9,
    0,
    null,
    0.15,
    0.08,
  );
  const face = mesh(g, "CircleGeometry", [0.98, 40], "#c4e7ee", 0, 1.9, -0.04);
  face.material = new T.MeshStandardMaterial({
    color: paid ? "#a5a0ef" : "#82cdd7",
    emissive: paid ? "#8d86d4" : "#5cabb6",
    emissiveIntensity: 0.55,
    roughness: 0.25,
    side: T.DoubleSide,
  });
  materials.set("portal" + paid, face.material);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const rune = mesh(
      g,
      "OctahedronGeometry",
      [0.12, 0],
      "#fff1b5",
      Math.cos(a) * 1.2,
      1.9 + Math.sin(a) * 1.2,
      0.1,
    );
    animated.push({
      object: rune,
      kind: "rune",
      base: rune.position.y,
      phase: i,
    });
  }
  animated.push({ object: ring, kind: "portal", base: 0 });
  return g;
}
function chest(parent, x, z) {
  const g = group(parent, x, 0, z);
  box(g, "#966444", 0, 0.5, 0, [1.45, 0.9, 1]);
  const top = mesh(
    g,
    "CylinderGeometry",
    [0.5, 0.5, 1.45, 12, 1, false, 0, Math.PI],
    "#bd8857",
    0,
    0.95,
    0,
  );
  top.rotation.z = Math.PI / 2;
  for (const xx of [-0.5, 0.5])
    box(g, "#eac774", xx, 0.65, 0.53, [0.13, 1.1, 0.07]);
  box(g, "#ffe0a0", 0, 0.65, 0.57, [0.25, 0.3, 0.1]);
  return g;
}
function house(parent) {
  const g = group(parent, -6, 0, -5);
  cyl(g, "#a67e5f", -.8, 2.8, -.8, .42, 5.6);
  beam(g, [-.8, 4, -.8], [-2.1, 6.2, -1.4], .18, "#a67e5f");
  sphere(g, "#77ad73", -1.6, 6.6, -1.8, [1.8, 1.2, 1.5]);
  sphere(g, "#acd08a", -2.4, 7.1, -1.2, [1.2, 1, 1.2]);
  box(g, "#c4a377", 0, 2.9, 0, [4, .3, 3]);
  box(g, "#f1d49a", 0, 4.1, 0, [3, 2.2, 2.5]);
  const roof = mesh(g, "ConeGeometry", [2.5, 1.5, 4], "#ae746e", 0, 5.9, 0);
  roof.rotation.y = Math.PI / 4;
  box(g, "#546d71", 0, 3.65, 1.27, [.7, 1.6, .1]);
  for (const x of [-1, 1]) box(g, "#bce5df", x, 4.4, 1.3, [.6, .6, .1]);
  for (let i = 0; i < 8; i++) box(g, "#d4b382", 1.9, .4 + i * .34, 1.7, [1.1, .15, .2]);
  beam(g, [1.45, 0, 1.7], [1.45, 3.2, 1.7], .07, "#a5845f");
  beam(g, [2.35, 0, 1.7], [2.35, 3.2, 1.7], .07, "#a5845f");
  return g;
}
function robotBuilding(parent, x, z, scale = 1) {
  const g = group(parent, x, 0, z);
  g.scale.setScalar(scale);
  cyl(g, "#6f9f9f", 0, 1.5, 0, 1.6, 3);
  sphere(g, "#c9dbcd", 0, 3, 0, [1.65, 0.9, 1.65]);
  box(g, "#355966", 0, 1.5, 1.53, [1.6, 0.8, 0.1]);
  for (let xx of [-0.4, 0.4]) box(g, "#f7df9f", xx, 1.5, 1.62, [0.3, 0.3, 0.1]);
  cyl(g, "#7496a0", 0, 4.2, 0, 0.08, 1.1);
  sphere(g, "#f0bb76", 0, 4.9, 0, [0.25, 0.25, 0.25]);
  beam(g, [-1.7, 1, 0], [-2.5, 1, 0.5], 0.2, "#c8c4aa");
  return g;
}
function lighthouse(parent, x, z) {
  const g = group(parent, x, 0, z);
  cyl(g, "#e7dbbb", 0, 2.4, 0, 1.1, 4.8, 0.7);
  cyl(g, "#cc8974", 0, 1.6, 0, 1, 1, 0.9);
  cyl(g, "#cc8974", 0, 3.4, 0, 0.85, 0.5, 0.8);
  cyl(g, "#8f9690", 0, 4.7, 0, 1.2, 0.15);
  cyl(g, "#ffe4a1", 0, 5.3, 0, 0.65, 1);
  mesh(g, "ConeGeometry", [1.25, 0.8, 8], "#799c9b", 0, 6.1, 0);
  return g;
}
function cloud(parent, x, y, z, scale = 1) {
  const g = group(parent, x, y, z);
  g.scale.setScalar(scale);
  for (let i = 0; i < 4; i++)
    sphere(
      g,
      "#f4f1e9",
      (i - 1.5) * 1.2,
      Math.sin(i * 1.4) * 0.3,
      0,
      [1.4, 1, 1.2],
    );
  return g;
}
function balloon(parent, x, z, color) {
  const g = group(parent, x, 3.5, z);
  sphere(g, color, 0, 2.5, 0, [1.45, 1.9, 1.45]);
  for (let side of [-1, 1])
    beam(g, [side * 0.55, 0.1, 0], [side * 0.9, 1.4, 0], 0.03, "#b59d81");
  box(g, "#bb9470", 0, 0, 0, [1.3, 0.7, 1]);
  animated.push({ object: g, kind: "float", base: 3.5, phase: x });
  return g;
}
function ship(parent, x, z) {
  const g = group(parent, x, 0, z);
  const hull = mesh(
    g,
    "SphereGeometry",
    [1, 16, 10],
    "#987451",
    0,
    0.5,
    0,
    [1.5, 0.8, 3],
  );
  box(g, "#dab98b", 0, 0.9, 0, [2.2, 0.15, 4.2]);
  cyl(g, "#9e7b55", 0, 3, 0, 0.09, 5);
  const sail = mesh(g, "PlaneGeometry", [2.5, 3.4], "#fff0cb", 1.2, 3.8, 0);
  sail.material = new T.MeshStandardMaterial({
    color: "#fff0cb",
    side: T.DoubleSide,
    roughness: 1,
  });
  materials.set("sail", sail.material);
  return hull;
}
function buildScene() {
  const m = model(),
    root = group(scene);
  scene.background = new T.Color(m.sky);
  scene.fog = new T.Fog(m.sky, 40, 100);
  const water = mesh(root, "PlaneGeometry", [300, 300], m.water, 0, -2.7, 0);
  water.rotation.x = -Math.PI / 2;
  water.receiveShadow = false;
  // Rings give the water a quiet, geometric ripple rather than a bitmap skybox.
  for (let i = 0; i < 18; i++) {
    const a = i * 2.4,
      x = Math.cos(a) * (19 + i * 2.1),
      z = Math.sin(a) * (19 + i * 1.7);
    const ring = mesh(
      root,
      "TorusGeometry",
      [2 + i * 0.12, 0.035, 3, 32],
      "#c2e2df",
      x,
      -2.65,
      z,
    );
    ring.rotation.x = Math.PI / 2;
    ring.castShadow = false;
  }
  m.islands.forEach(([x, z, r], index) => {
    const g = group(root, x, 0, z);
    const base = mesh(
      g,
      "CylinderGeometry",
      [r * 0.98, r * 0.7, 3, 14],
      m.rock,
      0,
      -1.7,
      0,
    );
    base.rotation.y = 0.15;
    mesh(g, "CylinderGeometry", [r, r * 0.98, 0.6, 32], m.ground, 0, -0.35, 0);
    mesh(
      g,
      "CylinderGeometry",
      [r * 0.94, r, 0.12, 32],
      realm.preset === "treasure" ? "#f4dfac" : m.ground,
      0,
      -0.02,
      0,
    );
    if (realm.preset === "clouds") {
      for (let j = 0; j < 9; j++) {
        const a = j * 0.7;
        cloud(g, Math.cos(a) * r * 0.8, -1.6, Math.sin(a) * r * 0.8, 1.2);
      }
    }
    // Main paths form a navigable loop, with side roads to each destination.
    const path = mesh(
      g,
      "TorusGeometry",
      [r * 0.58, 0.42, 4, 56],
      realm.preset === "robots" ? "#d1d6bd" : "#e6dbb4",
      0,
      0.035,
      0,
    );
    path.rotation.x = Math.PI / 2;
    path.scale.z = 0.2;
    for (let j = 0; j < 9; j++) {
      const a = j * 0.69 + 0.25,
        px = Math.cos(a) * (r - 1.6),
        pz = Math.sin(a) * (r - 1.6);
      if (realm.preset === "forest") {
        tree(g, px, pz, 0.65 + (j % 3) * 0.16);
        if (j % 2 === 0) flower(g, px * 0.84, pz * 0.84);
      } else if (realm.preset === "treasure") {
        if (j % 2 === 0) tree(g, px, pz, 0.85, true);
        else rock(g, px, pz, 0.6);
      } else if (realm.preset === "crystal") {
        crystal(g, px, pz, 0.8 + (j % 3) * 0.45, j % 2 ? "#b1e0e2" : "#a4a3d4");
      } else if (realm.preset === "robots") {
        if (j % 3 === 0) robotBuilding(g, px, pz, 0.7);
        else lantern(g, px, pz);
      } else {
        if (j % 3 === 0) crystal(g, px, pz, 0.5, "#f2d49b");
        else flower(g, px, pz, "#c1b1dc");
      }
    }
    if (index > 0) {
      if (realm.preset === "forest") tree(g, 0, 0, 1.6);
      else if (realm.preset === "clouds") balloon(g, 0, 0, "#d6b0bd");
      else if (realm.preset === "robots") robotBuilding(g, 0, 0, 1.5);
      else if (realm.preset === "treasure") lighthouse(g, 0, 0);
      else crystal(g, 0, 0, 2.1);
    }
  });
  m.paths.forEach((path) => {
    if (realm.preset !== "forest" || own("bridge")) bridge(root, path);
  });
  // Landmarks are deliberately distinct, not just palette changes.
  if (realm.preset === "forest") {
    if (!own("house")) tree(root, -6, -5, 1.5);
    for (let i = 0; i < 15; i++)
      flower(root, -7 + i * 0.5, 6.5, i % 2 ? "#e8b6bd" : "#f8db91");
    if (own("house")) house(root);
    else {
      box(root, "#b7a388", -6, 0.15, -5, [3, 0.3, 2]);
    }
    rock(root, 7, -5, 1.4);
  }
  if (realm.preset === "clouds") {
    balloon(root, -5, -2, "#eabf87");
    balloon(root, 4, -5, "#91bdc5");
    for (let i = 0; i < 5; i++) cloud(root, -15 + i * 8, -5, -20, 2.5);
  }
  if (realm.preset === "robots") {
    robotBuilding(root, -6, -4, 1.3);
    robotBuilding(root, 6, -5, 1.1);
    for (let z = -8; z < 8; z += 2)
      box(root, "#d9d5ae", 0, 0.015, z, [0.2, 0.04, 0.7]);
    beam(root, [-7, 0.4, 6], [-7, 0.4, -6], 0.25, "#e3be77");
  }
  if (realm.preset === "treasure") {
    ship(root, 7, 3);
    for (let i = 0; i < 8; i++)
      box(root, "#b99166", 7, 0.04, 1 + i * 0.55, [3, 0.18, 0.4]);
    lighthouse(root, -6, -5);
    chest(root, 5, -5);
  }
  if (realm.preset === "crystal") {
    for (let i = 0; i < 4; i++) crystal(root, -6 + i * 1.1, -6, 1.2 + i * 0.25);
    const arch = mesh(
      root,
      "TorusGeometry",
      [2.2, 0.48, 6, 18, Math.PI],
      "#99a6c3",
      3,
      0,
      -6,
    );
    arch.rotation.z = 0;
  }
  // Portal travel is free. The purchased portal adds an ideas sanctuary to every world.
  portal(root, 0, -4);
  chest(root, 5, 1);
  if (own("portal")) portal(root, -5, 3, true);
  if (own("house") && realm.preset !== "forest") {
    const camp = group(root, -6, 0, 4);
    mesh(camp, "ConeGeometry", [1.8, 2.5, 4], "#e0bd87", 0, 1, 0);
  }
  for (let i = 0; i < 10; i++) {
    const a = i * 0.7;
    cloud(
      root,
      Math.cos(a) * 45,
      3 + (i % 3) * 3,
      Math.sin(a) * 45,
      1.8 + (i % 3) * 0.7,
    );
  }
  realm.challenges.forEach((ch) => {
    if (ch.kind === "explore") {
      const g = group(root, ch.x, 0, ch.z);
      cyl(g, "#d0c7a5", 0, 0.1, 0, 0.7, 0.2);
      const gem = mesh(
        g,
        "OctahedronGeometry",
        [0.55, 0],
        ch.completed ? "#95baac" : realm.color,
        0,
        1.5,
        0,
        null,
        0.1,
        0.15,
      );
      animated.push({ object: gem, kind: "float", base: 1.5, phase: ch.x });
    } else {
      const g = group(root, ch.x, 0, ch.z);
      cyl(g, "#baa88b", 0, 0.55, 0, 0.5, 1.1);
      const tile = box(
        g,
        ch.kind === "logic" ? "#aacac8" : "#e6c891",
        0,
        1.3,
        0,
        [0.95, 0.65, 0.85],
      );
      tile.rotation.y = 0.3;
    }
  });
  player = makeDavi(root, data.economy.avatar);
  pipo = makePipo(root);
  player.position.set(realm.progress.x, 0, realm.progress.z);
  pipo.position.copy(player.position).add(new T.Vector3(-1, 0.2, 0.5));
  labels = [
    ...(own("portal")
      ? [
          {
            x: -5,
            z: 3,
            label: "Portal das ideias",
            action: "ideas",
            icon: "✧",
          },
        ]
      : []),
    ...(own("house")
      ? [
          {
            x: -6,
            z: realm.preset === "forest" ? -5 : 4,
            label: "Meu refúgio",
            action: "home",
            icon: "⌂",
          },
        ]
      : []),
    { x: 0, z: -4, label: "Portal dos mundos", action: "portals", icon: "◈" },
    { x: 5, z: 1, label: "Oficina", action: "shop", icon: "✦" },
    ...realm.challenges.map((ch) => ({
      x: ch.x,
      z: ch.z,
      label: ch.title,
      action: "challenge",
      id: ch.id,
      icon: ch.completed ? "✓" : ch.kind === "explore" ? "◇" : "?",
    })),
  ];
  document.getElementById("r3Pins").innerHTML = labels
    .map(
      (l, i) =>
        `<button type="button" class="r3-pin" data-action="r3-${l.action}" data-index="${i}" ${l.id ? `data-id="${esc(l.id)}"` : ""} aria-label="${esc(l.label)}"><span>${l.icon}</span><small>${esc(l.label)}</small></button>`,
    )
    .join("");
}
function batchStatic() {
  scene.updateMatrixWorld(true);
  const buckets = new Map(),
    excluded = new Set([player, pipo, ...animated.map((a) => a.object)]);
  scene.traverse((node) => {
    if (!node.isMesh) return;
    let ancestor = node;
    while (ancestor) {
      if (excluded.has(ancestor)) return;
      ancestor = ancestor.parent;
    }
    const key = node.geometry.uuid + node.material.uuid;
    const list = buckets.get(key) || [];
    list.push(node);
    buckets.set(key, list);
  });
  for (const list of buckets.values()) {
    if (list.length < 3) continue;
    const batch = new T.InstancedMesh(
      list[0].geometry,
      list[0].material,
      list.length,
    );
    batch.castShadow = list[0].castShadow;
    batch.receiveShadow = list[0].receiveShadow;
    list.forEach((node, i) => {
      batch.setMatrixAt(i, node.matrixWorld);
      node.removeFromParent();
    });
    batch.instanceMatrix.needsUpdate = true;
    scene.add(batch);
  }
}
function makeDavi(parent, a) {
  const g = group(parent);
  const skin = "#f1c79b",
    hair = "#4c4142",
    shirt = { mint: "#67bbaa", sun: "#ecc474", sky: "#76aed0" }[a.color];
  const torso = mesh(
    g,
    "CapsuleGeometry",
    [0.32, 0.45, 4, 12],
    shirt,
    0,
    0.94,
    0,
    [1, 0.95, 0.72],
  );
  sphere(g, skin, 0, 1.75, 0, [0.42, 0.44, 0.39]);
  sphere(g, hair, 0, 2, 0, [0.44, 0.27, 0.4]);
  sphere(g, hair, -0.3, 1.85, 0.05, [0.17, 0.25, 0.28]);
  for (let x of [-0.14, 0.14]) {
    sphere(g, "#403b43", x, 1.8, 0.35, [0.034, 0.046, 0.025]);
    sphere(g, "#f3a99b", x * 1.6, 1.66, 0.31, [0.065, 0.035, 0.02]);
  }
  const smile = mesh(
    g,
    "TorusGeometry",
    [0.09, 0.012, 4, 12, Math.PI],
    "#a86f61",
    0,
    1.65,
    0.375,
  );
  smile.rotation.z = Math.PI;
  const legs = [],
    arms = [];
  for (let side of [-1, 1]) {
    const leg = group(g, side * 0.17, 0.61, 0);
    mesh(leg, "CapsuleGeometry", [0.12, 0.35, 4, 8], "#4d647c", 0, -0.19, 0);
    sphere(leg, "#f5e6c5", 0, -0.4, 0.07, [0.15, 0.11, 0.25]);
    legs.push(leg);
    const arm = group(g, side * 0.4, 1.2, 0);
    mesh(arm, "CapsuleGeometry", [0.11, 0.33, 4, 8], skin, 0, -0.19, 0);
    sphere(arm, shirt, 0, 0.01, 0, [0.15, 0.18, 0.16]);
    arms.push(arm);
  }
  // Original star-shaped badge, part of the 3D mesh.
  const badge = mesh(g, "OctahedronGeometry", [0.12, 0], "#ffe2a1", 0, 1, 0.25);
  badge.scale.set(1, 0.95, 0.3);
  if (a.hat) {
    cyl(g, "#d9b77a", 0, 2.12, 0, 0.57, 0.07);
    cyl(g, "#e8c88f", 0, 2.27, 0, 0.35, 0.3, 0.3);
    cyl(g, "#9c896a", 0, 2.16, 0, 0.36, 0.08);
  }
  if (a.cape) {
    const cape = mesh(
      g,
      "ConeGeometry",
      [0.56, 0.95, 4],
      "#9e83c8",
      0,
      0.85,
      -0.3,
      [1, 1, 0.25],
    );
    cape.rotation.y = Math.PI / 4;
  }
  g.userData = { legs, arms };
  return g;
}
function makePipo(parent) {
  const g = group(parent);
  box(g, "#e9c77d", 0, 0.9, 0, [0.62, 0.48, 0.42]);
  box(g, "#314c5d", 0, 0.92, 0.225, [0.49, 0.24, 0.03]);
  for (let x of [-0.13, 0.13])
    sphere(g, "#b5eee0", x, 0.94, 0.26, [0.05, 0.06, 0.025]);
  box(g, "#8cc6bb", 0, 0.44, 0, [0.43, 0.38, 0.36]);
  cyl(g, "#9a926f", 0, 1.25, 0, 0.025, 0.22);
  sphere(g, "#ffde8e", 0, 1.4, 0, [0.07, 0.07, 0.07]);
  for (let x of [-0.25, 0.25])
    sphere(g, "#d7c39a", x, 0.4, 0, [0.09, 0.19, 0.08]);
  for (let x of [-0.13, 0.13])
    sphere(g, "#788f94", x, 0.12, 0.03, [0.1, 0.12, 0.14]);
  if (data.economy.avatar.buddy) {
    const scarf = mesh(
      g,
      "ConeGeometry",
      [0.25, 0.3, 3],
      "#e69c80",
      0,
      0.59,
      0.23,
    );
    scarf.rotation.x = 0.1;
  }
  return g;
}
function walkable(x, z) {
  const m = model();
  return (
    m.islands.some(
      ([cx, cz, r], i) =>
        !(realm.preset === "forest" && i === 1 && !own("bridge")) &&
        (x - cx) ** 2 + (z - cz) ** 2 <= (r - 0.6) ** 2,
    ) ||
    (!(realm.preset === "forest" && !own("bridge")) &&
      m.paths.some(([a, b, c, d]) => x >= a && x <= b && z >= c && z <= d))
  );
}
function layout() {
  host.layout(`<div class="r3-shell"><header class="r3-hud"><div class="r3-identity"><span class="r3-overline">AVENTURAS DO DAVI <span>3D</span></span><h1>${esc(realm.name)}</h1><p>${esc(realm.description)}</p></div><div class="r3-wallet"><span>✦</span><strong>${data.economy.stars}</strong><small>estrelas</small></div></header>
 <nav class="r3-toolbar" aria-label="Explorar e organizar">${btn("◈ Viajar", "portals")}${btn("▣ Atividades · " + host.missions.length, "activities")}${btn("✦ Oficina", "shop")}${btn("Meu personagem", "wardrobe")}</nav>
 <div class="r3-stage" id="r3Stage"><canvas id="r3Canvas" tabindex="0" aria-label="${esc(realm.name)} em 3D. Use setas ou WASD para andar; E para interagir." aria-describedby="r3Instructions"></canvas><div class="r3-pins" id="r3Pins"></div><div class="r3-scene-tag"><span class="r3-live-dot"></span> ${esc(model().label)} <small>· ${realm.challenges.filter((c) => c.completed).length}/${realm.challenges.length} descobertas</small></div>
 <div class="r3-camera">${btn("↶", "rotate-left", 'aria-label="Girar câmera à esquerda"')}${btn("⌖", "camera", 'aria-label="Centralizar câmera"')}${btn("↷", "rotate-right", 'aria-label="Girar câmera à direita"')}</div>
 <div class="r3-direction" role="group" aria-label="Andar"><button data-dir="up" aria-label="Andar para frente">↑</button><button data-dir="left" aria-label="Andar à esquerda">←</button><button data-dir="down" aria-label="Andar para trás">↓</button><button data-dir="right" aria-label="Andar à direita">→</button></div><button class="r3-interact" id="r3Interact" data-action="r3-nearby">Explorar perto · E</button></div>
 <div class="r3-bottom"><div class="r3-pipo-mark" aria-hidden="true">◉</div><p id="r3Message" role="status">Oi! Sou o Pipo. ${realm.preset === "forest" && !own("bridge") ? "A ponte da oficina abre o bosque. " : ""}Vamos descobrir este mundo juntos?</p>${btn("Ver agenda", "calendar")}</div>
 <div class="r3-options"><span id="r3Instructions">Toque no caminho para andar · setas ou WASD · E para explorar</span><label>Qualidade <select id="r3Quality"><option value="auto">Automática</option><option value="low">Econômica</option><option value="high">Detalhada</option></select></label><label><input id="r3Motion" type="checkbox" ${still ? "" : "checked"}>Animações</label>${btn("Ilha 2D", "fallback")}</div></div><dialog id="r3Dialog" class="r3-dialog" aria-labelledby="r3DialogTitle"><div id="r3DialogBody"></div></dialog>`);
  document.body.classList.add("r3-view");
  stage = document.getElementById("r3Stage");
  canvas = document.getElementById("r3Canvas");
}
function resize() {
  if (!stage || !renderer) return;
  const width = stage.clientWidth,
    height = stage.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
function applyQuality() {
  const low =
    quality === "low" ||
    (quality === "auto" &&
      (innerWidth < 700 ||
        navigator.hardwareConcurrency <= 4 ||
        navigator.deviceMemory <= 4));
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.5));
  renderer.shadowMap.enabled = !low;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  resize();
}
function drawCamera(dt = 1) {
  const pos = player.position,
    dist = zoom + (innerWidth < 650 ? 1 : 0);
  const dest = new T.Vector3(
    pos.x + Math.sin(angle) * dist,
    dist * 0.87,
    pos.z + Math.cos(angle) * dist,
  );
  camera.position.lerp(dest, Math.min(1, dt * 5));
  camera.lookAt(pos.x, 1, pos.z);
  camera.updateMatrixWorld();
  const near = nearest();
  labels.forEach((l, i) => {
    const b = document.querySelector(`#r3Pins [data-index="${i}"]`);
    if (!b) return;
    b.classList.toggle(
      "is-near",
      !!near && near.action === l.action && near.id === l.id && near.d < 4.3,
    );
    const v = new T.Vector3(l.x, 2.4, l.z).project(camera);
    b.style.transform = `translate(${(v.x * 0.5 + 0.5) * stage.clientWidth}px,${(-v.y * 0.5 + 0.5) * stage.clientHeight}px)`;
    b.hidden =
      v.z > 1 || v.x < -0.98 || v.x > 0.98 || v.y < -0.95 || v.y > 0.95;
  });
}
async function save() {
  if (!dirty || saving || !host || !realm) return;
  saving = true;
  dirty = false;
  const body = {
    world_id: realm.id,
    x: player.position.x,
    z: player.position.z,
  };
  try {
    await host.api("/api/realms/move", "PUT", body);
  } catch (e) {
    message(e.message);
    dirty = true;
  } finally {
    saving = false;
  }
}
function message(text) {
  const node = document.getElementById("r3Message");
  if (node) node.textContent = text;
}
function nearest() {
  return labels
    .map((l) => ({
      ...l,
      d: Math.hypot(l.x - player.position.x, l.z - player.position.z),
    }))
    .sort((a, b) => a.d - b.d)[0];
}
function tick(now) {
  if (!renderer) return;
  frame = requestAnimationFrame(tick);
  if (document.hidden || paused) return;
  const dt = Math.min((now - last) / 1000 || 0, 0.05);
  last = now;
  elapsed += dt;
  let dx = 0,
    dz = 0;
  if (!modal) {
    let sx = Number(keys.has("right")) - Number(keys.has("left")),
      sz = Number(keys.has("down")) - Number(keys.has("up"));
    dx = sx * Math.cos(angle) + sz * Math.sin(angle);
    dz = -sx * Math.sin(angle) + sz * Math.cos(angle);
    if (target && !keys.size) {
      dx = target.x - player.position.x;
      dz = target.z - player.position.z;
      if (Math.hypot(dx, dz) < 0.2) {
        target = null;
        dx = dz = 0;
      }
    }
  }
  const length = Math.hypot(dx, dz);
  if (length) {
    const step = Math.min(4.8 * dt, length),
      x = player.position.x + (dx / length) * step,
      z = player.position.z + (dz / length) * step;
    if (walkable(x, z)) {
      player.position.x = x;
      player.position.z = z;
      player.rotation.y = Math.atan2(dx, dz);
      realm.progress.x = x;
      realm.progress.z = z;
      dirty = true;
    } else {
      target = null;
    }
  }
  const moving = length > 0.01 && !modal;
  player.userData.legs.forEach(
    (leg, i) =>
      (leg.rotation.x = still
        ? 0
        : moving
          ? Math.sin(elapsed * 11 + i * Math.PI) * 0.55
          : 0),
  );
  player.userData.arms.forEach(
    (arm, i) =>
      (arm.rotation.x = still
        ? 0
        : moving
          ? Math.sin(elapsed * 11 + i * Math.PI + Math.PI) * 0.45
          : Math.sin(elapsed * 1.8) * 0.04),
  );
  player.position.y = still
    ? 0
    : moving
      ? Math.abs(Math.sin(elapsed * 11)) * 0.045
      : Math.sin(elapsed * 2) * 0.018;
  const follow = player.position.clone().add(new T.Vector3(-1.1, 0.2, 1));
  pipo.position.lerp(follow, Math.min(1, dt * 4));
  pipo.position.y = still ? 0.2 : 0.2 + Math.sin(elapsed * 3) * 0.12;
  pipo.rotation.y = player.rotation.y * 0.5;
  if (!still)
    for (const a of animated) {
      if (a.kind === "float" || a.kind === "rune") {
        a.object.position.y = a.base + Math.sin(elapsed * 1.3 + a.phase) * 0.12;
        a.object.rotation.y += dt * 0.35;
      } else if (a.kind === "portal")
        a.object.rotation.z = Math.sin(elapsed * 0.4) * 0.06;
    }
  drawCamera(dt);
  renderer.render(scene, camera);
  stats.frames++;
  stats.ms += dt * 1000;
  if (now - lastSave > 1200 && dirty) {
    lastSave = now;
    save();
  }
  const near = nearest(),
    button = document.getElementById("r3Interact");
  button.textContent =
    near && near.d < 3.5
      ? `${near.icon} ${near.label} · E`
      : "Explorar perto · E";
  button.disabled = !near || near.d >= 3.5;
  canvas.dataset.frames = String(stats.frames);
  canvas.dataset.calls = String(renderer.info.render.calls);
  canvas.dataset.triangles = String(renderer.info.render.triangles);
}
function bind() {
  abort = new AbortController();
  const on = (el, event, fn) =>
      el.addEventListener(event, fn, { signal: abort.signal }),
    dirs = {
      ArrowUp: "up",
      w: "up",
      ArrowDown: "down",
      s: "down",
      ArrowLeft: "left",
      a: "left",
      ArrowRight: "right",
      d: "right",
    };
  on(document, "keydown", (e) => {
    if (modal || !stage) return;
    if (e.target !== canvas && !e.target.closest("[data-dir]")) return;
    if (dirs[e.key]) {
      e.preventDefault();
      keys.add(dirs[e.key]);
      target = null;
    } else if (e.key.toLowerCase() === "e") {
      e.preventDefault();
      host.run(() => action("r3-nearby", {}));
    }
  });
  on(document, "keyup", (e) => {
    if (dirs[e.key]) {
      keys.delete(dirs[e.key]);
      save();
    }
  });
  on(window, "blur", () => {
    keys.clear();
    save();
  });
  on(document, "visibilitychange", () => {
    keys.clear();
    last = 0;
    save();
  });
  document.querySelectorAll("[data-dir]").forEach((b) => {
    on(b, "pointerdown", (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      keys.add(b.dataset.dir);
      target = null;
    });
    on(b, "pointerup", () => {
      keys.clear();
      save();
    });
    on(b, "pointercancel", () => {
      keys.clear();
      save();
    });
    on(b, "keydown", (e) => {
      if (e.key === " " || e.key === "Enter") keys.add(b.dataset.dir);
    });
    on(b, "keyup", () => {
      keys.clear();
      save();
    });
  });
  on(canvas, "pointerdown", (e) => {
    if (modal) return;
    canvas.focus({ preventScroll: true });
    const rect = canvas.getBoundingClientRect(),
      pointer = new T.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      ray = new T.Raycaster();
    ray.setFromCamera(pointer, camera);
    const hit = new T.Vector3();
    ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), hit);
    if (walkable(hit.x, hit.z)) target = { x: hit.x, z: hit.z };
    else message("Siga os caminhos. As pontes ligam os lugares deste mundo.");
  });
  on(canvas, "webglcontextlost", (e) => {
    e.preventDefault();
    paused = true;
    message(
      "O 3D pausou neste aparelho. Use Ilha 2D para continuar sua aventura.",
    );
  });
  on(canvas, "webglcontextrestored", () => {
    paused = false;
    last = 0;
  });
  on(document.getElementById("r3Quality"), "change", (e) => {
    quality = e.target.value;
    localStorage.setItem("davi-3d-quality", quality);
    applyQuality();
  });
  document.getElementById("r3Quality").value = quality;
  on(document.getElementById("r3Motion"), "change", (e) => {
    still = !e.target.checked;
    localStorage.setItem("davi-3d-still", String(still));
  });
  on(document.getElementById("r3Dialog"), "cancel", () => {
    modal = null;
    selection = [];
    keys.clear();
    canvas.focus({ preventScroll: true });
  });
  observer = new ResizeObserver(applyQuality);
  observer.observe(stage);
}
function showDialog(name) {
  modal = name;
  keys.clear();
  target = null;
  selection = [];
  renderDialog();
  document.getElementById("r3Dialog").showModal();
}
function renderDialog() {
  let content = "",
    title = "";
  if (modal === "home") {
    title = "Seu refúgio de ideias";
    content = `<p>A casa na árvore está na Floresta Encantada. Nos outros mundos, você tem um cantinho para descansar com o Pipo.</p><p>Escolha uma ideia para levar para fora da tela.</p>${btn("Ver atividades", "activities")}${btn("Visitar outro mundo", "portals")}`;
  } else if (modal === "ideas") {
    title = "Portal das ideias";
    content = `<p>Sua construção abre um atalho para os desafios deste mundo, de memória e lógica. Descobertas de exploração ainda pedem visitar o mirante.</p><div class="r3-activity-list">${realm.challenges.map((ch) => `<article><h3>${esc(ch.title)}</h3><p>${ch.completed ? "✓ Descoberta guardada" : esc(ch.prompt)}</p>${btn("Explorar desafio", "challenge", `data-id="${esc(ch.id)}"`)}</article>`).join("") || "<p>O responsável pode criar novos desafios para este mundo.</p>"}</div>`;
  } else if (modal === "portals") {
    title = "Para onde vamos?";
    content = `<p>Cinco mundos, muitas descobertas. Sua agenda está sempre com você.</p><div class="r3-world-grid">${data.worlds.map((w) => `<button type="button" class="r3-world-card theme-${w.preset}" data-action="r3-travel" data-id="${esc(w.id)}" ${w.unlocked ? "" : "disabled"}><span class="r3-world-symbol">${{ forest: "♧", clouds: "☁", robots: "▣", treasure: "⚑", crystal: "◇" }[w.preset]}</span><strong>${esc(w.name)}</strong><small>${w.id === realm.id ? "Você está aqui" : w.unlocked ? "Explorar →" : "Precisa: " + esc(data.economy.catalog.find((i) => i.id === w.unlock_item)?.name || "liberação do responsável")}</small><span>${w.challenges.filter((c) => c.completed).length}/${w.challenges.length} descobertas</span></button>`).join("")}</div>`;
  } else if (modal === "activities") {
    title = "Suas atividades";
    const local = host.missions.filter((e) => realm.event_ids.includes(e.id));
    content = `<p>${esc(host.dateLabel)} · ${esc(realm.name)} tem ${local.length} atividade(s) vinculada(s). A agenda completa continua acessível.</p><div class="r3-dates">${btn("← Dia anterior", "date", 'data-offset="-1"')}${btn("Hoje", "date", 'data-offset="0"')}${btn("Próximo dia →", "date", 'data-offset="1"')}</div><div class="r3-activity-list">${host.missions.map((e) => `<article><small>${esc(e.time)} · ${e.done ? "Concluída" : "Pendente"} ${realm.event_ids.includes(e.id) ? "· Neste mundo" : ""}</small><h3>${esc(e.title)}</h3>${e.window && typeof windowLabel === "function" ? "<p>" + esc(windowLabel(e.window)) + "</p>" : ""}${e.has_mission ? btn("Aprender · Fazer · Lembrar", "mission", `data-event="${e.id}" data-date="${esc(e.date)}"`) : btn("Ver na agenda · sem roteiro", "calendar")}</article>`).join("") || "<p>Nenhuma atividade nesta data. Abra a agenda para consultar outros dias.</p>"}</div>${btn("Abrir agenda completa", "calendar")}`;
  } else if (modal === "shop") {
    title = "Oficina de estrelas";
    content = `<p>Seu saldo: ${data.economy.stars} estrelas. Construções mudam os mundos; suas compras ficam guardadas.</p><div class="r3-shop-grid">${data.economy.catalog.map((i) => `<article><span class="r3-shop-icon">${{ bridge: "⌁", house: "⌂", portal: "◈", hat: "♜", cape: "✧", buddy: "◉" }[i.id]}</span><h3>${esc(i.name)}</h3><p>${esc(i.description)}</p><strong>${i.removed ? "Removido pelo responsável" : i.owned ? "Já é seu" : i.available ? i.price + " ✦" : "Indisponível"}</strong>${!i.owned && !i.removed && i.available ? btn(i.kind === "building" ? "Construir" : "Guardar", "buy", `data-id="${i.id}" ${data.economy.stars < i.price ? "disabled" : ""}`) : ""}</article>`).join("")}</div>`;
  } else if (modal === "wardrobe") {
    title = "Meu personagem";
    content = `<p>Roupas e cores aparecem no Davi e no Pipo em todos os mundos.</p><div class="r3-dates">${[
      ["mint", "Menta"],
      ["sun", "Sol"],
      ["sky", "Azul"],
    ]
      .map(([id, label]) =>
        btn(
          label,
          "color",
          `data-id="${id}" aria-pressed="${data.economy.avatar.color === id}"`,
        ),
      )
      .join(
        "",
      )}</div>${["hat", "cape", "buddy"].map((id) => `<p>${esc(data.economy.catalog.find((i) => i.id === id).name)} ${own(id) ? btn(data.economy.avatar[id] ? "Tirar" : "Usar", "equip", `data-id="${id}" aria-pressed="${!!data.economy.avatar[id]}"`) : "· Adquira na oficina"}</p>`).join("")}`;
  } else {
    const ch = realm.challenges.find((c) => c.id === modal);
    title = ch.title;
    content = `<p>${esc(ch.prompt)}</p>${ch.kind === "sequence" ? "<p>Observe: " + ch.choices.map(esc).join(" → ") + "</p>" : ""}${ch.completed ? '<p class="r3-success">✓ Descoberta já guardada</p>' : ""}${
      ch.kind === "explore"
        ? "<p>Caminhe até o farol deste desafio (◇) e escolha guardar a descoberta.</p>"
        : `<p class="r3-selection">Sua resposta: ${selection.map(esc).join(" → ") || "Escolha abaixo"}</p><div class="r3-dates">${[
            ...ch.choices,
          ]
            .sort()
            .map((choice) =>
              btn(
                esc(choice),
                "pick",
                `data-choice="${esc(choice)}" ${selection.includes(choice) ? "disabled" : ""}`,
              ),
            )
            .join("")}</div>${btn("Recomeçar resposta", "clear")}`
    }${btn("Guardar descoberta", "answer", `data-id="${esc(ch.id)}"`)}<p>Descobertas ficam neste mundo. As estrelas continuam ligadas às atividades, sem cobrança ou prêmio duplicado por viajar.</p><p id="r3ChallengeMessage" role="status"></p>`;
  }
  document.getElementById("r3DialogBody").innerHTML =
    `<div class="r3-dialog-head"><span>DIÁRIO DO EXPLORADOR</span>${btn("Fechar ×", "close")}</div><h2 id="r3DialogTitle">${esc(title)}</h2>${content}`;
}
async function reload() {
  await save();
  const currentModal = modal;
  const options = host;
  await open(options);
  if (currentModal) {
    modal = currentModal;
    renderDialog();
    document.getElementById("r3Dialog").showModal();
  }
}
async function action(a, b) {
  const name = a.replace("r3-", "");
  if (name === "fallback") {
    await save();
    dispose();
    await host.onFallback();
    return;
  }
  if (name === "calendar") {
    await save();
    await host.onCalendar();
    return;
  }
  if (name === "mission") {
    await save();
    await host.onMission(Number(b.dataset.event), b.dataset.date);
    return;
  }
  if (name === "date") {
    await save();
    await host.onDate(Number(b.dataset.offset));
    return;
  }
  if (name === "close") {
    document.getElementById("r3Dialog").close();
    modal = null;
    selection = [];
    canvas.focus({ preventScroll: true });
    return;
  }
  if (name === "rotate-left" || name === "rotate-right") {
    angle += ((name === "rotate-left" ? -1 : 1) * Math.PI) / 4;
    return;
  }
  if (name === "camera") {
    angle = 0.62;
    zoom = 20;
    return;
  }
  if (name === "nearby") {
    const near = nearest();
    if (near && near.d < 3.5) {
      if (near.action === "challenge") showDialog(near.id);
      else showDialog(near.action);
    }
    return;
  }
  if (name === "travel") {
    await save();
    data = await host.api("/api/realms/travel", "POST", {
      world_id: b.dataset.id,
    });
    modal = null;
    await open(host);
    return;
  }
  if (name === "buy") {
    const i = data.economy.catalog.find((i) => i.id === b.dataset.id);
    await host.api("/api/world/buy", "POST", { item_id: i.id, price: i.price });
    await reload();
    return;
  }
  if (name === "color" || name === "equip") {
    const avatar = { ...data.economy.avatar };
    if (name === "color") avatar.color = b.dataset.id;
    else avatar[b.dataset.id] = avatar[b.dataset.id] ? null : b.dataset.id;
    await host.api("/api/world/equip", "PUT", avatar);
    await reload();
    return;
  }
  if (name === "challenge") {
    showDialog(b.dataset.id);
    return;
  }
  if (name === "pick") {
    selection.push(b.dataset.choice);
    renderDialog();
    return;
  }
  if (name === "clear") {
    selection = [];
    renderDialog();
    return;
  }
  if (name === "answer") {
    await save();
    const result = await host.api("/api/realms/challenge", "POST", {
      challenge_id: b.dataset.id,
      selected: selection,
    });
    if (result.correct) {
      realm.challenges.find((ch) => ch.id === b.dataset.id).completed = true;
      renderDialog();
    }
    document.getElementById("r3ChallengeMessage").textContent = result.message;
    return;
  }
  if (
    ["portals", "activities", "shop", "wardrobe", "home", "ideas"].includes(
      name,
    )
  )
    showDialog(name);
}
function dispose() {
  cancelAnimationFrame(frame);
  abort?.abort();
  observer?.disconnect();
  keys.clear();
  target = null;
  modal = null;
  document.getElementById("r3Dialog")?.close();
  document.body.classList.remove("r3-view");
  if (scene) {
    scene.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
    });
    scene.clear();
  }
  for (const g of geometries.values()) g.dispose();
  for (const m of materials.values()) m.dispose();
  geometries.clear();
  materials.clear();
  if (renderer) {
    renderer.dispose();
    renderer.forceContextLoss();
  }
  renderer = null;
  animated = [];
  labels = [];
  stats = { frames: 0, ms: 0 };
}
function close() {
  if (renderer) save();
  dispose();
}
async function open(options) {
  if (renderer) await save();
  dispose();
  host = options;
  data = await host.api("/api/realms");
  if (data.current && data.current !== data.stored_current)
    data = await host.api("/api/realms/travel", "POST", {
      world_id: data.current,
    });
  realm = data.worlds.find((w) => w.id === data.current);
  if (!realm) return false;
  quality = localStorage.getItem("davi-3d-quality") || "auto";
  still =
    localStorage.getItem("davi-3d-still") === "true" ||
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  paused = false;
  dirty = false;
  last = 0;
  elapsed = 0;
  layout();
  try {
    renderer = new T.WebGLRenderer({
      canvas,
      antialias: innerWidth > 700,
      alpha: false,
      powerPreference: "low-power",
    });
  } catch {
    dispose();
    return false;
  }
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(42, 1, 0.1, 180);
  scene.add(new T.HemisphereLight("#fdf6dd", "#729caa", 2.7));
  const sun = new T.DirectionalLight("#fff3d6", 3.1);
  sun.position.set(-12, 25, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.normalBias = 0.04;
  sun.shadow.bias = -0.0002;
  scene.add(sun);
  scene.add(new T.AmbientLight("#ffffff", 0.15));
  buildScene();
  batchStatic();
  bind();
  applyQuality();
  drawCamera();
  renderer.render(scene, camera);
  frame = requestAnimationFrame(tick);
  canvas.dataset.ready = "true";
  return true;
}
window.DaviWorld3D = { open, close, action };
export { open, close, action };
