/* Forest art slice: authored Blender GLBs, local Three.js, existing missions/economy. */
import * as T from "/vendor/three/three.module.min.js";
import { GLTFLoader } from "/vendor/three/addons/loaders/GLTFLoader.js";
import { clone as cloneRig } from "/vendor/three/addons/utils/SkeletonUtils.js";
import { mergeGeometries } from "/vendor/three/addons/utils/BufferGeometryUtils.js";
import { EffectComposer } from "/vendor/three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "/vendor/three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "/vendor/three/addons/postprocessing/SSAOPass.js";
import { UnrealBloomPass } from "/vendor/three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "/vendor/three/addons/postprocessing/OutputPass.js";
let sunLight,
  adaptiveLow = false;
let host,
  data,
  renderer,
  composer,
  ao,
  bloom,
  scene,
  camera,
  canvas,
  stage,
  abort,
  observer,
  frame = 0,
  player,
  pipo,
  bridge,
  house,
  terrain;
let pipoActions = {},
  pipoClip = "Hover";
let mixers = [],
  actions = {},
  clip = "Idle",
  target = null,
  keys = new Set(),
  last = 0,
  clock = 0,
  angle = 0.55,
  distance = 13,
  look = new T.Vector3(),
  modal = null,
  dirty = false,
  saving = false,
  lastSave = 0,
  still = false,
  quality = "auto",
  low = false,
  paused = false;
let canopies = [];
let staticGroups = [],
  wind = [],
  water,
  particles,
  blinkAt = 3.2,
  blinkUntil = 0,
  waving = 0,
  stats = { frames: 0, times: [], loads: [] },
  assetCache = null;
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const button = (text, action, attrs = "", cls = "") =>
  `<button type="button" class="f-button ${cls}" data-action="forest-${action}" ${attrs}>${text}</button>`;
const owned = (id) => data.economy.inventory.includes(id);
const ground = (x, z) =>
  0.14 * Math.sin(x * 0.28) +
  0.13 * Math.cos(-z * 0.31) +
  0.07 * Math.sin(x * 0.5 - z * 0.3) +
  2.1 * Math.exp(-(((x + 9) / 3.2) ** 2) - ((-z - 6) / 4) ** 2);
function walkable(x, z) {
  if ((x / 17) ** 2 + (z / 11.5) ** 2 > 1) return false;
  if (data.obstacles.some(([a, b, r]) => Math.hypot(x - a, z - b) < r + 0.23))
    return false;
  const river = -2 - 1.1 * Math.sin(x * 0.2);
  if (!owned("bridge") && z < river + 2.7) return false;
  return (
    Math.abs(z - river) >= 2.7 ||
    (owned("bridge") && Math.abs(x) < 1.03 && z > -5.7 && z < 1.5)
  );
}
function floor(x, z) {
  if (owned("bridge") && Math.abs(x) < 1.12 && z < 1.2 && z > -5.2)
    return ground(0, z) + 0.19 + 0.48 * Math.sin(((-z + 1.2) / 6.21) * Math.PI);
  return ground(x, z) + 0.025;
}
function message(text) {
  const el = document.getElementById("forestMessage");
  if (el) el.textContent = text;
}
function preference(key, fallback) {
  try {
    return localStorage.getItem("davi-forest-" + key) ?? fallback;
  } catch {
    return fallback;
  }
}
function store(key, value) {
  try {
    localStorage.setItem("davi-forest-" + key, String(value));
  } catch {}
}
async function assets() {
  if (!assetCache) {
    const loader = new GLTFLoader();
    assetCache = Promise.all(
      ["forest", "bridge", "treehouse", "davi", "pipo"].map(async (name) => ({
        name,
        ...(await loader.loadAsync(`/assets/forest/${name}.glb`)),
      })),
    ).catch((error) => { assetCache = null; throw error; });
  }
  return assetCache;
}
function prepare(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const mat of list) {
        mat.envMapIntensity = 0.35;
        for (const key of ["map", "normalMap", "roughnessMap"])
          if (mat[key])
            mat[key].anisotropy = Math.min(
              8,
              renderer.capabilities.getMaxAnisotropy(),
            );
      }
    }
  });
}
function batch(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.name === "Terrain") return;
    if (/Oak_foliage|Treehouse_crown/.test(o.name)) {
      o.material = o.material.clone();
      o.material.alphaHash = true;
      canopies.push({
        object: o,
        sphere: new T.Box3().setFromObject(o).getBoundingSphere(new T.Sphere()),
      });
      return;
    }
    const isDetail = !!o.userData.detail || /Grass/.test(o.name),
      isWind = !!o.userData.wind;
    const signature = Object.keys(o.geometry.attributes)
      .sort()
      .map((k) => k + o.geometry.attributes[k].itemSize)
      .join(":");
    const key =
      o.material.uuid +
      signature +
      isDetail +
      isWind +
      !!o.userData.permanent +
      (o.geometry.index ? "i" : "n");
    const list = buckets.get(key) || [];
    list.push(o);
    buckets.set(key, list);
  });
  for (const list of buckets.values()) {
    const first = list[0],
      geos = list.map((o) => o.geometry.clone().applyMatrix4(o.matrixWorld));
    const geometry = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!geometry) continue;
    const mat = first.material.clone();
    const joined = new T.Mesh(geometry, mat);
    joined.castShadow = true;
    joined.receiveShadow = true;
    joined.userData.detail =
      !!first.userData.detail || /Grass/.test(first.name);
    joined.userData.wind = !!first.userData.wind;
    joined.userData.owner = first.userData.owner;
    joined.userData.permanent = first.userData.permanent;
    joined.name = first.name + " batched";
    scene.add(joined);
    staticGroups.push(joined);
    list.forEach((o) => o.removeFromParent());
    if (joined.userData.wind) {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.forestTime = { value: 0 };
        shader.vertexShader =
          "uniform float forestTime;\n" + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\n transformed.x += sin(forestTime*.8 + position.x*.7 + position.z*.5) * clamp(position.y*.018,0.,.12);",
        );
        wind.push(shader);
      };
      mat.customProgramCacheKey = () => "forestWind1";
    }
  }
}
function createWater() {
  const verts = [],
    uv = [],
    indices = [],
    segments = 128;
  for (let i = 0; i <= segments; i++) {
    const x = -20 + (i * 40) / segments,
      z = -2 - 1.1 * Math.sin(x * 0.2);
    for (const side of [-1, 1]) {
      verts.push(x, -1.8, z + side * 2.65);
      uv.push(i / segments, side === -1 ? 0 : 1);
    }
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 vUv;varying vec3 vPos;uniform float time;void main(){vUv=uv;vec3 p=position;p.y+=sin(p.x*2.+time)*.018;vPos=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:
      `varying vec2 vUv;varying vec3 vPos;uniform float time;void main(){float w=sin(vPos.x*6.+vPos.z*11.-time*1.6)*sin(vPos.x*4.-vPos.z*8.+time*.8);float glint=pow(max(0.,w),10.);float bank=pow(abs(vUv.y*2.-1.),7.);vec3 col=mix(vec3(.025,.16,.22),vec3(.06,.34,.36),vUv.y*.5+.35);col+=glint*.08+bank*vec3(.1,.18,.15);gl_FragColor=vec4(col,.92);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(
        ";#include",
        ";\n#include",
      ),
  });
  water = new T.Mesh(geometry, mat);
  water.name = "Creek surface";
  scene.add(water);
}
function cascade() {
  const points = [
      [-9, 2.25, -6.1],
      [-9, 2.2, -5.2],
      [-9, 1.6, -4.8],
      [-9, 0.2, -4.25],
      [-9, -1.3, -3.65],
      [-9, -2.4, -2.2],
      [-9, -2.43, -0.9],
    ],
    curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
    positions = [],
    uv = [],
    indices = [];
  for (let i = 0; i <= 70; i++) {
    const p = curve.getPoint(i / 70),
      width = 0.65 + (i / 70) * 0.25;
    for (const side of [-1, 1]) {
      positions.push(p.x + side * width, p.y, p.z);
      uv.push(side < 0 ? 0 : 1, i / 70);
    }
    if (i < 70) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const uniforms = water.material.uniforms;
  const mat = new T.ShaderMaterial({
    side: T.DoubleSide,
    transparent: true,
    depthWrite: false,
    uniforms,
    vertexShader:
      "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader:
      "varying vec2 vUv;uniform float time;void main(){float lines=sin(vUv.x*80.+sin(vUv.y*21.-time*3.))*0.5+0.5;float flow=sin(vUv.y*70.-time*9.)*.5+.5;vec3 c=mix(vec3(.2,.57,.54),vec3(.78,.94,.83),lines*.65+flow*.2);float edge=smoothstep(0.,.08,vUv.x)*smoothstep(1.,.92,vUv.x);gl_FragColor=vec4(c,edge*.8);}",
  });
  scene.add(new T.Mesh(geo, mat));
}
function motes() {
  const positions = [],
    seed = (i) => Math.sin(i * 127.1) * 0.5 + 0.5;
  for (let i = 0; i < 54; i++)
    positions.push(
      (seed(i) - 0.5) * 19,
      1 + seed(i + 43) * 5,
      (seed(i + 98) - 0.5) * 20,
    );
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  const pixels = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x - 15.5, y - 15.5) / 15.5,
        a = Math.max(0, 1 - d) ** 2,
        idx = (y * 32 + x) * 4;
      pixels[idx] = 255;
      pixels[idx + 1] = 231;
      pixels[idx + 2] = 153;
      pixels[idx + 3] = Math.round(a * 210);
    }
  const tex = new T.DataTexture(pixels, 32, 32);
  tex.needsUpdate = true;
  const m = new T.PointsMaterial({
    color: "#ffeab4",
    map: tex,
    size: 0.11,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: T.AdditiveBlending,
  });
  particles = new T.Points(g, m);
  scene.add(particles);
}
function layout() {
  host.layout(
    `<section class="forest-shell"><header class="forest-title"><div><span>UM CAMINHO DE DESCOBERTAS</span><h1>Floresta Encantada</h1></div><div class="forest-tools">${button("✦ <strong>" + data.economy.stars + "</strong>", "shop", 'aria-label="Oficina, ' + data.economy.stars + ' estrelas"', "forest-wallet")}${button("▣ Minhas missões", "missions")}${button("☷", "options", 'aria-label="Opções do mundo"')}</div></header><div class="forest-stage" id="forestStage"><canvas id="forestCanvas" tabindex="0" aria-label="Floresta Encantada. Ande com setas ou WASD; E para interagir." aria-describedby="forestInstructions"></canvas><div class="forest-chapter"><span>01</span><div>O BOSQUE DO RIACHO<small>Davi & Pipo</small></div></div><div class="forest-camera">${button("↶", "rotate", 'data-turn="-1" aria-label="Girar câmera à esquerda"')}${button("⌖", "camera", 'aria-label="Centralizar câmera"')}${button("↷", "rotate", 'data-turn="1" aria-label="Girar câmera à direita"')}</div><div class="forest-dpad" role="group" aria-label="Andar"><button data-forest-dir="up" aria-label="Andar para frente">↑</button><button data-forest-dir="left" aria-label="Andar à esquerda">←</button><button data-forest-dir="down" aria-label="Andar para trás">↓</button><button data-forest-dir="right" aria-label="Andar à direita">→</button></div><button id="forestInteract" class="forest-interact" data-action="forest-nearby">Explorar · E</button><div id="forestLoading" class="forest-loading">Abrindo o caminho da floresta…</div></div><div class="forest-pipo"><span class="forest-pipo-icon" aria-hidden="true">✧</span><p id="forestMessage" role="status">Pipo: O riacho guarda um caminho novo. Vamos descobrir juntos?</p>${button("Ver agenda", "calendar")}</div><p id="forestInstructions" class="forest-instructions">Toque no caminho · setas ou WASD para andar · E para explorar</p></section><dialog id="forestDialog" class="forest-dialog" aria-labelledby="forestDialogTitle"><div id="forestDialogBody"></div></dialog>`,
  );
  document.body.classList.add("forest-view");
  stage = document.getElementById("forestStage");
  canvas = document.getElementById("forestCanvas");
}
function feature(name) {
  if (name === "bridge")
    return {
      x: 0,
      z: 0.9,
      title: owned("bridge") ? "A ponte do riacho" : "Construir a ponte",
      icon: "⌁",
    };
  if (name === "chest")
    return { x: -4, z: -4, title: "Baú de descobertas", icon: "✦" };
  if (name === "house")
    return {
      x: 3.5,
      z: -5.2,
      title: owned("house") ? "Casa na árvore" : "Nosso refúgio nas copas",
      icon: "⌂",
    };
  return { x: -2.1, z: 1.7, title: "Diário de missões", icon: "▣" };
}
function nearest() {
  return ["bridge", "house", "missions", "chest"]
    .map((id) => ({
      ...feature(id),
      id,
      d: Math.hypot(
        player.position.x - feature(id).x,
        player.position.z - feature(id).z,
      ),
    }))
    .sort((a, b) => a.d - b.d)[0];
}
function syncOwned() {
  for (const obj of staticGroups) {
    if (obj.userData.owner)
      obj.visible = owned(obj.userData.owner) || !!obj.userData.permanent;
  }
  bridge.visible = owned("bridge");
  house.traverse((o) => {
    if (!o.isMesh) return;
    o.visible =
      owned("house") || /Ancient|House_roots|Treehouse_crown/.test(o.name);
  });
  player.traverse((o) => {
    if (o.isMesh) {
      if (/^Hat/.test(o.name)) o.visible = owned("hat") && !!data.economy.avatar.hat;
      if (/^Cape/.test(o.name)) o.visible = owned("cape") && !!data.economy.avatar.cape;
      if (o.material?.name === "Teal")
        o.material.color.set(
          { mint: "#258f8a", sun: "#c79946", sky: "#4c87ad" }[
            data.economy.avatar.color
          ],
        );
    }
  });
  pipo.traverse((o) => {
    if (o.isMesh && /^Buddy_scarf/.test(o.name)) o.visible = owned("buddy") && !!data.economy.avatar.buddy;
  });
  const star = document.querySelector(".forest-wallet strong");
  if (star) star.textContent = data.economy.stars;
}
function resize() {
  if (!renderer || !stage) return;
  const w = stage.clientWidth,
    h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  composer?.setSize(w, h);
}
function setQuality() {
  low =
    quality === "low" ||
    (quality === "auto" &&
      (innerWidth < 700 || navigator.hardwareConcurrency <= 4 || adaptiveLow));
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const size = low ? 1024 : 2048;
  if (sunLight && sunLight.shadow.mapSize.x !== size) {
    sunLight.shadow.map?.dispose();
    sunLight.shadow.map = null;
    sunLight.shadow.mapSize.set(size, size);
  }
  ao.enabled = !low;
  bloom.enabled = !low;
  composer.setPixelRatio(low ? 1 : Math.min(1.5, devicePixelRatio));
  for (const g of staticGroups) {
    if (g.userData.detail) g.visible = !low;
  }
  resize();
}
async function save() {
  if (!dirty || saving || !renderer) return;
  saving = true;
  dirty = false;
  try {
    await host.api("/api/forest/move", "PUT", {
      x: player.position.x,
      z: player.position.z,
    });
  } catch (e) {
    message(e.message);
    dirty = true;
  } finally {
    saving = false;
  }
}
function animateClip(next) {
  if (next === clip) return;
  actions[clip]?.fadeOut(0.2);
  actions[next]?.reset().fadeIn(0.2).play();
  clip = next;
}
function updateCamera(dt = 1) {
  const pos = player.position,
    follow = pos.clone().add(new T.Vector3(0, 0.9, -1.2));
  look.lerp(follow, Math.min(1, dt * 5));
  const offset = new T.Vector3(
    Math.sin(angle) * distance,
    distance * 1.1,
    Math.cos(angle) * distance,
  );
  camera.position.lerp(follow.clone().add(offset), Math.min(1, dt * 4));
  camera.lookAt(look);
  camera.updateMatrixWorld();
  const hero = player.position.clone().add(new T.Vector3(0, 1, 0)),
    ray = new T.Ray(
      camera.position,
      hero.clone().sub(camera.position).normalize(),
    ),
    length = camera.position.distanceTo(hero);
  for (const c of canopies) {
    const hit = ray.intersectSphere(
        new T.Sphere(c.sphere.center, c.sphere.radius + 0.7),
        new T.Vector3(),
      ),
      blocked = !!hit && camera.position.distanceTo(hit) < length;
    const goal = blocked ? 0 : 1;
    c.object.material.opacity = T.MathUtils.lerp(
      c.object.material.opacity,
      goal,
      Math.min(1, dt * 9),
    );
    c.object.visible = c.object.material.opacity > 0.035;
  }
}
function tick(now) {
  if (!renderer) return;
  frame = requestAnimationFrame(tick);
  if (paused || document.hidden) {
    last = now;
    return;
  }
  const rawMs = last ? now - last : 0;
  const dt = Math.min(rawMs / 1000, 0.05);
  last = now;
  clock += dt;
  let dx = 0,
    dz = 0;
  if (!modal) {
    const sx = Number(keys.has("right")) - Number(keys.has("left")),
      sz = Number(keys.has("down")) - Number(keys.has("up"));
    dx = sx * Math.cos(angle) + sz * Math.sin(angle);
    dz = -sx * Math.sin(angle) + sz * Math.cos(angle);
    if (target && !keys.size) {
      dx = target.x - player.position.x;
      dz = target.z - player.position.z;
      if (Math.hypot(dx, dz) < 0.12) {
        target = null;
        dx = dz = 0;
      }
    }
  }
  const len = Math.hypot(dx, dz);
  let moving = false;
  if (len) {
    const step = Math.min(1.65 * dt, len),
      x = player.position.x + (dx / len) * step,
      z = player.position.z + (dz / len) * step;
    if (walkable(x, z)) {
      player.position.x = x;
      player.position.z = z;
      const rot = Math.atan2(dx, dz),
        delta = Math.atan2(
          Math.sin(rot - player.rotation.y),
          Math.cos(rot - player.rotation.y),
        );
      player.rotation.y += delta * Math.min(1, dt * 12);
      dirty = true;
      moving = true;
    } else target = null;
  }
  player.position.y = floor(player.position.x, player.position.z);
  const buddyClip = moving ? "Walk" : "Hover";
  if (buddyClip !== pipoClip) {
    pipoActions[pipoClip]?.fadeOut(0.2);
    pipoActions[buddyClip]?.reset().fadeIn(0.2).play();
    pipoClip = buddyClip;
  }
  if (waving > clock) animateClip("Wave");
  else animateClip(moving ? "Walk" : "Idle");
  mixers.forEach((m) => m.update(still && !moving ? 0 : dt));
  const desired = player.position.clone().add(new T.Vector3(-0.8, 0.025, 0.65));
  pipo.position.lerp(desired, Math.min(1, dt * (moving ? 3.4 : 2)));
  pipo.position.y = Math.max(
    pipo.position.y,
    floor(pipo.position.x, pipo.position.z) + 0.025,
  );
  pipo.quaternion.slerp(player.quaternion, Math.min(1, dt * 2.7));
  if (clock > blinkAt && clock < blinkAt + 0.13) {
    blinkUntil = 1;
  } else {
    if (blinkUntil) {
      blinkAt = clock + 3.1 + (Math.sin(clock) * 0.5 + 0.5) * 2;
      blinkUntil = 0;
    }
  }
  player.traverse((o) => {
    if (o.isMesh && /^Blink_/.test(o.name)) o.visible = !blinkUntil;
  });
  for (const shader of wind)
    shader.uniforms.forestTime.value = still ? 0 : clock;
  water.material.uniforms.time.value = still ? 0 : clock;
  if (particles && !still) particles.rotation.y = Math.sin(clock * 0.1) * 0.035;
  updateCamera(dt);
  renderer.info.reset();
  composer.render(dt);
  stats.frames++;
  if (dt > 0) stats.times.push(rawMs);
  if (stats.times.length > 240) stats.times.shift();
  if (
    quality === "auto" &&
    !adaptiveLow &&
    stats.times.length >= 120 &&
    stats.times.slice(-90).reduce((a, b) => a + b, 0) / 90 > 28
  ) {
    adaptiveLow = true;
    setQuality();
  }
  if (now - lastSave > 1000 && dirty) {
    lastSave = now;
    save();
  }
  const near = nearest(),
    b = document.getElementById("forestInteract");
  if (b) {
    b.disabled = near.d > 2.6;
    b.textContent =
      near.d < 2.6
        ? `${near.icon} ${near.title} · E`
        : "Explorar por perto · E";
  }
  canvas.dataset.frames = stats.frames;
  canvas.dataset.calls = renderer.info.render.calls;
  canvas.dataset.triangles = renderer.info.render.triangles;
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
    if (modal) return;
    if (e.target !== canvas && !e.target.closest("[data-forest-dir]")) return;
    if (dirs[e.key]) {
      e.preventDefault();
      target = null;
      keys.add(dirs[e.key]);
    }
    if (e.key.toLowerCase() === "e") {
      e.preventDefault();
      host.run(() => action("forest-nearby", {}));
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
    save();
  });
  document.querySelectorAll("[data-forest-dir]").forEach((b) => {
    on(b, "pointerdown", (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      target = null;
      keys.add(b.dataset.forestDir);
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
      if (e.key === " " || e.key === "Enter") keys.add(b.dataset.forestDir);
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
      p = new T.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      ray = new T.Raycaster();
    ray.setFromCamera(p, camera);
    const hit = ray.intersectObject(terrain, false)[0];
    if (hit && walkable(hit.point.x, hit.point.z))
      target = { x: hit.point.x, z: hit.point.z };
    else message("Pipo: Siga o caminho. A ponte nos leva à outra margem.");
  });
  on(canvas, "webglcontextlost", (e) => {
    e.preventDefault();
    paused = true;
    keys.clear();
    save();
    message(
      "A floresta pausou neste aparelho. Abra a ilha 2D nas opções para continuar.",
    );
  });
  on(canvas, "webglcontextrestored", () => {
    paused = false;
    last = 0;
  });
  on(document.getElementById("forestDialog"), "cancel", () => {
    modal = null;
    keys.clear();
    canvas.focus({ preventScroll: true });
  });
  observer = new ResizeObserver(() => {
    setQuality();
  });
  observer.observe(stage);
}
function renderDialog() {
  let title = "",
    body = "";
  if (modal === "chest") {
    title = "O baú das descobertas";
    body =
      "<p>O Pipo encontrou um lugar para guardar suas conquistas. Suas estrelas e acessórios continuam na oficina.</p>" +
      button("Abrir oficina", "shop");
  } else if (modal === "missions") {
    title = "Seu diário de missões";
    body = `<p>${esc(host.dateLabel)}. Todas as atividades continuam aqui, antes e depois do horário.</p><div class="f-missions">${host.missions.map((e) => `<article><small>${esc(e.time)} · ${e.done ? "Concluída" : "Pendente"}</small><h3>${esc(e.title)}</h3><p>${e.window ? esc(windowLabel(e.window)) : ""}</p>${e.has_mission ? button("Entrar na missão", "mission", `data-id="${e.id}" data-date="${e.date}"`) : button("Ver na agenda · sem roteiro", "calendar")}</article>`).join("") || "<p>Não há atividades nesta data. A agenda mostra todos os outros dias.</p>"}</div>${button("Abrir agenda completa", "calendar")}`;
  } else if (modal === "bridge" || modal === "house") {
    const id = modal,
      i = data.economy.catalog.find((i) => i.id === id);
    title = id === "bridge" ? "A ponte do riacho" : "Uma casa entre as folhas";
    body = `<p>${id === "bridge" ? "Tábuas de madeira, cordas firmes e um caminho até a outra margem." : "Um refúgio nas copas para imaginar, descansar e guardar boas ideias."}</p><p>${i.removed ? "O responsável removeu esta construção. Peça a ele para reativar sem nova cobrança." : i.owned ? (id === "bridge" ? "Sua ponte está pronta! Siga pelo centro e atravesse com o Pipo." : "Seu refúgio está pronto. Que história vamos levar para a vida real?") : `Construir: ${i.price} estrelas · seu saldo: ${data.economy.stars}.`}</p>${!i.removed && !i.owned && i.available ? button("Construir por " + i.price + " ✦", "buy", `data-id="${id}" ${data.economy.stars < i.price ? "disabled" : ""}`, "f-primary") : ""}${i.owned ? button(id === "bridge" ? "Vamos atravessar" : "Abrir meu diário", id === "bridge" ? "cross" : "missions") : ""}`;
  } else if (modal === "shop") {
    title = "Oficina do bosque";
    body = `<p>Seu saldo: ${data.economy.stars} estrelas. Construções e acessórios continuam guardados entre os aparelhos.</p><div class="f-shop">${data.economy.catalog.map((i) => `<article><h3>${esc(i.name)}</h3><p>${esc(i.description)}</p><strong>${i.removed ? "Removido pelo responsável" : i.owned ? "Já é seu" : i.price + " ✦"}</strong>${!i.owned && !i.removed && i.available ? button("Guardar", "buy", `data-id="${i.id}" ${data.economy.stars < i.price ? "disabled" : ""}`) : i.owned && i.kind !== "building" ? button(data.economy.avatar[i.id] ? "Tirar" : "Usar", "equip", `data-id="${i.id}"`) : ""}</article>`).join("")}</div>`;
  } else {
    title = "Do seu jeito";
    body = `<label for="forestQuality">Qualidade</label><select id="forestQuality"><option value="auto">Automática</option><option value="low">Econômica</option><option value="high">Detalhada</option></select><label><input id="forestMotion" type="checkbox" ${still ? "" : "checked"}>Animações do bosque</label><div class="f-options">${button("Menta", "color", 'data-color="mint"')}${button("Sol", "color", 'data-color="sun"')}${button("Azul", "color", 'data-color="sky"')}${button("Câmera mais perto", "zoom", 'data-amount="-2.5"')}${button("Câmera mais longe", "zoom", 'data-amount="2.5"')}${button("Abrir a ilha 2D", "fallback")}</div><p>As missões, o saldo e os controles do responsável são os mesmos da agenda.</p>`;
  }
  document.getElementById("forestDialogBody").innerHTML =
    `<div class="f-dialog-top"><span>O DIÁRIO DO BOSQUE</span>${button("Fechar ×", "close")}</div><h2 id="forestDialogTitle">${title}</h2>${body}`;
  if (modal === "options") {
    const q = document.getElementById("forestQuality");
    q.value = quality;
    q.onchange = () => {
      quality = q.value;
      store("quality", quality);
      setQuality();
    };
    document.getElementById("forestMotion").onchange = (e) => {
      still = !e.target.checked;
      store("still", still);
    };
  }
}
function dialog(name) {
  modal = name;
  keys.clear();
  target = null;
  waving = clock + 1.6;
  renderDialog();
  document.getElementById("forestDialog").showModal();
}
async function refresh() {
  data = await host.api("/api/forest");
  syncOwned();
  if (!walkable(player.position.x, player.position.z)) {
    player.position.set(data.position.x, 0, data.position.z);
  }
  renderDialog();
}
async function action(a, b) {
  const name = a.replace("forest-", "");
  if (name === "calendar") {
    await save();
    await host.onCalendar();
    return;
  }
  if (name === "mission") {
    await save();
    await host.onMission(Number(b.dataset.id), b.dataset.date);
    return;
  }
  if (name === "fallback") {
    await save();
    close();
    await host.onFallback();
    return;
  }
  if (name === "rotate") {
    angle += (Number(b.dataset.turn) * Math.PI) / 6;
    return;
  }
  if (name === "zoom") {
    distance = T.MathUtils.clamp(distance + Number(b.dataset.amount), 6, 18);
    return;
  }
  if (name === "camera") {
    angle = 0.55;
    distance = 13;
    return;
  }
  if (name === "close") {
    document.getElementById("forestDialog").close();
    modal = null;
    canvas.focus({ preventScroll: true });
    return;
  }
  if (name === "nearby") {
    const near = nearest();
    if (near.d < 2.6) dialog(near.id);
    return;
  }
  if (name === "buy") {
    const item = data.economy.catalog.find((i) => i.id === b.dataset.id);
    await host.api("/api/world/buy", "POST", {
      item_id: item.id,
      price: item.price,
    });
    await refresh();
    waving = clock + 1.8;
    message("Pipo: Conseguimos! O bosque ganhou uma nova história.");
    return;
  }
  if (name === "equip" || name === "color") {
    const avatar = { ...data.economy.avatar };
    if (name === "color") avatar.color = b.dataset.color;
    else avatar[b.dataset.id] = avatar[b.dataset.id] ? null : b.dataset.id;
    await host.api("/api/world/equip", "PUT", avatar);
    await refresh();
    return;
  }
  if (name === "cross") {
    document.getElementById("forestDialog").close();
    modal = null;
    target = { x: 0, z: -5.4 };
    canvas.focus({ preventScroll: true });
    return;
  }
  if (
    ["missions", "shop", "options", "bridge", "house", "chest"].includes(name)
  )
    dialog(name);
}
function dispose() {
  cancelAnimationFrame(frame);
  abort?.abort();
  observer?.disconnect();
  keys.clear();
  target = null;
  modal = null;
  document.getElementById("forestDialog")?.close();
  document.body.classList.remove("forest-view");
  mixers.forEach((m) => m.stopAllAction());
  mixers = [];
  actions = {};
  wind = [];
  canopies.forEach((c) => c.object.material.dispose());
  canopies = [];
  staticGroups.forEach((o) => {
    o.geometry.dispose();
    o.material.dispose();
  });
  staticGroups = [];
  composer?.dispose();
  renderer?.dispose();
  renderer?.forceContextLoss();
  renderer = null;
  composer = null;
  scene?.clear();
}
function close() {
  if (renderer) save();
  dispose();
}
async function open(options) {
  const openStarted = performance.now();
  if (renderer) await save();
  dispose();
  host = options;
  data = await host.api("/api/forest");
  quality = preference("quality", "auto");
  still =
    preference("still", "false") === "true" ||
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  dirty = false;
  paused = false;
  last = 0;
  clock = 0;
  adaptiveLow = false;
  clip = "Idle";
  pipoClip = "Hover";
  pipoActions = {};
  stats = { frames: 0, times: [], loads: [] };
  layout();
  try {
    renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
  } catch {
    dispose();
    return false;
  }
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  scene = new T.Scene();
  scene.background = new T.Color("#608580");
  scene.fog = new T.FogExp2("#6e9188", 0.014);
  camera = new T.PerspectiveCamera(44, 1, 0.1, 120);
  scene.add(new T.HemisphereLight("#fff0cc", "#365943", 1.7));
  const sun = new T.DirectionalLight("#ffe8be", 2.7);
  sun.position.set(-12, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -19,
    right: 19,
    top: 19,
    bottom: -19,
    near: 1,
    far: 65,
  });
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.0002;
  sun.shadow.radius = 3;
  scene.add(sun);
  sunLight = sun;
  const rim = new T.DirectionalLight("#badbd2", 0.7);
  rim.position.set(10, 8, -13);
  scene.add(rim);
  const started = performance.now();
  const loaded = await assets();
  stats.loads.push(performance.now() - started);
  for (const asset of loaded) {
    const root = cloneRig(asset.scene);
    const materialCopies = new Map();
    root.traverse((o) => {
      if (o.isMesh) {
        const source = o.material;
        if (!materialCopies.has(source.uuid))
          materialCopies.set(source.uuid, source.clone());
        o.material = materialCopies.get(source.uuid);
      }
    });
    prepare(root);
    scene.add(root);
    if (asset.name === "forest") {
      root.updateMatrixWorld(true);
      const occluders = [];
      root.traverse((o) => {
        if (o.name.startsWith("Forest_depth_oak")) {
          const p = o.getWorldPosition(new T.Vector3());
          if (p.z > 10 && Math.abs(p.x) < 12) occluders.push(o);
        }
      });
      occluders.forEach((o) => o.removeFromParent());
      terrain = root.getObjectByName("Terrain");
      batch(root);
    }
    if (asset.name === "bridge") {
      bridge = root;
      root.traverse((o) => {
        if (o.isMesh) o.userData.owner = "bridge";
      });
      batch(root);
    }
    if (asset.name === "treehouse") {
      house = root;
      root.traverse((o) => {
        if (o.isMesh) {
          o.userData.owner = "house";
          o.userData.permanent = /Ancient|House_roots|Treehouse_crown/.test(
            o.name,
          );
        }
      });
      batch(root);
    }
    if (asset.name === "davi") {
      player = new T.Group();
      scene.add(player);
      player.add(root);
      const mixer = new T.AnimationMixer(root);
      mixers.push(mixer);
      for (const anim of asset.animations)
        actions[anim.name] = mixer.clipAction(anim);
      if (actions.Walk) actions.Walk.timeScale = 1.8;
      actions.Idle?.play();
    }
    if (asset.name === "pipo") {
      pipo = new T.Group();
      scene.add(pipo);
      pipo.add(root);
      const mixer = new T.AnimationMixer(root);
      mixers.push(mixer);
      for (const anim of asset.animations)
        pipoActions[anim.name] = mixer.clipAction(anim);
      if (pipoActions.Walk) pipoActions.Walk.timeScale = 3.2;
      pipoActions.Hover?.play();
    }
  }
  player.position.set(
    data.position.x,
    floor(data.position.x, data.position.z),
    data.position.z,
  );
  pipo.position.copy(player.position).add(new T.Vector3(-0.8, 0.2, 0.7));
  look.copy(player.position).add(new T.Vector3(0, 0.9, 0));
  syncOwned();
  createWater();
  cascade();
  motes();
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  ao = new SSAOPass(scene, camera, 1, 1);
  ao.kernelRadius = 0.35;
  ao.minDistance = 0.004;
  ao.maxDistance = 0.09;
  composer.addPass(ao);
  bloom = new UnrealBloomPass(new T.Vector2(1, 1), 0.12, 0.45, 1.2);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  setQuality();
  bind();
  updateCamera();
  composer.render();
  stats.readyMs = performance.now() - openStarted;
  document.getElementById("forestLoading").remove();
  canvas.dataset.ready = "true";
  frame = requestAnimationFrame(tick);
  return true;
}
window.DaviForest = {
  open,
  close,
  action,
  diagnostics() {
    let pipoScarfVisible = false;
    pipo?.traverse((o) => { if (o.isMesh && /^Buddy_scarf/.test(o.name) && o.visible) pipoScarfVisible = true; });
    const gl = renderer?.getContext(),
      ext = gl?.getExtension("WEBGL_debug_renderer_info");
    return {
      renderer: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl?.getParameter(gl.RENDERER),
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null,
      frames: stats.frames,
      frameMs: stats.times.slice(),
      loadMs: stats.loads,
      readyMs: stats.readyMs,
      position: player?.position.toArray(),
      pipoPosition: pipo?.position.toArray(),
      pipoScarfVisible,
      camera: camera?.position.toArray(),
      characterSize: player
        ? new T.Box3().setFromObject(player).getSize(new T.Vector3()).toArray()
        : null,
      quality,
      low,
      adaptiveLow,
      triangles: renderer?.info.render.triangles,
      calls: renderer?.info.render.calls,
      animations: Object.keys(actions),
      pipoAnimations: Object.keys(pipoActions),
      webgl: !!renderer && !gl?.isContextLost(),
      paused,
    };
  },
};
export { open, close, action };
