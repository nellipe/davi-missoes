/* Forest art slice: authored Blender GLBs, local Three.js, existing missions/economy. */
import * as T from "/vendor/three/three.module.min.js";
import { GLTFLoader } from "/vendor/three/addons/loaders/GLTFLoader.js";
import { clone as cloneRig } from "/vendor/three/addons/utils/SkeletonUtils.js";
import { mergeGeometries } from "/vendor/three/addons/utils/BufferGeometryUtils.js";
import { walkable as validPosition, terrainHeight, route, advance } from '/assets/forest/navigation.mjs';
let Trail;
let onTrail=false, trailScene=null, currentRegion='';
let buddyHead=null, reactUntil=0;
let leafPending=null;
const headBase=new T.Quaternion();
let generation = 0, savePending = null, path = [], movingNow = false;
let ownedMaterials = new Set(), ownedGeometry = new Set(), ownedTextures = new Set();
const supportCache = new Map();
let playerSupport, pipoSupport;
let features=[], labels=[], selectedPlace=null;
let lastCalendarRefresh=0,calendarPending=false;
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
  assetCache = new Map();
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
let deckProfile = [], deckHitMesh = null, deckBoards = [];
// The same continuous tread supports the feet and picks taps between planks.
function prepareDeck(root) {
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (!o.isMesh || !o.name.startsWith('Worn_bridge_board')) return;
    const bounds = new T.Box3().setFromObject(o);
    const z = bounds.getCenter(new T.Vector3()).z;
    deckProfile.push({z, y:bounds.max.y});
    deckBoards.push(o);
  });
  deckProfile.sort((a,b) => a.z-b.z);
  for (const side of [-1,1]) {
    const z = (side < 0 ? deckProfile[0] : deckProfile.at(-1)).z + side*.5;
    const end = {z,y:terrainHeight(data.terrain,0,z)};
    if (side < 0) deckProfile.unshift(end);
    else deckProfile.push(end);
  }
  const positions = [], indices = [];
  for (const [i,{z,y}] of deckProfile.entries()) {
    positions.push(-1.12,y,z,1.12,y,z);
    if (i) { const a=2*i-2; indices.push(a,a+2,a+1,a+1,a+2,a+3); }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);
  const material = new T.MeshBasicMaterial();
  ownedGeometry.add(geometry);ownedMaterials.add(material);
  deckHitMesh = new T.Mesh(geometry,material);
}
function walkable(x, z) {
  return onTrail ? Trail.walkable(x,z) : validPosition(x, z, data.economy.inventory, data.obstacles);
}
function floor(x, z) {
  if(onTrail)return Trail.floor(x,z);
  const land = terrainHeight(data.terrain,x,z);
  if (owned('bridge') && Math.abs(x)<=1.12 && z>=deckProfile[0].z && z<=deckProfile.at(-1).z) {
    const i = deckProfile.findIndex((p,i) => i>0 && z<=p.z);
    const a=deckProfile[i-1],b=deckProfile[i];
    return Math.max(land,T.MathUtils.lerp(a.y,b.y,(z-a.z)/(b.z-a.z)))+.012;
  }
  return land+.012;
}
function destination(x,z) {
  keys.clear();
  selectedPlace=null;
  path = route({x:player.position.x,z:player.position.z},{x,z},walkable,onTrail?[13,17]:undefined);
  target = path.shift() || null;
  if(!target && !onTrail) message('Pipo: Vamos pelo caminho. Talvez seja preciso construir a ponte.');
}
// Sample the actual skinned asset once at load, not its bounding box on every frame.
// This compensates for the raised stance foot in the existing walk rig.
function supportTable(name, root, mixer, list) {
  if(supportCache.has(name)) return supportCache.get(name);
  const table={};
  for(const [clipName,action] of Object.entries(list)) {
    mixer.stopAllAction();action.reset().play();table[clipName]=[];
    for(let i=0;i<=24;i++) {
      action.time=action.getClip().duration*i/24;mixer.update(0);root.updateMatrixWorld(true);
      table[clipName].push(new T.Box3().setFromObject(root,true).min.y);
    }
  }
  mixer.stopAllAction();supportCache.set(name,table);return table;
}
function supportHeight(table, list) {
  let height=0,weight=0;
  for(const [name,action] of Object.entries(list)) {
    const samples=table?.[name],w=action.isRunning()?action.getEffectiveWeight():0;
    if(!samples||!w)continue;
    const phase=(action.time/action.getClip().duration%1)*24,i=Math.floor(phase);
    height+=(samples[i]+(samples[i+1]-samples[i])*(phase-i))*w;weight+=w;
  }
  return weight?height/weight:0;
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
  const loader=new GLTFLoader();
  const names=onTrail?['davi','pipo','bosque']:['forest','bridge','treehouse','davi','pipo','activity'];
  return Promise.all(names.map(name=>{
    if(!assetCache.has(name))assetCache.set(name,loader.loadAsync('/assets/forest/'+name+'.glb')
      .then(asset=>({name,...asset})).catch(error=>{assetCache.delete(name);throw error;}));
    return assetCache.get(name);
  }));
}
function prepare(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      // dispose() frees each renderer's buffers/listeners; the cached GLB keeps its CPU data.
      ownedGeometry.add(o.geometry);
      o.castShadow = true;
      o.receiveShadow = true;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const mat of list) {
        for (const value of Object.values(mat)) {
          if (value?.isTexture) ownedTextures.add(value);
        }
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
  const repeated=new Map();
  root.traverse(o=>{
    if(!o.isMesh||o.isSkinnedMesh||o.name==='Terrain'||/Oak_foliage|Treehouse_crown/.test(o.name))return;
    const key=[o.geometry.uuid,o.material.uuid,!!o.userData.detail,o.userData.owner||'',!!o.userData.permanent].join(':');
    const list=repeated.get(key)||[];list.push(o);repeated.set(key,list);
  });
  for(const list of repeated.values())if(list.length>=3) {
    const first=list[0],mat=first.material.clone(),mesh=new T.InstancedMesh(first.geometry,mat,list.length);
    list.forEach((o,i)=>mesh.setMatrixAt(i,o.matrixWorld));mesh.instanceMatrix.needsUpdate=true;
    mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.userData={...first.userData,sharedGeometry:true,detail:!!first.userData.detail||/Grass/.test(first.name)};
    mesh.name=first.name+' instanced';scene.add(mesh);staticGroups.push(mesh);list.forEach(o=>o.removeFromParent());
  }
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
      (o.userData.owner || '') +
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
      `varying vec2 vUv;varying vec3 vPos;uniform float time;void main(){float w=sin(vPos.z*17.+sin(vPos.x*.7-time*.35)*.7+sin(vPos.x*2.1+time)*.25);float glint=pow(max(0.,w),24.);float bank=pow(abs(vUv.y*2.-1.),12.);vec3 col=mix(vec3(.035,.20,.24),vec3(.11,.40,.40),vUv.y*.5+.35);col+=glint*.018+sin(vPos.x*.35+vPos.z*2.-time*.18)*.012;col*=1.-bank*.22;gl_FragColor=vec4(col,.92);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(
        ";#include",
        ";\n#include",
      ),
  });
  water = new T.Mesh(geometry, mat);
  ownedGeometry.add(geometry);ownedMaterials.add(mat);
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
  ownedGeometry.add(geo);ownedMaterials.add(mat);
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
  ownedTextures.add(tex);ownedGeometry.add(g);
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
  ownedMaterials.add(m);
  scene.add(particles);
}
function layout() {
  const now = '<button class="f-button forest-now" type="button" data-action="child-now">Agora</button>';
  const options = button("☷","options",'aria-label="Opções do mundo"');
  const tools = now + button("✦ <strong>"+data.economy.stars+"</strong>","shop",'aria-label="Oficina, '+data.economy.stars+' estrelas"',"forest-wallet")
    +button("▣ Minhas missões","missions")+options;
  const header = onTrail ? '' : `<header class="forest-title"><div><h1>Floresta Encantada</h1></div><div class="forest-tools">${tools}</div></header>`;
  const chapter = onTrail
    ? `<header class="trail-hud"><div><small>Floresta Encantada</small><h1 id="forestRegion">Soleira da Roda Baixa</h1></div><div class="forest-tools">${now}${options}</div></header>`
    : '<div class="forest-chapter">Bosque do Riacho</div>';
  const cameraTools = button("↶","rotate",'data-turn="-1" aria-label="Girar câmera à esquerda"')
    +button("⌖","camera",'aria-label="Centralizar câmera"')+button("↷","rotate",'data-turn="1" aria-label="Girar câmera à direita"');
  const directions = [["up","↑","frente"],["left","←","esquerda"],["down","↓","trás"],["right","→","direita"]]
    .map(([dir,icon,label])=>`<button data-forest-dir="${dir}" aria-label="Andar para ${label}">${icon}</button>`).join('');
  const speech = '<p id="forestMessage" role="status">'+(onTrail?'Pipo observa o barquinho passar.':'Pipo: O riacho guarda um caminho novo. Vamos descobrir juntos?')+'</p>';
  host.layout(`<section class="forest-shell ${onTrail?'trail-shell':''}">${header}
    <div class="forest-stage" id="forestStage">
      <canvas id="forestCanvas" tabindex="0" aria-label="Floresta Encantada. Ande com setas ou WASD; E para interagir." aria-describedby="forestInstructions"></canvas>
      <div id="forestLabels" class="forest-labels"></div>${chapter}
      <div class="forest-camera">${cameraTools}</div>
      ${onTrail?speech:''}
      <div class="forest-dpad" role="group" aria-label="Andar">${directions}</div>
      ${onTrail?button("Perguntar a Pipo","hint","","forest-route"):button("⌘ Caminhos","paths",'aria-label="Lugares do bosque"',"forest-route")}
      <button id="forestInteract" class="forest-interact" data-action="forest-nearby">Explorar · E</button>
      <div id="forestLoading" class="forest-loading">Abrindo o caminho da floresta…</div>
    </div>
    <div class="forest-pipo">${onTrail?'':speech}
      ${onTrail?button("Voltar ao bosque do riacho","leave-trail"):button("Seguir os barquinhos","enter-trail")}
      ${button("Ver agenda","calendar")}
    </div><p id="forestInstructions" class="forest-instructions">Toque no caminho · setas ou WASD para andar · E para explorar</p>
    </section><dialog id="forestDialog" class="forest-dialog" aria-labelledby="forestDialogTitle"><div id="forestDialogBody"></div></dialog>`);
  document.body.classList.add("forest-view");
  stage=document.getElementById("forestStage");
  canvas=document.getElementById("forestCanvas");
}
function createFeatures() {
  features=[
    {id:'bridge',x:0,z:.9,title:'Ponte do riacho',icon:'⌁'},
    {id:'house',x:3.5,z:-6.1,title:'Casa na árvore',icon:'⌂'},
    {id:'chest',x:-4,z:-4,title:'Baú de descobertas',icon:'✦'},
    {id:'missions',x:-2.1,z:1.7,title:'Diário de missões',icon:'▣'},
    {id:'calendar',x:-4.2,z:7.2,title:'Calendário',icon:'▦'},
    {id:'shop',x:-5.7,z:3.6,title:'Oficina do Pipo',icon:'⚒'},
    {id:'wardrobe',x:5.2,z:6.8,title:'Meu personagem',icon:'♧'},
    {id:'portal',x:8.3,z:1.5,title:'Portal dos jogos',icon:'✧'}
  ];
  const slots=[[-2.7,4.8],[3,3.4],[-1.8,9],[2.7,9],[-7.2,7.3],[8.2,6.5]].filter(([x,z])=>validPosition(x,z,[],data.obstacles));
  // Additional activities extend along valid trail edges, never disappear into a menu.
  for(let z=2;z<=9;z+=1.5)for(let x=-11;x<=11;x+=2) if(validPosition(x,z,[],data.obstacles)&&features.every(f=>Math.hypot(x-f.x,z-f.z)>1.6)&&slots.every(([a,b])=>Math.hypot(x-a,z-b)>1.3))slots.push([x,z]);
  host.missions.forEach((activity,i)=>{
    const [x,z]=slots[i%slots.length];features.push({id:'activity-'+activity.id,x,z,title:activity.title,icon:activity.icon||'⚑',activity});
  });
  const box=document.getElementById('forestLabels');
  box.innerHTML=features.map(f=>`<button type="button" class="forest-label" data-action="forest-travel" data-id="${esc(f.id)}" aria-label="Caminhar até ${esc(f.title)}"><span aria-hidden="true">${esc(f.icon)}</span><span class="f-label-copy">${esc(f.activity?f.activity.time:f.title)}</span></button>`).join('');
  labels=features.map((f,i)=>({feature:f,element:box.children[i]}));
}
function updateLabels() {
  const width=stage.clientWidth,height=stage.clientHeight;
  const visible=features.map(f=>({f,d:Math.hypot(player.position.x-f.x,player.position.z-f.z)})).sort((a,b)=>a.d-b.d).slice(0,innerWidth<700?3:5).map(o=>o.f.id);
  const placed=[];
  for(const {feature:f,element} of labels) {
    const p=new T.Vector3(f.x,floor(f.x,f.z)+1.2,f.z).project(camera);
    const show=visible.includes(f.id)&&p.z>-1&&p.z<1&&Math.abs(p.x)<.92&&p.y<.8&&p.y>-.65;
    element.hidden=!show;
    element.dataset.state=f.activity?.window?.state||'';
    const stateText={open:'Disponível',upcoming:'Mais tarde',expired:'Encerrada'}[f.activity?.window?.state];
    element.title=f.title+(stateText?' · '+stateText:'');
    if(f.activity)element.querySelector('.f-label-copy').textContent=f.activity.time+' · '+(stateText||'Atividade');
    if(show){
      const w=Math.min(160,45+(f.activity?f.activity.time:f.title).length*6),x=(p.x*.5+.5)*width;
      let y=(-p.y*.5+.5)*height;
      for(let attempt=0;attempt<4;attempt++){if(!placed.some(r=>Math.abs(r.x-x)<(r.w+w)/2+6&&Math.abs(r.y-y)<38))break;y-=38;}
      if(y<95||y>height-145){element.hidden=true;continue;}
      placed.push({x,y,w});element.style.left=`${(p.x*.5+.5)*width}px`;element.style.top=`${y}px`;}
  }
}
function nearest() {
  if (selectedPlace) {
    const d=Math.hypot(player.position.x-selectedPlace.x,player.position.z-selectedPlace.z);
    if (d<1.8) return {...selectedPlace,d};
  }
  return features.map(f=>({...f,d:Math.hypot(player.position.x-f.x,player.position.z-f.z)})).sort((a,b)=>a.d-b.d)[0];
}
function syncOwned() {
  for (const obj of staticGroups) {
    if (obj.userData.owner)
      obj.visible = owned(obj.userData.owner) || !!obj.userData.permanent;
  }
  if(bridge)bridge.visible = owned("bridge");
  house?.traverse((o) => {
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
  renderer.shadowMap.enabled = !low;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const size = low ? 1024 : 2048;
  if (sunLight && sunLight.shadow.mapSize.x !== size) {
    sunLight.shadow.map?.dispose();
    sunLight.shadow.map = null;
    sunLight.shadow.mapSize.set(size, size);
  }
  for (const g of staticGroups) {
    if (g.userData.detail) g.visible = !low;
  }
  trailScene?.setEconomy(low);
  resize();
}
async function save() {
  if(savePending) { await savePending; if(dirty) return save(); return; }
  if (!dirty || !renderer) return;
  saving = true;
  dirty = false;
  const api=host.api,position={x:player.position.x,z:player.position.z};
  savePending=api(onTrail?'/api/forest/trail/move':'/api/forest/move','PUT',position);
  try {
    await savePending;
  } catch (e) {
    message(e.message);
    dirty = true;
  } finally {
    saving = false;
    savePending = null;
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
    follow = pos.clone().add(new T.Vector3(0, 0.9, 0));
  // A small pullback at the fork keeps both treads in the portrait frame.
  const portraitTrail=onTrail && camera.aspect<.85;
  const forkView=portraitTrail
    ? 1.3*Math.max(0,1-Math.hypot(pos.x-2.6,pos.z-6.6)/3)
    : 0;
  if(portraitTrail){
    follow.x-=.55*Math.max(0,1-Math.hypot(pos.x+9,pos.z-1.4)/2.3);
  }
  const framing=distance+forkView;
  look.lerp(follow, Math.min(1, dt * 5));
  const offset = new T.Vector3(
    Math.sin(angle) * framing,
    framing * (onTrail ? 0.69 : 0.82),
    Math.cos(angle) * framing,
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
      if (Math.hypot(dx, dz) < .00001) {
        target = path.shift() || null;
        dx = target ? target.x-player.position.x : 0;
        dz = target ? target.z-player.position.z : 0;
      }
    }
  }
  const len = Math.hypot(dx, dz);
  let moving = false;
  if (len) {
    const next = advance({x:player.position.x,z:player.position.z},{x:dx,z:dz},1.95*dt,walkable),{x,z}=next;
    if (Math.hypot(x-player.position.x,z-player.position.z)>0.00001) {
      const rot = Math.atan2(x-player.position.x,z-player.position.z);
      player.position.x = x;
      player.position.z = z;
      const delta = Math.atan2(
          Math.sin(rot - player.rotation.y),
          Math.cos(rot - player.rotation.y),
        );
      player.rotation.y += delta * Math.min(1, dt * 12);
      dirty = true;
      moving = true;
    } else { target = null; path=[]; }
  }
  if (movingNow && !moving) save();
  movingNow = moving;
  const oldBuddy={x:pipo.position.x,z:pipo.position.z};
  const desired={x:player.position.x-.7,z:player.position.z+.55};
  const goal=walkable(desired.x,desired.z)?desired:{x:player.position.x,z:player.position.z};
  const buddy=advance(oldBuddy,{x:goal.x-oldBuddy.x,z:goal.z-oldBuddy.z},Math.hypot(goal.x-oldBuddy.x,goal.z-oldBuddy.z)>.18?2.3*dt:0,walkable);
  pipo.position.x=buddy.x;pipo.position.z=buddy.z;
  const buddyMoving=Math.hypot(buddy.x-oldBuddy.x,buddy.z-oldBuddy.z)>.00001;
  const buddyClip = buddyMoving ? "Walk" : "Hover";
  if (buddyClip !== pipoClip) {
    pipoActions[pipoClip]?.fadeOut(0.2);
    pipoActions[buddyClip]?.reset().fadeIn(0.2).play();
    pipoClip = buddyClip;
  }
  animateClip(moving ? "Walk" : waving > clock ? "Wave" : "Idle");
  if(buddyHead)buddyHead.quaternion.copy(headBase);
  mixers.forEach((m) => m.update(still && !moving && !buddyMoving ? 0 : dt));
  if(buddyHead){
    headBase.copy(buddyHead.quaternion);
    const remaining=reactUntil-clock;
    if(remaining>0&&!still)buddyHead.rotateZ(.26*Math.sin(Math.PI*remaining/1.5));
  }
  player.position.y = floor(player.position.x, player.position.z)-supportHeight(playerSupport,actions);
  pipo.position.y = floor(pipo.position.x, pipo.position.z)-supportHeight(pipoSupport,pipoActions);
  if(buddyMoving){const rot=Math.atan2(buddy.x-oldBuddy.x,buddy.z-oldBuddy.z);pipo.quaternion.slerp(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),rot),Math.min(1,dt*7));}
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
  if(water)water.material.uniforms.time.value = still ? 0 : clock;
  if (particles && !still) particles.rotation.y = Math.sin(clock * 0.1) * 0.035;
  updateCamera(dt);
  if(onTrail){
    const {x,z}=player.position, region=Trail.region(x,z);
    if(region!==currentRegion){
      currentRegion=region;reactUntil=clock+1.5;
      document.getElementById('forestRegion').textContent=region;
      message(region.startsWith('Garganta')?'Pipo para para olhar a espuma.':region.startsWith('Bosque')?'':'Pipo observa o barquinho passar.');
    }
    const shelter=trailScene.shelter;
    const gap=Math.hypot(x+9,z-1.4);
    shelter.group.visible=gap<10;
    if(shelter.group.visible && shelter.tick(clock,still,gap<2.3)) reactUntil=clock+1.5;
    if(gap<1.7 && !moving && !target){
      const sight=shelter.group.position;
      const lookAtShelter=(character)=>{
        const turn=Math.atan2(sight.x-character.position.x,sight.z-character.position.z)-character.rotation.y;
        character.rotation.y+=Math.atan2(Math.sin(turn),Math.cos(turn))*(still?1:Math.min(1,dt*6));
      };
      lookAtShelter(player);
      if(!buddyMoving) lookAtShelter(pipo);
    }
    trailScene.tick(clock,still,camera.position,player.position);
  }else updateLabels();
  renderer.info.reset();
  renderer.render(scene,camera);
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
  if(host.date && now-lastCalendarRefresh>60000&&!calendarPending) {
    lastCalendarRefresh=now;calendarPending=true;const token=generation;
    host.api(`/api/calendar?start=${host.date}&end=${host.date}`).then(result=>{
      if(token!==generation)return;
      const activities=new Map(result.events.map(e=>[e.id,e]));
      for(const f of features)if(f.activity&&activities.has(f.activity.id))f.activity=activities.get(f.activity.id);
    }).catch(e=>message(e.message)).finally(()=>{calendarPending=false;});
  }
  const near = nearest(),
    b = document.getElementById("forestInteract");
  if (b) {
    b.disabled = near.d > 1.8 || (near.id==='leaf' && !!leafPending);
    b.textContent =
      near.d < 1.8
        ? onTrail?near.title:`${near.icon} ${near.title} · E`
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
      target = null;path=[];
      keys.add(dirs[e.key]);
      selectedPlace=null;
    }
    if (e.key.toLowerCase() === "e" && !e.repeat) {
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
    target=null;path=[];
    save();
  });
  on(document, "visibilitychange", () => {
    keys.clear();
    target=null;path=[];last=0;
    save();
  });
  document.querySelectorAll("[data-forest-dir]").forEach((b) => {
    on(b, "pointerdown", (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      target = null;path=[];
      keys.add(b.dataset.forestDir);
      selectedPlace=null;
    });
    on(b, "pointerup", () => {
      keys.clear();
      save();
    });
    on(b, "pointercancel", () => {
      keys.clear();
      save();
    });
    on(b, "lostpointercapture", () => { keys.clear(); });
    on(b, "keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        selectedPlace=null;target=null;path=[];keys.add(b.dataset.forestDir);
      }
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
    if(rect.width<=0||rect.height<=0)return;
    camera.updateMatrixWorld(true);terrain.updateWorldMatrix(true,false);
    ray.setFromCamera(p, camera);
    const surfaces = deckHitMesh && owned('bridge') ? [terrain,deckHitMesh] : [terrain];
    const hit = ray.intersectObjects(surfaces, false)[0];
    if (onTrail) {
      const near=nearest();
      if(near.id==='leaf' && near.d<1.8){
        const leafHit=trailScene.shelter.pickLeaf(ray,hit);
        if(leafHit && !trailScene.blocksTap(ray,leafHit)){
          host.run(() => action('forest-nearby',{}));
          return;
        }
      }
    }
    if (hit && walkable(hit.point.x, hit.point.z) && !(onTrail&&trailScene.blocksTap(ray,hit)))
      destination(hit.point.x,hit.point.z);
    else {
      target=null;path=[];
      message(onTrail?"O chão firme acompanha a trilha.":"Pipo: Siga o caminho. A ponte nos leva à outra margem.");
    }
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
  if(modal==='paths') {
    title='Caminhos do bosque';body='<p>Escolha um lugar. Vamos caminhar até ele; ao chegar, toque em Explorar.</p><div class="f-missions">'+features.map(f=>button(esc(f.icon)+' '+esc(f.title)+(f.activity?' · '+esc(f.activity.time):''),'travel',`data-id="${esc(f.id)}"`)).join('')+'</div>';
  } else if (modal?.startsWith('activity-')) {
    const e=features.find(f=>f.id===modal).activity;
    title=e.title;body=`<p>${esc(e.time)} · ${e.done?'Concluída':'Pendente'}</p><p>${e.window?esc(windowLabel(e.window)):''}</p><p>${e.has_mission?'Aprender, Fazer e Lembrar continuam disponíveis. A confirmação real respeita o horário do servidor.':'Esta atividade não tem roteiro e continua disponível na agenda.'}</p>${e.has_mission?button('Entrar na missão','mission',`data-id="${e.id}" data-date="${e.date}"`):button('Ver atividade na agenda','calendar')}`;
  } else if (modal === 'wardrobe') {
    title='Seu jeito de explorar';
    body=`<p>Cores e acessórios ficam guardados para os outros aparelhos.</p><div class="f-options">${button('Menta','color','data-color="mint"')}${button('Sol','color','data-color="sun"')}${button('Azul','color','data-color="sky"')}</div><div class="f-shop">${data.economy.catalog.filter(i=>i.kind!=='building').map(i=>`<article><h3>${esc(i.name)}</h3><p>${i.owned?'Guardado na sua mochila':i.price+' estrelas'}</p>${i.owned?button(data.economy.avatar[i.id]?'Tirar':'Vestir','equip',`data-id="${i.id}"`):!i.removed&&i.available?button('Comprar','buy',`data-id="${i.id}" ${data.economy.stars<i.price?'disabled':''}`):'<p>Indisponível</p>'}</article>`).join('')}</div>`;
  } else if (modal === "chest") {
    title = "O baú das descobertas";
    body =
      "<p>O Pipo encontrou um lugar para guardar suas conquistas. Suas estrelas e acessórios continuam na oficina.</p>" +
      button("Abrir oficina", "shop");
  } else if (modal === "missions") {
    title = "Seu diário de missões";
    body = `<p>${esc(host.dateLabel)}. Todas as atividades continuam aqui, antes e depois do horário.</p><div class="f-missions">${host.missions.map((e) => `<article><small>${esc(e.time)} · ${e.done ? "Concluída" : "Pendente"}</small><h3>${esc(e.title)}</h3><p>${e.window ? esc(windowLabel(e.window)) : ""}</p>${e.has_mission ? button("Entrar na missão", "mission", `data-id="${e.id}" data-date="${e.date}"`) : button("Ver na agenda · sem roteiro", "calendar")}</article>`).join("") || "<p>Não há atividades nesta data. A agenda mostra todos os outros dias.</p>"}</div>${button("Abrir agenda completa", "calendar")}`;
  } else if (["bridge","house","portal"].includes(modal)) {
    const id = modal,
      i = data.economy.catalog.find((i) => i.id === id);
    title = id === "portal" ? "Portal dos jogos" : id === "bridge" ? "A ponte do riacho" : "Uma casa entre as folhas";
    body = `<p>${id === "bridge" ? "Tábuas de madeira, cordas firmes e um caminho até a outra margem." : (id === "portal" ? "Um arco de descobertas para praticar os jogos das suas missões." : "Um refúgio nas copas para imaginar, descansar e guardar boas ideias.")}</p><p>${i.removed ? "O responsável removeu esta construção. Peça a ele para reativar sem nova cobrança." : i.owned ? (id === "bridge" ? "Sua ponte está pronta! Siga pelo centro e atravesse com o Pipo." : "Seu refúgio está pronto. Que história vamos levar para a vida real?") : `Construir: ${i.price} estrelas · seu saldo: ${data.economy.stars}.`}</p>${!i.removed && !i.owned && i.available ? button("Construir por " + i.price + " ✦", "buy", `data-id="${id}" ${data.economy.stars < i.price ? "disabled" : ""}`, "f-primary") : ""}${i.owned ? button(id === "bridge" ? "Vamos atravessar" : "Abrir meu diário", id === "bridge" ? "cross" : "missions") : ""}`;
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
  data = await host.api(onTrail?"/api/forest/trail":"/api/forest");
  syncOwned();
  if (!walkable(player.position.x, player.position.z)) {
    player.position.set(data.position.x, 0, data.position.z);
  }
  renderDialog();
}
async function action(a, b) {
  const name = a.replace("forest-", "");
  if(name==='enter-trail'||name==='leave-trail'){
    await close();
    store('place',name==='enter-trail'?'trail':'forest');
    if(!await open(host))await host.onFallback();
    return;
  }
  if(name==='hint'){message('Pipo: '+Trail.hint(player.position.x,player.position.z));return;}
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
    await close();
    await host.onFallback();
    return;
  }
  if (name === 'travel') {
    document.getElementById('forestDialog').close();
    modal=null;
    const place=features.find(f=>f.id===b.dataset.id);
    if (!place) return;
    const {x,z}=place;
    const approaches=[[x,z+1.1],[x,z-1.1],[x+1.1,z],[x-1.1,z],[x,z]]
      .filter(([a,b])=>walkable(a,b))
      .sort(([a,b],[c,d])=>Math.hypot(a-player.position.x,b-player.position.z)-Math.hypot(c-player.position.x,d-player.position.z));
    for (const point of approaches) {
      destination(...point);
      if (target) {selectedPlace=place;return;}
    }
    message('Pipo: A ponte abre o caminho até a outra margem.');
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
    angle = onTrail ? 0.18 : 0.55;
    distance = onTrail?8.3:13;
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
    if(onTrail&&near.d<1.8){
      if(near.id==='leaf'){
        if(leafPending)return;
        const token=generation;
        const changed=!data.leaf_up;
        leafPending=host.api('/api/forest/trail/shelter','PUT',{leaf_up:changed});
        try {
          const result=await leafPending;
          if(token===generation){
            data.leaf_up=result.leaf_up;
            trailScene.shelter.set(data.leaf_up,clock);
            reactUntil=clock+1.5;
            message('');
          }
        } finally {
          leafPending=null;
        }
        return;
      }
      reactUntil=clock+1.5;
      message(trailScene.interact(near.id,clock));
      if(near.id==='echo')pipo.rotation.y=Math.atan2(near.x-pipo.position.x,near.z-pipo.position.z);
      return;
    }
    if (near.d < 1.8) { if(near.id==='calendar')await action('forest-calendar',{});else dialog(near.id); }
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
    destination(0,-5.4);
    canvas.focus({ preventScroll: true });
    return;
  }
  if (
    ["paths", "missions", "shop", "wardrobe", "portal", "options", "bridge", "house", "chest"].includes(name)
  )
    dialog(name);
}
function dispose() {
  cancelAnimationFrame(frame);
  frame=0;
  abort?.abort();
  observer?.disconnect();
  keys.clear();
  target = null;
  path=[];
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
    if(!o.userData.sharedGeometry)o.geometry.dispose();
    o.dispose?.();
    o.material.dispose();
  });
  staticGroups = [];
  composer?.dispose();
  const skeletons=new Set();
  scene?.traverse(o=>{if(o.skeleton)skeletons.add(o.skeleton);});
  skeletons.forEach(s=>s.dispose());
  sunLight?.shadow.dispose();
  ownedMaterials.forEach(m=>m.dispose());ownedMaterials.clear();
  ownedGeometry.forEach(g=>g.dispose());ownedGeometry.clear();
  ownedTextures.forEach(t=>t.dispose());ownedTextures.clear();
  trailScene?.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
  trailScene=null;currentRegion='';buddyHead=null;reactUntil=0;
  renderer?.dispose();
  renderer?.forceContextLoss();
  renderer=null;composer=null;
  scene?.clear();
  canvas=null;stage=null;observer=null;abort=null;camera=null;
  bridge=null;house=null;water=null;particles=null;pipoActions={};labels=[];features=[];
  deckProfile=[];deckHitMesh=null;deckBoards=[];selectedPlace=null;
  scene=null;player=null;pipo=null;terrain=null;sunLight=null;
}
async function close() {
  const token=++generation;
  abort?.abort();cancelAnimationFrame(frame);frame=0;
  keys.clear();target=null;path=[];
  if(renderer) await save();
  if(token===generation)dispose();
}
async function open(options) {
  const openStarted = performance.now();
  const token=++generation;
  if (renderer) await save();
  if (leafPending) await leafPending.catch(() => {});
  if(token!==generation)return false;
  dispose();
  host = options;
  onTrail=preference('place','forest')==='trail';
  data = await host.api(onTrail?"/api/forest/trail":"/api/forest");
  if(token!==generation)return false;
  if(onTrail){
    Trail=await import('/assets/forest/trail.mjs');
    if(token!==generation)return false;
    Trail.configure(data.layout);
  }
  quality = preference("quality", "auto");
  still =
    preference("still", "false") === "true" ||
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  dirty = false;
  paused = false;
  last = 0;
  clock = 0;
  lastCalendarRefresh=performance.now();calendarPending=false;
  angle=onTrail ? 0.18 : 0.55;distance=onTrail?8.3:12.5;waving=0;blinkAt=3.2;blinkUntil=0;lastSave=0;movingNow=false;
  adaptiveLow = false;
  clip = "Idle";
  pipoClip = "Hover";
  pipoActions = {};
  stats = { frames: 0, times: [], loads: [] };
  layout();
  try {
    renderer = new T.WebGLRenderer({
      canvas,
      antialias: quality==='high',
      powerPreference: "low-power",
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
  if(onTrail){
    scene.background=new T.Color('#9cbcb6');
    scene.fog=new T.Fog('#9cbcb6',10,28);
  }
  camera = new T.PerspectiveCamera(44, 1, 0.1, 120);
  scene.add(new T.HemisphereLight("#fff0cc", "#365943", onTrail ? 1.65 : 1.7));
  const sun = new T.DirectionalLight("#ffe8be", onTrail ? 2.10 : 2.7);
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
  const [loaded, grain] = await Promise.all([
    assets(),
    onTrail ? new T.TextureLoader().loadAsync('/assets/forest/bosque-solo.png').catch(() => null) : null,
  ]);
  if(token!==generation){grain?.dispose();return false;}
  if(onTrail){
    if(grain){
      grain.wrapS=grain.wrapT=T.RepeatWrapping;
      grain.colorSpace=T.SRGBColorSpace;
      grain.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
      ownedTextures.add(grain);
    }
    trailScene=Trail.build(scene,data.leaf_up,loaded.find(asset=>asset.name==='bosque').scene,grain);
    terrain=trailScene.terrain;
    trailScene.group.traverse(o=>{if(o.isMesh){ownedGeometry.add(o.geometry);ownedMaterials.add(o.material);}});
  }
  stats.loads.push(performance.now() - started);
  for (const asset of loaded) {
    if(asset.name==='activity'||asset.name==='bosque')continue;
    const root = cloneRig(asset.scene);
    const materialCopies = new Map();
    root.traverse((o) => {
      if (o.isMesh) {
        const source = o.material;
        if (!materialCopies.has(source.uuid)) {
          const material=source.clone();ownedMaterials.add(material);materialCopies.set(source.uuid, material);
        }
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
      prepareDeck(root);
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
      playerSupport=supportTable('davi',root,mixer,actions);
      actions.Idle?.reset().play();mixer.update(0);
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
      pipoSupport=supportTable('pipo',root,mixer,pipoActions);
      pipoActions.Hover?.reset().play();mixer.update(0);
      if(onTrail){buddyHead=root.getObjectByName('Head');if(buddyHead)headBase.copy(buddyHead.quaternion);}
    }
  }
  player.position.set(
    data.position.x,
    floor(data.position.x, data.position.z)-supportHeight(playerSupport,actions),
    data.position.z,
  );
  pipo.position.copy(player.position).add(new T.Vector3(-.7,0,.55));
  if(!walkable(pipo.position.x,pipo.position.z))pipo.position.copy(player.position);
  pipo.position.y=floor(pipo.position.x,pipo.position.z)-supportHeight(pipoSupport,pipoActions);
  look.copy(player.position).add(new T.Vector3(0, 0.9, 0));
  syncOwned();
  if(onTrail)features=Trail.places;else createFeatures();
  const marker=loaded.find(a=>a.name==='activity');
  if(marker) {
    const markers=new T.Group(),materials=new Map();scene.add(markers);
    for(const f of features.filter(f=>f.activity)) {
      const root=cloneRig(marker.scene);root.position.set(f.x,floor(f.x,f.z),f.z);
      root.traverse(o=>{if(o.isMesh){if(!materials.has(o.material.uuid)){const mat=o.material.clone();ownedMaterials.add(mat);materials.set(o.material.uuid,mat);}o.material=materials.get(o.material.uuid);}});
      markers.add(root);
    }
    prepare(markers);batch(markers);
  }
  if(!onTrail){createWater();cascade();motes();}
  setQuality();
  bind();
  updateCamera();
  renderer.render(scene,camera);
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
  project(x,z,y=floor(x,z)) {
    const p=new T.Vector3(x,y,z).project(camera),rect=canvas.getBoundingClientRect();
    const visible=Math.abs(p.x)<1&&Math.abs(p.y)<1&&Math.abs(p.z)<1;
    let groundVisible=visible;
    if(onTrail&&visible){
      const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(p.x,p.y),camera);
      const hit=ray.intersectObject(terrain,false)[0];
      groundVisible=!!hit && Math.hypot(hit.point.x-x,hit.point.z-z)<.2 && !trailScene.blocksTap(ray,hit);
    }
    return {x:rect.left+(p.x*.5+.5)*rect.width,y:rect.top+(-p.y*.5+.5)*rect.height,visible,groundVisible};
  },
  diagnostics() {
    let pipoScarfVisible = false;
    pipo?.traverse((o) => { if (o.isMesh && /^Buddy_scarf/.test(o.name) && o.visible) pipoScarfVisible = true; });
    const gl = renderer?.getContext(),
      ext = gl?.getExtension("WEBGL_debug_renderer_info");
    let renderedGroundY=null,renderedBoardY=null;
    if (player && deckBoards.length && owned('bridge')) {
      const ray=new T.Raycaster(new T.Vector3(player.position.x,100,player.position.z),new T.Vector3(0,-1,0));
      renderedBoardY=ray.intersectObjects(deckBoards,false)[0]?.point.y??null;
    }
    if(terrain&&player){terrain.updateWorldMatrix(true,false);renderedGroundY=new T.Raycaster(new T.Vector3(player.position.x,100,player.position.z),new T.Vector3(0,-1,0)).intersectObject(terrain,false)[0]?.point.y;}
    const geometries=new Set(),textures=new Set();let bufferBytes=0,textureBytes=0,instances=0;
    scene?.traverse(o=>{
      if(o.isInstancedMesh){instances+=o.count;bufferBytes+=o.instanceMatrix.array.byteLength;}
      if(o.geometry&&!geometries.has(o.geometry)){geometries.add(o.geometry);for(const a of Object.values(o.geometry.attributes))bufferBytes+=a.array?.byteLength||0;bufferBytes+=o.geometry.index?.array.byteLength||0;}
      for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m)for(const v of Object.values(m))if(v?.isTexture&&!textures.has(v)){textures.add(v);textureBytes+=(v.image?.width||0)*(v.image?.height||0)*4*(v.generateMipmaps?4/3:1);}
    });
    const screen=player?player.position.clone().add(new T.Vector3(0,1,0)).project(camera):null;
    return {
      renderer: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl?.getParameter(gl.RENDERER),
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null,
      place:onTrail?"trail":"forest",region:currentRegion,
      shelter:trailScene?.shelter.diagnostics()??null,
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
      moving: movingNow,
      features: features.map(f=>({id:f.id,x:f.x,z:f.z,title:f.title,window:f.activity?.window?.state,hasMission:f.activity?.has_mission})),
      navigationValid: player ? walkable(player.position.x,player.position.z) : null,
      pipoNavigationValid: pipo ? walkable(pipo.position.x,pipo.position.z) : null,
      frameActive: !!frame,
      geometries: renderer?.info.memory.geometries,
      textures: renderer?.info.memory.textures,
      pixelRatio: renderer?.getPixelRatio(),
      shadows: renderer?.shadowMap.enabled,
      animation: clip,
      animationTime: actions[clip]?.time??null,
      pipoAnimation: pipoClip,
      pipoAnimationTime: pipoActions[pipoClip]?.time??null,
      target: target ? {...target} : null,
      keys: [...keys],
      angle,
      feetY: player ? new T.Box3().setFromObject(player, true).min.y : null,
      surfaceY: player ? floor(player.position.x,player.position.z) : null,
      renderedGroundY,
      renderedBoardY,
      screenPosition:screen?.toArray(),
      geometryBufferBytes:bufferBytes,
      estimatedTextureBytes:Math.round(textureBytes),
      instances,
      jsHeapBytes:performance.memory?.usedJSHeapSize??null,
    };
  },
};
export { open, close, action };
