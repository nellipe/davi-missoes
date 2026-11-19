/* Forest art slice: authored Blender GLBs, local Three.js, existing missions/economy. */
import * as T from "/vendor/three/three.module.min.js";
import { GLTFLoader } from "/vendor/three/addons/loaders/GLTFLoader.js";
import { clone as cloneRig } from "/vendor/three/addons/utils/SkeletonUtils.js";
import { mergeGeometries } from "/vendor/three/addons/utils/BufferGeometryUtils.js";
import { bankHeight as clearingHeight, createNavigation, terrainHeight, route, advance, seamCreek, segmentClear, terrainRim } from '/assets/forest/navigation.mjs';
import { createCompanion } from '/assets/forest/companion.mjs';
import { recanto } from '/assets/forest/recanto.mjs';
import { applyOutfit, colors, drawOutfit, outfitDiagnostics, portrait, worn } from '/assets/forest/wardrobe.mjs';
import { createSight } from '/assets/forest/sight.mjs';
import { createChibiPaint } from '/assets/forest/chibi.mjs';
let Trail;
let navigation, companion;
let newMap, newScene, sceneEndpoint;
let trailScene=null, trailLoading=null, currentRegion='', legacy=null, map2d=null;
const localCamera=new T.Vector3(), localHero=new T.Vector3(), localBuddy=new T.Vector3();
const skySoft=new T.Color('#dff2e7'), skyDefault=new T.Color('#ddf2fa');
const clearingSight=createSight();
const trailX=(x)=>x-data.map.trailOffset;
const beyondSeam=(x)=>!newMap&&x>=data.map.seam;
const regionAt=(x,z)=>newMap?newMap.region(x,z):beyondSeam(x)?Trail.region(trailX(x),z):'Clareira do Riacho';
const worldTitle=()=>newMap?data.layout.title:'Floresta Encantada';
const defaultDistance=()=>newMap?data.layout.camera.distance:8.7;
const nearMill=(x,z)=>Math.hypot(trailX(x),z-13);
const nearRecanto=(x,z)=>Math.hypot(trailX(x)-recanto.action[0],z-recanto.action[1]);
function cameraYaw(x,z) {
  if(map2d)return 0;
  if(newMap)return data.layout.camera.yaw;
  if(!beyondSeam(x))return .55;
  if(nearMill(x,z)<3.6)return .58;
  return .18;
}
let buddyHead=null, reactUntil=0;
let chibi;
let regionBannerUntil=0, messageUntil=0, actionTarget='';
const speechAnchor=new T.Vector3();
let shadows=[], lossTimer;
const contextEvents=[];
function recordContext(type) {
  contextEvents.push({type,at:Date.now()});
  if(contextEvents.length>64)contextEvents.shift();
}
let leafPending=null;
const headBase=new T.Quaternion();
let generation = 0, savePending = null, path = [], movingNow = false;
let ownedMaterials = new Set(), ownedGeometry = new Set(), ownedTextures = new Set();
const supportCache = new Map();
let playerSupport;
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
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let motionChoice='system', systemMotionReduced=false;
let wardrobeBack=false, outfitPending=null;
let refreshBalance;
const shopping = name => ['shop','wardrobe','bridge','portal','house'].includes(name);
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
let legacySight=[], staticGroups = [],
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
  return navigation(x,z);
}
walkable.segmentClear=(a,b)=>navigation.segmentClear(a,b);
function discoveryStep(x,z,u,v) {
  const offset=data.map.trailOffset;
  return segmentClear({x:x+offset,z},{x:u+offset,z:v},walkable);
}
function bankHeight(x,z) {
  return clearingHeight(data.terrain,data.map,x,z);
}
function floor(x, z) {
  if(newMap)return newMap.height(x,z)+.018;
  if(beyondSeam(x))return Trail.floor(trailX(x),z);
  const land = bankHeight(x,z);
  if (deckProfile.length && owned('bridge') && Math.abs(x)<=1.12 && z>=deckProfile[0].z && z<=deckProfile.at(-1).z) {
    const i = deckProfile.findIndex((p,i) => i>0 && z<=p.z);
    const a=deckProfile[i-1],b=deckProfile[i];
    return Math.max(land,T.MathUtils.lerp(a.y,b.y,(z-a.z)/(b.z-a.z)))+.012;
  }
  return land+.012;
}
function groundHit(ray, includeDeck=true) {
  terrain?.updateWorldMatrix(true,false);
  trailScene?.terrain.updateWorldMatrix(true,false);
  const surfaces=[terrain,trailScene?.terrain,includeDeck&&owned('bridge')?deckHitMesh:null].filter(Boolean);
  return ray.intersectObjects(surfaces,false).find(hit=>
    hit.object===deckHitMesh || (hit.object===trailScene?.terrain)===beyondSeam(hit.point.x));
}
function picksLeaf(ray, ground) {
  const near=nearest();
  if(near.id!=='leaf'||near.d>=1.8||!trailScene)return false;
  const leafHit=trailScene.shelter.pickLeaf(ray,ground);
  return !!leafHit&&!trailScene.blocksTap(ray,leafHit);
}
function characterFraming() {
  if(!camera||!player||!pipo)return null;
  const scenery=[];
  scene.traverseVisible(o=>{
    if(!o.isMesh||o===terrain||o===trailScene?.terrain||o.material?.isShaderMaterial||o.material?.opacity<.15)return;
    for(let parent=o;parent;parent=parent.parent)if(parent===player||parent===pipo)return;
    scenery.push(o);
  });
  const ray=new T.Raycaster();
  function sample(actor,heights) {
    return heights.map(height=>{
      const point=actor.position.clone().add(new T.Vector3(0,height,0));
      const projected=point.clone().project(camera);
      ray.set(camera.position,point.clone().sub(camera.position).normalize());
      ray.far=camera.position.distanceTo(point)-.055;
      return {x:projected.x,y:projected.y,clear:!ray.intersectObjects(scenery,false).length};
    });
  }
  return {davi:sample(player,[.74,1.28,1.58]),pipo:sample(pipo,[.32,.65,.87])};
}
function discoveryFraming() {
  if(!camera||!trailScene?.shelter.group.visible)return null;
  function sample(actor, points) {
    const scenery=[];
    scene.traverseVisible(object=>{
      if(!object.isMesh||object.material?.isShaderMaterial||object.material?.opacity<.15)return;
      for(let part=object;part;part=part.parent)if(part===actor)return;
      scenery.push(object);
    });
    const ray=new T.Raycaster();
    return points.map(offset=>{
      const point=actor.localToWorld(new T.Vector3(...offset));
      const projected=point.clone().project(camera);
      ray.set(camera.position,point.clone().sub(camera.position).normalize());
      ray.far=camera.position.distanceTo(point)-.035;
      const hit=ray.intersectObjects(scenery,false)[0];
      let cover=null;
      for(let object=hit?.object;object;object=object.parent){
        if(object===player){cover='Davi'; break;}
        if(object===pipo){cover='Pipo'; break;}
        if(object.name){cover??=object.name;}
      }
      return {x:projected.x,y:projected.y,clear:!hit,cover};
    });
  }
  const {shelter,hedgehog}=trailScene;
  return {
    beetle:sample(shelter.beetle,[[-.10,.29,.43],[.10,.29,.43],[0,.45,.04]]),
    hedgehog:hedgehog.group.visible?sample(hedgehog.head,[[-.14,.09,.33],[.14,.09,.33],[0,.02,.48]]):[],
  };
}
function paintBank() {
  const source=terrain.geometry.getAttribute('color');
  if(source){
    const geometry=terrain.geometry.clone();
    const positions=geometry.getAttribute('position');
    const color=geometry.getAttribute('color');
    const earth=new T.Color('#bca072');
    const point=new T.Vector3();
    terrain.updateWorldMatrix(true,false);
    const inverse=terrain.matrixWorld.clone().invert();
    for(let i=0;i<positions.count;i++){
      point.fromBufferAttribute(positions,i).applyMatrix4(terrain.matrixWorld);
      const edge=Trail.pathGap(point.x,point.z,data.map.connection);
      const mix=1-T.MathUtils.smoothstep(edge+Math.sin(point.x*4.4+point.z*6.1)*.10,-.6,.36);
      if(mix>0)color.setXYZ(i,T.MathUtils.lerp(source.getX(i),earth.r,mix),
        T.MathUtils.lerp(source.getY(i),earth.g,mix),T.MathUtils.lerp(source.getZ(i),earth.b,mix));
      if(terrainRim(point.x,point.z,data.map.bounds) || point.x>data.map.seam-2.6){
        point.y=bankHeight(point.x,point.z);
        const shade=Math.max(terrainRim(point.x,point.z,data.map.bounds),seamCreek(point.x,point.z,data.map.seam));
        color.setXYZ(i,T.MathUtils.lerp(color.getX(i),.16,shade),
          T.MathUtils.lerp(color.getY(i),.26,shade),T.MathUtils.lerp(color.getZ(i),.20,shade));
        point.applyMatrix4(inverse);
        positions.setXYZ(i,point.x,point.y,point.z);
      }
    }
    geometry.computeVertexNormals();
    terrain.geometry=geometry;
    ownedGeometry.add(geometry);
  }
  const geometry=new T.BoxGeometry(1,1,1);
  const plank=new T.MeshStandardMaterial({color:'#765c44'});
  const cloth=new T.MeshStandardMaterial({color:'#6bacc0'});
  ownedGeometry.add(geometry);
  ownedMaterials.add(plank);
  ownedMaterials.add(cloth);
  for(const [x,z] of [[9.3,7.43],[12.65,4.65],[15.7,6.38]]){
    const y=floor(x,z);
    for(const [material,dx,dy,sx,sy,sz] of [[plank,0,.73,.09,1.5,.09],[cloth,.20,1.24,.41,.34,.045]]){
      const mesh=new T.Mesh(geometry,material);
      mesh.position.set(x+dx,y+dy,z);
      mesh.scale.set(sx,sy,sz);
      legacy.add(mesh);
    }
  }
}
function destination(x,z) {
  keys.clear();
  selectedPlace=null;
  path = route({x:player.position.x,z:player.position.z},{x,z},walkable,data.map.bounds);
  target = path.shift() || null;
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
    const samples=table?.[name],w=action.isScheduled()?action.getEffectiveWeight():0;
    if(!samples||!w)continue;
    const phase=(action.time/action.getClip().duration%1)*24,i=Math.floor(phase);
    height+=(samples[i]+(samples[i+1]-samples[i])*(phase-i))*w;weight+=w;
  }
  return weight?height/weight:0;
}
function message(text) {
  const el = document.getElementById("forestMessage");
  if (el) {
    el.textContent = text;
    el.classList.toggle('pipo-speech',text.startsWith('Pipo:'));
    messageUntil=text ? clock+6 : 0;
  }
}
function positionSpeech() {
  const el=document.getElementById('forestMessage');
  if(!el?.textContent)return;
  if(clock>=messageUntil){message('');return;}
  if(map2d || !el.classList.contains('pipo-speech'))return;
  speechAnchor.copy(pipo.position).y+=1.02;
  speechAnchor.project(camera);
  const width=stage.clientWidth,height=stage.clientHeight;
  const margin=el.offsetWidth/2+10;
  const x=T.MathUtils.clamp((speechAnchor.x*.5+.5)*width,margin,width-margin);
  const y=T.MathUtils.clamp((.5-speechAnchor.y*.5)*height, Math.min(height*.58,126+el.offsetHeight), height*.69);
  el.style.setProperty('--speech-x',x+'px');
  el.style.setProperty('--speech-y',y+'px');
}
function showForestReward(reward) {
  if(!(reward?.delta>0))return;
  const {delta}=reward;
  message(`+${delta} ${delta===1?'estrela guardada':'estrelas guardadas'}!`);
  if(still)return;
  document.querySelector('.forest-wallet').classList.add('forest-earned');
  const spark=document.createElement('span');
  spark.setAttribute('aria-hidden','true');
  spark.className='forest-star-spark';
  spark.textContent='★';
  spark.addEventListener('animationend',()=>spark.remove(),{once:true});
  stage.append(spark);
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
function syncMotion() {
  systemMotionReduced=reducedMotion.matches;
  still=motionChoice==='reduced'||(motionChoice==='system'&&systemMotionReduced);
  document.querySelector('.trail-shell')?.classList.toggle('forest-motion-reduced',still);
  if(still)stage?.querySelector('.forest-star-spark')?.remove();
  const status=document.getElementById('forestMotionStatus');
  if(status)status.textContent=still
    ? (motionChoice==='system'?'Movimento reduzido pela preferência do aparelho.':'Movimento reduzido por sua escolha.')
    : (motionChoice==='full'&&systemMotionReduced?'Animações ativadas por sua escolha, mesmo com movimento reduzido no aparelho.':'Animações ativadas.');
  const badge=document.getElementById('forestMotionBadge');
  if(badge){
    badge.hidden=!still&&!(motionChoice==='full'&&systemMotionReduced);
    badge.textContent=still?'Movimento reduzido':'Animações ativadas';
  }
}
async function assets() {
  const common=['davi','pipo','activity'];
  return Promise.all((newMap?common:['forest','bridge','treehouse',...common]).map(asset));
}
function asset(name) {
  if(!assetCache.has(name)){
    const pending=new GLTFLoader().loadAsync('/assets/forest/'+name+'.glb')
      .then(result=>({name,...result})).catch(error=>{
        if(assetCache.get(name)===pending)assetCache.delete(name);
        throw error;
      });
    assetCache.set(name,pending);
  }
  return assetCache.get(name);
}
function releaseForestAssets(){
  for(const name of ['forest','bridge','treehouse','bosque']){
    const pending=assetCache.get(name);
    if(!pending)continue;
    assetCache.delete(name);
    pending.then(({scene})=>{
      const resources=new Set();
      scene.traverse(o=>{
        if(!o.isMesh)return;
        resources.add(o.geometry);
        for(const material of (Array.isArray(o.material)?o.material:[o.material])){
          resources.add(material);
          for(const value of Object.values(material))if(value?.isTexture)resources.add(value);
        }
      });
      for(const item of resources){item.dispose();if(item.isTexture)item.image?.close?.();}
    }).catch(()=>{});
  }
}
function loadTrail(token) {
  if(trailLoading)return trailLoading;
  const started=performance.now();
  trailLoading=asset('bosque').then(library=>{
    if(token!==generation)return;
    trailScene=Trail.build(scene,data.leaf_up,library.scene,chibi);
    trailScene.group.position.x=data.map.trailOffset;
    trailScene.group.traverse(o=>{if(o.isMesh){ownedGeometry.add(o.geometry);ownedMaterials.add(o.material);}});
    trailScene.setEconomy(low);
    stats.trailLoadMs=performance.now()-started;
  });
  return trailLoading;
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
    if(!o.isMesh||o.isSkinnedMesh||o.userData.keepGroup||o.name==='Terrain'||/Oak_foliage|Treehouse_crown/.test(o.name))return;
    const key=[o.geometry.uuid,o.material.uuid,!!o.userData.detail,o.userData.owner||'',!!o.userData.permanent].join(':');
    const list=repeated.get(key)||[];list.push(o);repeated.set(key,list);
  });
  for(const list of repeated.values())if(list.length>=3) {
    const first=list[0],mat=first.material.clone(),mesh=new T.InstancedMesh(first.geometry,mat,list.length);
    list.forEach((o,i)=>mesh.setMatrixAt(i,o.matrixWorld));mesh.instanceMatrix.needsUpdate=true;
    mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.userData={...first.userData,sharedGeometry:true,detail:!!first.userData.detail||/Grass/.test(first.name)};
    mesh.name=first.name+' instanced';legacy.add(mesh);staticGroups.push(mesh);list.forEach(o=>o.removeFromParent());
  }
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.userData.keepGroup || o.name === "Terrain") return;
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
    legacy.add(joined);
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
  legacy.add(water);
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
  legacy.add(new T.Mesh(geo, mat));
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
  legacy.add(particles);
}
function layout() {
  const now = '<button class="f-button forest-now" type="button" data-action="child-now">Agora</button>';
  const worlds='<button class="f-button forest-worlds" type="button" data-action="world-picker">Mundos</button>';
  const options = button("☷","options",'aria-label="Opções do mundo"');
  const title=esc(worldTitle());
  const chapter='<header class="trail-hud"><div class="forest-region"><span aria-hidden="true" class="forest-region-icon">'+esc(newMap?data.layout.icon:'❧')+'</span><div><small>'+title+'</small><h1 id="forestRegion">'+esc(currentRegion)+'</h1><small id="forestMotionBadge" hidden>Movimento reduzido</small></div></div><div class="forest-tools">'+worlds+now+options+'</div></header>';
  const cameraTools=map2d?'':button("↶","rotate",'data-turn="-1" aria-label="Girar câmera à esquerda"')
    +button("⌖","camera",'aria-label="Centralizar câmera"')+button("↷","rotate",'data-turn="1" aria-label="Girar câmera à direita"');
  const directions = [["up","↑","frente"],["left","←","esquerda"],["down","↓","trás"],["right","→","direita"]]
    .map(([dir,icon,label])=>`<button data-forest-dir="${dir}" aria-label="Andar para ${label}">${icon}</button>`).join('');
  host.layout(`<section class="forest-shell trail-shell" data-world="${esc(data.world??'forest')}">
    <div class="forest-stage" id="forestStage">
      ${map2d
        ? `<svg id="worldMap" class="forest-map-2d" tabindex="0" role="group" aria-label="${title} em 2D"></svg>`
        : `<canvas id="forestCanvas" tabindex="0" aria-label="${title}. Ande com setas ou WASD; E para interagir." aria-describedby="forestInstructions"></canvas>`}
      <div id="forestLabels" class="forest-labels"></div>${chapter}
      <p id="forestMessage" role="status"></p>
      <p id="forestArrival" role="status" hidden></p>
      <div class="forest-dpad" role="group" aria-label="Andar">${directions}</div>
      ${button('<span class="forest-hint-prefix">Perguntar a </span>Pipo',"hint",'aria-label="Perguntar a Pipo"',"forest-route")}
      <button id="forestInteract" class="forest-interact" data-action="forest-nearby">Explorar · E</button>
      <div id="forestLoading" class="forest-loading">Carregando ${title}…</div>
    </div>
    ${cameraTools?`<div class="forest-camera" role="group" aria-label="Câmera do mundo">${cameraTools}</div>`:''}
    <div class="forest-pipo">
      ${button("⌘ Caminhos","paths",`aria-label="${newMap?'Lugares do mundo':'Lugares do bosque'}"`)}
      ${map2d?'<button class="f-button" data-action="world-forest">Vista 3D</button>':''}
      ${button("Ver agenda","calendar")}
      ${button('<span aria-hidden="true">★</span> <span id="forestBalance"><strong>'+data.economy.stars+'</strong><span class="sr-only"> estrelas disponíveis</span></span>',"shop",'aria-label="Oficina" aria-describedby="forestBalance"',"forest-wallet")}
    </div><p id="forestInstructions" class="forest-instructions">Toque no chão · setas ou WASD para andar · E para explorar</p>
    </section><dialog id="forestDialog" class="forest-dialog" aria-labelledby="forestDialogTitle"><div id="forestDialogBody"></div></dialog>`);
  document.body.classList.add("forest-view");
  stage=document.getElementById("forestStage");
  canvas=document.getElementById(map2d?"worldMap":"forestCanvas");
}
function createFeatures() {
  features=newMap?[...data.layout.places]:[
    {id:'bridge',x:0,z:.9,title:'Ponte do riacho',icon:'⌁'},
    {id:'house',x:3.5,z:-6.1,title:'Casa na árvore',icon:'⌂'},
    {id:'chest',x:-4,z:-4,title:'Baú de descobertas',icon:'✦'},
    {id:'missions',x:-2.1,z:1.7,title:'Diário de missões',icon:'▣'},
    {id:'calendar',x:-4.2,z:7.2,title:'Calendário',icon:'▦'},
    {id:'shop',x:-5.7,z:3.6,title:'Oficina do Pipo',icon:'⚒'},
    {id:'wardrobe',x:5.2,z:6.8,title:'Meu personagem',icon:'♧'},
    {id:'portal',x:8.3,z:1.5,title:'Portal dos jogos',icon:'✧'}
  ];
  const slots=(newMap?[[11,8.9],[14,9.4],[10,9.5],[15,7.9],[8,9],[13,10.1]]:
    [[-2.7,4.8],[3,3.4],[-1.8,9],[2.7,9],[-7.2,7.3],[8.2,6.5]]).filter(([x,z])=>walkable(x,z));
  // Additional activities extend along valid trail edges, never disappear into a menu.
  for(let z=2;z<=9;z+=1.5)for(let x=-11;x<=11;x+=2) if(walkable(x,z)&&features.every(f=>Math.hypot(x-f.x,z-f.z)>1.6)&&slots.every(([a,b])=>Math.hypot(x-a,z-b)>1.3))slots.push([x,z]);
  host.missions.forEach((activity,i)=>{
    const [x,z]=slots[i%slots.length];features.push({id:'activity-'+activity.id,x,z,title:activity.title,icon:activity.icon||'⚑',activity});
  });
  if(!newMap)features.push(...Trail.places.map(f=>({...f,x:f.x+data.map.trailOffset,icon:f.icon??'❧',discovery:!f.action})));
  const box=document.getElementById('forestLabels');
  const marked=features.filter(f=>!f.discovery);
  box.innerHTML=marked.map(f=>`<button type="button" class="forest-label" data-action="forest-travel" data-id="${esc(f.id)}" aria-label="Caminhar até ${esc(f.title)}"><span aria-hidden="true">${esc(f.icon)}</span><span class="f-label-copy">${esc(f.activity?f.activity.time:f.title)}</span></button>`).join('');
  labels=marked.map((f,i)=>({feature:f,element:box.children[i]}));
}
function updateLabels() {
  const width=stage.clientWidth,height=stage.clientHeight;
  const visible=features.map(f=>({f,d:Math.hypot(player.position.x-f.x,player.position.z-f.z)})).sort((a,b)=>a.d-b.d).slice(0,innerWidth<700?3:5).map(o=>o.f.id);
  const placed=[];
  for(const {feature:f,element} of labels) {
    const p=map2d?map2d.ndc(f.x,f.z):new T.Vector3(f.x,floor(f.x,f.z)+(f.labelHeight??1.2),f.z).project(camera);
    const away=Math.hypot(player.position.x-f.x,player.position.z-f.z)>1.8;
    const show=away&&visible.includes(f.id)&&p.z>-1&&p.z<1&&Math.abs(p.x)<.92&&p.y<.8&&p.y>-.65;
    element.hidden=!show;
    element.dataset.state=f.activity?.window?.state||'';
    const stateText={open:'Disponível',upcoming:'Mais tarde',expired:'Encerrada'}[f.activity?.window?.state];
    element.title=f.title+(stateText?' · '+stateText:'');
    if(f.activity)element.querySelector('.f-label-copy').textContent=f.activity.time+' · '+(stateText||'Atividade');
    if(show){
      const w=Math.min(160,45+(f.activity?f.activity.time:f.title).length*6),x=(p.x*.5+.5)*width;
      let y=(-p.y*.5+.5)*height;
      for(let attempt=0;attempt<4;attempt++){if(!placed.some(r=>Math.abs(r.x-x)<(r.w+w)/2+6&&Math.abs(r.y-y)<38))break;y-=38;}
      if(y<95||y>height-145||(!map2d&&x>width-175&&y<158)){element.hidden=true;continue;}
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
  applyOutfit(player,pipo,data.economy);
  const star = document.querySelector(".forest-wallet strong");
  if (star) star.textContent = data.economy.stars;
}
function createContactShadows() {
  const geometry=new T.CircleGeometry(1,20);
  geometry.rotateX(-Math.PI/2);
  const material=new T.ShaderMaterial({
    transparent:true,depthWrite:false,
    vertexShader:`varying vec2 tex;void main(){tex=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 tex;void main(){float r=length(tex*2.-1.);gl_FragColor=vec4(.14,.20,.18,.25*(1.-smoothstep(.12,1.,r)));}`,
  });
  ownedGeometry.add(geometry);
  ownedMaterials.add(material);
  shadows=[player,pipo].map((actor,i)=>{
    const contact=new T.Mesh(geometry,material);
    contact.scale.set(i ? .32 : .48,1,i ? .25 : .37);
    contact.position.set(actor.position.x,floor(actor.position.x,actor.position.z)+.023,actor.position.z);
    scene.add(contact);
    return contact;
  });
}
function resize() {
  if (!renderer || !stage) return;
  const w = stage.clientWidth,
    h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  chibi.resize(w,h);
  composer?.setSize(w, h);
}
function setQuality() {
  low =
    quality === "low" ||
    (quality === "auto" &&
      (innerWidth < 700 || navigator.hardwareConcurrency <= 4 || adaptiveLow));
  if(!renderer)return;
  renderer.setPixelRatio(low ? Math.max(.65,Math.min(.94,devicePixelRatio*.83)) : Math.min(devicePixelRatio,1.35));
  if(scene.fog)scene.fog.far=low?32:42;
  renderer.shadowMap.enabled = !low;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const size = low ? 768 : 1536;
  if (sunLight && sunLight.shadow.mapSize.x !== size) {
    sunLight.shadow.map?.dispose();
    sunLight.shadow.map = null;
    sunLight.shadow.mapSize.set(size, size);
  }
  for (const g of staticGroups) {
    if (g.userData.detail) g.visible = !low;
  }
  trailScene?.setEconomy(low);
  newScene?.setEconomy(low);
  resize();
}
async function save() {
  if(savePending) { try{await savePending;}catch{return;} if(dirty) return save(); return; }
  if (!dirty || !player) return;
  saving = true;
  dirty = false;
  const api=host.api,position={x:player.position.x,z:player.position.z};
  savePending=api(sceneEndpoint+'/move','PUT',position);
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
    follow = pos.clone().add(new T.Vector3(0, 1.02, 0));
  const buddyWeight=.25/Math.max(1,Math.hypot(pipo.position.x-pos.x,pipo.position.z-pos.z)/1.5);
  follow.x+=(pipo.position.x-pos.x)*buddyWeight;
  follow.z+=(pipo.position.z-pos.z)*buddyWeight;
  // A small pullback at the fork keeps both treads in the portrait frame.
  const portraitTrail=beyondSeam(pos.x) && camera.aspect<.85;
  const x=trailX(pos.x);
  const forkView=portraitTrail
    ? 1.3*Math.max(0,1-Math.hypot(x-2.6,pos.z-6.6)/3)
    : 0;
  const heroScene=currentRegion==='Soleira da Roda Baixa'||currentRegion==='Bosque das Bainhas';
  const log=heroScene?1-T.MathUtils.smoothstep(nearRecanto(pos.x,pos.z),2.2,4.2):0;
  const framing=distance+forkView-(heroScene ? (portraitTrail?.85:2.6) : 0)+log*(portraitTrail?.15:-.35);
  if(heroScene){
    const wheel=Math.max(0,1-nearMill(pos.x,pos.z)/4.0);
    follow.x-=wheel*.95;
    follow.z-=wheel*.93;
    follow.x=T.MathUtils.lerp(follow.x,recanto.focus[0]+data.map.trailOffset,log*.77);
    follow.z=T.MathUtils.lerp(follow.z,recanto.focus[1],log*.77);
    follow.y-=log*.24;
  }
  const aim=follow.clone();
  if(newMap){
    const lead=camera.aspect<.85?.78:1.6;
    aim.x-=Math.sin(angle)*lead;
    aim.z-=Math.cos(angle)*lead;
    aim.y+=.25;
  }
  look.lerp(aim, still?1:Math.min(1, dt * 5));
  const offset = new T.Vector3(
    Math.sin(angle) * framing,
    framing * (newMap?.55:heroScene ? (portraitTrail ? .42 + log*.10 : .39 + log*.24) : .72),
    Math.cos(angle) * framing,
  );
  camera.position.lerp(follow.clone().add(offset), still?1:Math.min(1, dt * 4));
  camera.lookAt(look);
  camera.updateMatrixWorld();
  clearingSight.update(camera.position,player.position,pipo.position);
  for (const c of canopies) {
    const blocked=clearingSight.covers(c.sphere.center,c.sphere.radius,.28);
    const goal = blocked ? 0 : 1;
    c.object.material.opacity = T.MathUtils.lerp(
      c.object.material.opacity,
      goal,
      Math.min(1, dt * 9),
    );
    c.object.visible = c.object.material.opacity > 0.035;
  }
  for(const {object,sphere,passage} of legacySight){
    const atPassage=pos.x>12 && pos.x<19.5 && pos.z>3.3 && pos.z<8.1;
    object.visible=!(passage&&atPassage) && !clearingSight.covers(sphere.center,sphere.radius,.14);
  }
}
function updateForestScenery(dt, near, moving, buddyMoving) {
  const z=player.position.z;
  const heroScene=currentRegion==='Soleira da Roda Baixa'||currentRegion==='Bosque das Bainhas';
  scene.fog.color.lerp(heroScene?skySoft:skyDefault,still?1:Math.min(1,dt*2.3));
  scene.background.copy(scene.fog.color);
  updateCamera(dt);
  // Keep the bank visible while looking back through the passage. Beyond the
  // bend the clearing is outside the ordinary view and its assets stay cached.
  const west=Math.sin(angle)>.68;
  const atPassage=player.position.z>3.3 && player.position.z<8.1;
  const bankLimit=west?(low?23:27):(atPassage?19.5:17.8);
  legacy.visible=player.position.x<bankLimit;
  if(player.position.x>=6 && !trailLoading){
    const token=generation;
    loadTrail(token).catch(error=>{
      if(token===generation)message('A trilha não carregou. Abra a vista 2D nas opções para continuar.');
      console.warn(error.message);
    });
  }
  if(trailScene)trailScene.group.visible=player.position.x>8;
  if(trailScene?.group.visible){
    const gap=nearRecanto(player.position.x,z);
    if(gap<1.7 && !moving && !target){
      for(const character of buddyMoving?[player]:[player,pipo]){
        const dx=(character===pipo?camera.position.x:recanto.focus[0]+data.map.trailOffset)-character.position.x;
        const dz=(character===pipo?camera.position.z:recanto.focus[1])-character.position.z;
        const turn=Math.atan2(dx,dz)-character.rotation.y;
        character.rotation.y+=Math.atan2(Math.sin(turn),Math.cos(turn))*(still?1:Math.min(1,dt*6));
      }
    }
    const greetingPitch=gap<1.7&&!buddyMoving?-.28:0;
    pipo.rotation.x=T.MathUtils.lerp(pipo.rotation.x,greetingPitch,still?1:Math.min(1,dt*6));
    localCamera.copy(camera.position).x-=data.map.trailOffset;
    localHero.copy(player.position).x-=data.map.trailOffset;
    localBuddy.copy(pipo.position).x-=data.map.trailOffset;
    if(trailScene.tick(clock,still,localCamera,localHero,localBuddy,near.d<1.8?near.id:'',moving,dt,discoveryStep))
      reactUntil=clock+1.5;
  }
}
function tick(now) {
  if (!player) return;
  frame = requestAnimationFrame(tick);
  if (paused || document.hidden) {
    last = now;
    return;
  }
  const rawMs = last ? now - last : 0;
  const dt = Math.min(rawMs / 1000, 0.05);
  last = now;
  clock += dt;
  if(systemMotionReduced!==reducedMotion.matches)syncMotion();
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
  const goal=pipoGoal(player.position);
  const nextBuddy=companion.update(oldBuddy,player.position,goal,dt,point=>{
    if(map2d)return map2d.project(point.x,point.z).visible;
    const screen=new T.Vector3(point.x,floor(point.x,point.z)+1,point.z).project(camera);
    return Math.abs(screen.x)<1.05&&Math.abs(screen.y)<1.05&&Math.abs(screen.z)<1;
  });
  const buddy=nextBuddy.position;
  pipo.position.x=buddy.x;pipo.position.z=buddy.z;
  pipo.scale.setScalar(nextBuddy.scale);
  const buddyMoving=!nextBuddy.relocated&&Math.hypot(buddy.x-oldBuddy.x,buddy.z-oldBuddy.z)>.00001;
  const buddyClip = buddyMoving ? "Walk" : "Hover";
  if (buddyClip !== pipoClip) {
    pipoActions[pipoClip]?.fadeOut(0.2);
    pipoActions[buddyClip]?.reset().fadeIn(0.2).play();
    pipoClip = buddyClip;
  }
  animateClip(moving ? "Walk" : !still && waving > clock ? "Wave" : "Idle");
  if(buddyHead)buddyHead.quaternion.copy(headBase);
  if(actions.Idle)actions.Idle.paused=still;
  if(pipoActions.Hover)pipoActions.Hover.paused=still;
  if(pipoActions.Walk)pipoActions.Walk.paused=still;
  mixers.forEach((m) => m.update(dt));
  if(buddyHead){
    headBase.copy(buddyHead.quaternion);
    const remaining=reactUntil-clock;
    if(remaining>0&&!still)buddyHead.rotateZ(.26*Math.sin(Math.PI*remaining/1.5));
  }
  player.position.y = floor(player.position.x, player.position.z)-supportHeight(playerSupport,actions);
  pipo.position.y = pipoHeight();
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
    if (o.isMesh && /^Blink_/.test(o.name)) o.visible = still || !blinkUntil;
  });
  for (const shader of wind)
    shader.uniforms.forestTime.value = still ? 0 : clock;
  if(water)water.material.uniforms.time.value = still ? 0 : clock;
  if (particles && !still) particles.rotation.y = Math.sin(clock * 0.1) * 0.035;
  const z=player.position.z;
  const region=regionAt(player.position.x,z);
  if(region!==currentRegion){
    const arrival=document.getElementById('forestArrival');
    if(currentRegion){
      const article=/^(Bosque|Pátio|Farol|Jardim|Bairro|Vale)/.test(region)?'ao':'à';
      arrival.textContent='Você chegou '+article+' '+region;
      arrival.hidden=false;
      regionBannerUntil=clock+2;
      message('');
    }
    currentRegion=region;
    reactUntil=clock+1.5;
    document.getElementById('forestRegion').textContent=region;
  }
  if(regionBannerUntil && clock>=regionBannerUntil){
    document.getElementById('forestArrival').hidden=true;
    regionBannerUntil=0;
  }
  const near=nearest();
  if(map2d){
    map2d.draw(player.position,pipo.position,data,clock,still,nextBuddy.scale);
  }else{
    if(newScene){
      updateCamera(dt);
      newScene.tick(clock,dt,still,player.position);
    }else{
      updateForestScenery(dt,near,moving,buddyMoving);
    }
    if(!low && Math.abs(sunLight.target.position.x-player.position.x)>5){
      sunLight.target.position.x=player.position.x;
      sunLight.position.x=player.position.x-12;
    }
    for(const [i,contact] of shadows.entries()){
      const foot=i?pipo.position:player.position;
      contact.position.set(foot.x,floor(foot.x,foot.z)+.023,foot.z);
    }
    renderer.info.reset();
    renderer.render(scene,camera);
  }
  updateLabels();
  positionSpeech();
  stats.frames++;
  if (dt > 0) stats.times.push(rawMs);
  if (stats.times.length > 240) stats.times.shift();
  if (
    renderer && quality === "auto" &&
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
  const b = document.getElementById("forestInteract");
  if (b) {
    b.disabled = near.d >= 1.8 || (near.id==='leaf' && !!leafPending);
    const next=near.d<1.8?near.id:'';
    if(next!==actionTarget){
      actionTarget=next;
      const icon=near.id==='wheel'?'⛵':near.id==='leaf'?'❧':near.icon;
      b.innerHTML=next
        ? `<span aria-hidden="true">${esc(icon)}</span>${esc(near.title)}`
        : "Explorar por perto · E";
    }
  }
  for(const direction of document.querySelectorAll('[data-forest-dir]'))
    direction.classList.toggle('pressed',keys.has(direction.dataset.forestDir));
  canvas.dataset.frames = stats.frames;
  canvas.dataset.calls = renderer?.info.render.calls??0;
  canvas.dataset.triangles = renderer?.info.render.triangles??0;
}
function pipoHeight() {
  const reaction=still?0:Math.max(0,reactUntil-clock)/1.5;
  return floor(pipo.position.x,pipo.position.z)+.95
    +(still?0:.072*Math.sin(clock*4.2)+.17*Math.sin(Math.PI*reaction));
}
function pipoGoal({x,z}) {
  const hero={x,z};
  const closeToHero=point=>walkable(point.x,point.z)&&segmentClear(hero,point,walkable);
  if(beyondSeam(x)&&nearRecanto(x,z)<3.45){
    for(const [dx,dz] of [[.80,-.5],[.55,-1.10],[.69,.17],[-.48,-.85],[-.57,.82],[.10,1.0]]){
      const side={x:x+dx,z:z+dz};
      if(closeToHero(side))return side;
    }
  }
  const near=beyondSeam(x)?1-T.MathUtils.smoothstep(nearMill(x,z),2,5):0;
  const desired={x:x+T.MathUtils.lerp(-.78,.84,near),z:z+T.MathUtils.lerp(.48,-.24,near)};
  if(closeToHero(desired))return desired;
  return hero;
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
  on(reducedMotion,'change',syncMotion);
  syncMotion();
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
  let gesture=null;
  on(canvas, "pointerdown", (e) => {
    if (modal || e.button!==0 || gesture) return;
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(e.pointerId);
    gesture={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,turning:false};
  });
  on(canvas,'pointermove',e=>{
    if(map2d || gesture?.id!==e.pointerId)return;
    gesture.turning ||= Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>8;
    if(gesture.turning)angle-=(e.clientX-gesture.lastX)*.008;
    gesture.lastX=e.clientX;
  });
  on(canvas,'lostpointercapture',e=>{if(gesture?.id===e.pointerId)gesture=null;});
  on(canvas, "pointerup", (e) => {
    if(gesture?.id!==e.pointerId)return;
    const {turning}=gesture;
    gesture=null;
    if(turning||modal)return;
    if(map2d){
      const point=map2d.point(e.clientX,e.clientY);
      if(walkable(point.x,point.z))destination(point.x,point.z);
      else {target=null;path=[];}
      return;
    }
    const rect = canvas.getBoundingClientRect(),
      p = new T.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      ray = new T.Raycaster();
    if(rect.width<=0||rect.height<=0)return;
    camera.updateMatrixWorld(true);
    ray.setFromCamera(p,camera);
    const hit=groundHit(ray);
    if(picksLeaf(ray,hit)){
      host.run(() => action('forest-nearby',{}));
      return;
    }
    if(hit && walkable(hit.point.x,hit.point.z)) destination(hit.point.x,hit.point.z);
    else {target=null;path=[];}
  });
  on(canvas, "webglcontextlost", (e) => {
    e.preventDefault();
    paused = true;
    keys.clear();
    target=null;path=[];
    recordContext('webgl-lost');
    clearTimeout(lossTimer);
    lossTimer=setTimeout(()=>{
      recordContext('fallback');
      host.run(()=>action('forest-fallback',{}));
    },5000);
    save();
    message(
      "O mundo pausou neste aparelho. Abra a vista 2D nas opções para continuar.",
    );
  });
  on(canvas, "webglcontextrestored", () => {
    clearTimeout(lossTimer);
    recordContext('webgl-restored');
    paused = false;
    last = 0;
  });
  on(document.getElementById("forestDialog"), "cancel", () => {
    modal = null;
    keys.clear();
    canvas.focus({ preventScroll: true });
  });
  observer = new ResizeObserver(() => {
  if(renderer)setQuality();
    else if(player)map2d?.draw(player.position,pipo.position,data,clock,still);
  });
  observer.observe(stage);
  refreshBalance=host.watchWorldBalance?.(abort.signal,()=>outfitPending?undefined:data.economy.stars,stars=>{
    data.economy.stars=stars;
    document.querySelector('#forestBalance strong').textContent=stars;
    if(shopping(modal)){
      const previous=document.activeElement?.dataset;
      renderDialog();
      if(previous?.action)document.querySelector(`#forestDialog [data-action="${CSS.escape(previous.action)}"]${previous.id?`[data-id="${CSS.escape(previous.id)}"]`:''}`)?.focus({preventScroll:true});
    }
  });
}
function renderDialog() {
  let title = "",
    body = "";
  const place=newMap?data.layout.places.find(p=>p.id===modal):null;
  if(modal==='paths') {
    title=newMap?'Lugares para explorar':'Caminhos do bosque';body='<p>Escolha um lugar. Vamos caminhar até ele. Ao chegar, toque em Explorar.</p><div class="f-missions">'+features.map(f=>button(esc(f.icon)+' '+esc(f.title)+(f.activity?' · '+esc(f.activity.time):''),'travel',`data-id="${esc(f.id)}"`)).join('')+'</div>';
  } else if(place) {
    title=esc(place.title);
    const collected=data.progress.includes(place.id);
    const required=(place.requires??[]).filter(id=>!data.progress.includes(id));
    body=`<p>${esc(collected&&place.success?place.success:place.text)}</p>`;
    if(required.length){
      const missing=required.map(id=>data.layout.places.find(p=>p.id===id).title);
      body+=`<p>Para continuar, visite ${esc(missing.join(', '))}.</p>`;
    }else if(!collected&&place.collect){
      body+=button(esc(place.collect),'collect',`data-id="${esc(place.id)}"`,'f-primary');
    }else if(collected&&!place.success){
      body+='<p role="status">Descoberta guardada ✓</p>';
    }
  } else if (modal?.startsWith('activity-')) {
    const e=features.find(f=>f.id===modal).activity;
    title=e.title;body=`<p>${esc(e.time)} · ${e.done?'Concluída':'Pendente'}</p><p>${e.window?esc(windowLabel(e.window)):''}</p><p>${e.has_mission?'Aprender, Fazer e Lembrar continuam disponíveis. A confirmação real respeita o horário do servidor.':'Esta atividade não tem roteiro e continua disponível na agenda.'}</p>${e.has_mission?button('Entrar na missão','mission',`data-id="${e.id}" data-date="${e.date}"`):button('Ver atividade na agenda','calendar')}`;
  } else if (modal === 'wardrobe') {
    title='Seu jeito de explorar';
    const economy=data.economy;
    const preview3d=renderer&&!paused;
    const preview=preview3d?'<canvas id="forestOutfitPreview" width="336" height="200" role="img" aria-label="Prévia de Davi e Pipo"></canvas>':portrait(economy);
    body=`<div class="f-outfit-preview">${preview}${preview3d?button(wardrobeBack?'Ver de frente':'Ver as costas','outfit-turn') : ''}</div>
      <div class="f-outfit-colors" role="group" aria-label="Cor da roupa">${Object.entries(colors).map(([id,dye])=>
      button(dye.label,'color',`data-color="${id}" aria-pressed="${economy.avatar.color===id}"`)).join('')}</div>
      <div class="f-shop f-outfit-items">${economy.catalog.filter(i=>i.kind!=='building').map(i=>{
        const wearing=worn(economy,i.id);
        return `<article><h3>${esc(i.name)}</h3><p>${wearing?'Em uso':i.owned?'Na mochila':i.removed?'Removido pelo responsável':i.price+' estrelas'}</p>${i.owned?button(wearing?'Tirar':'Vestir','equip',`data-id="${i.id}" aria-label="${wearing?'Tirar':'Vestir'} ${esc(i.name)}"`):!i.removed&&i.available?button('Comprar','buy',`data-id="${i.id}" ${economy.stars<i.price?'disabled':''}`):'<p>Indisponível</p>'}</article>`;
      }).join('')}</div>`;
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
    title = newMap?"Oficina do Pipo":"Oficina do bosque";
    body = `<p>Seu saldo: ${data.economy.stars} estrelas. Construções e acessórios continuam guardados entre os aparelhos.</p><div class="f-shop">${data.economy.catalog.map((i) => `<article><h3>${esc(i.name)}</h3><p>${esc(i.description)}</p><strong>${i.removed ? "Removido pelo responsável" : i.owned ? "Já é seu" : i.price + " ✦"}</strong>${!i.owned && !i.removed && i.available ? button("Guardar", "buy", `data-id="${i.id}" ${data.economy.stars < i.price ? "disabled" : ""}`) : i.owned && i.kind !== "building" ? button(data.economy.avatar[i.id] ? "Tirar" : "Usar", "equip", `data-id="${i.id}"`) : ""}</article>`).join("")}</div>`;
  } else {
    title = "Do seu jeito";
    body = `<label for="forestQuality">Qualidade</label><select id="forestQuality"><option value="auto">Automática</option><option value="low">Econômica</option><option value="high">Detalhada</option></select>
      <label for="forestMotion">Animações do mundo</label>
      <select id="forestMotion" aria-describedby="forestMotionStatus">
        <option value="system">Seguir o aparelho</option>
        <option value="full">Ativar neste navegador</option>
        <option value="reduced">Reduzir neste navegador</option>
      </select><p id="forestMotionStatus" role="status"></p>
      <div class="f-options">${map2d?'':button(newMap?'Vista 2D do mundo':'Vista 2D da floresta',"fallback")}<button type="button" class="f-button" data-action="world-island">Ilha das ideias</button></div>`;
  }
  document.getElementById("forestDialogBody").innerHTML =
    `<div class="f-dialog-top"><span>${newMap?esc(worldTitle()):'O DIÁRIO DO BOSQUE'}</span>${button("Fechar ×", "close")}</div><h2 id="forestDialogTitle">${title}</h2>${body}`;
  const preview=document.getElementById('forestOutfitPreview');
  if(preview)drawOutfit(renderer,preview,player,pipo,wardrobeBack);
  if (modal === "options") {
    const q = document.getElementById("forestQuality");
    q.value = quality;
    q.onchange = () => {
      quality = q.value;
      store("quality", quality);
      setQuality();
    };
    const motion=document.getElementById('forestMotion');
    motion.value=motionChoice;
    syncMotion();
    motion.onchange = () => {
      motionChoice=motion.value;
      store('motion-mode',motionChoice);
      syncMotion();
    };
  }
}
function dialog(name) {
  modal = name;
  if(name==='wardrobe')wardrobeBack=false;
  keys.clear();
  target = null;
  waving = clock + 1.6;
  renderDialog();
  document.getElementById("forestDialog").showModal();
  if(shopping(name))refreshBalance?.();
}
async function refresh() {
  const token=generation;
  const fresh=await host.api(sceneEndpoint);
  if(token!==generation)return false;
  data=fresh;
  newScene?.progress(data.progress);
  navigation=createNavigation(data.map,data.collision,data.economy.inventory);
  syncOwned();
  if (!walkable(player.position.x, player.position.z)) {
    player.position.set(data.position.x, 0, data.position.z);
  }
  if(modal)renderDialog();
  return true;
}
async function action(a, b) {
  const name = a.replace("forest-", "");
  if(name==='hint'){
    message('Pipo: '+(newMap?data.layout.hint:beyondSeam(player.position.x)?Trail.hint(trailX(player.position.x),player.position.z):'Siga a margem junto às bandeirinhas azuis.'));
    return;
  }
  if(name==='collect'&&newMap){
    const token=generation;
    await save();
    if(token!==generation)return;
    const result=await host.api(sceneEndpoint+'/interact','POST',{place:b.dataset.id});
    if(token!==generation)return;
    data.progress=result.progress;
    newScene?.progress(data.progress);
    if(data.layout.places.find(p=>p.id===b.dataset.id)?.requires)DaviGame.sound();
    reactUntil=clock+1.5;
    renderDialog();
    document.querySelector('[data-action=forest-close]')?.focus();
    return;
  }
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
    if(!newMap && !owned('bridge') && !beyondSeam(x) && z<-4)message('Pipo: A ponte abre o caminho até a outra margem.');
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
    angle = cameraYaw(player.position.x,player.position.z);
    distance = defaultDistance();
    return;
  }
  if (name === "close") {
    document.getElementById("forestDialog").close();
    modal = null;
    canvas.focus({ preventScroll: true });
    return;
  }
  if(name==='outfit-turn'){
    wardrobeBack=!wardrobeBack;
    renderDialog();
    document.querySelector('[data-action=forest-outfit-turn]')?.focus({preventScroll:true});
    return;
  }
  if (name === "nearby") {
    const near = nearest();
    if(near.discovery&&near.d<1.8){
      if(near.id==='leaf'){
        if(leafPending)return;
        const token=generation;
        const changed=!data.leaf_up;
        leafPending=host.api('/api/forest/trail/shelter','PUT',{leaf_up:changed});
        try {
          const result=await leafPending;
          if(token===generation){
            data.leaf_up=result.leaf_up;
            trailScene?.shelter.set(data.leaf_up,clock);
            reactUntil=clock+1.5;
          }
        } finally {
          leafPending=null;
        }
        return;
      }
      reactUntil=clock+1.5;
      map2d?.interact(near.id,clock);
      message('Pipo: '+(trailScene?trailScene.interact(near.id,clock):Trail.description(near.id)));
      if(near.id==='echo')pipo.rotation.y=Math.atan2(near.x-pipo.position.x,near.z-pipo.position.z);
      return;
    }
    if (near.d < 1.8) {
      if(near.id==='calendar')await action('forest-calendar',{});
      else {newScene?.greet(near.id,clock);dialog(near.action??near.id);}
    }
    return;
  }
  if (name === "buy") {
    if(outfitPending)return;
    const token=generation;
    const item = data.economy.catalog.find((i) => i.id === b.dataset.id);
    outfitPending=host.api("/api/world/buy", "POST", {
      item_id: item.id,
      price: item.price,
    });
    try{
      await outfitPending;
      if(token!==generation||!await refresh())return;
      waving = clock + 1.8;
      message(newMap?"Pipo: Sua descoberta ficou guardada!":"Pipo: Conseguimos! O bosque ganhou uma nova história.");
    }finally{
      outfitPending=null;
    }
    return;
  }
  if (name === "equip" || name === "color") {
    if(outfitPending)return;
    const token=generation;
    const avatar = { ...data.economy.avatar };
    if (name === "color") avatar.color = b.dataset.color;
    else avatar[b.dataset.id] = avatar[b.dataset.id] ? null : b.dataset.id;
    outfitPending=host.api("/api/world/equip", "PUT", avatar);
    try {
      const economy=await outfitPending;
      if(token!==generation)return;
      data.economy=economy;
      syncOwned();
      if(modal){
        const refocus=b.matches(':focus');
        renderDialog();
        const selector=name==='color'?`[data-color="${b.dataset.color}"]`:`[data-action=forest-equip][data-id="${b.dataset.id}"]`;
        if(refocus)document.querySelector(selector)?.focus({preventScroll:true});
      }
    }finally{
      outfitPending=null;
    }
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
  clearTimeout(lossTimer);
  shadows=[];
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
  legacySight=[];
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
  chibi?.dispose();chibi=null;
  trailScene?.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
  trailScene=null;trailLoading=null;currentRegion='';buddyHead=null;reactUntil=0;
  newScene?.dispose();newScene=null;newMap=null;
  legacy=null;map2d=null;
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
  if(player) await save();
  if(token===generation){dispose();releaseForestAssets();}
}
async function open(options) {
  const openStarted = performance.now();
  const token=++generation;
  if (player) await save();
  if (leafPending) await leafPending.catch(() => {});
  if (outfitPending) await outfitPending.catch(() => {});
  if(token!==generation)return false;
  dispose();
  host = options;
  const alternate=host.worldId && host.worldId!=='forest';
  sceneEndpoint=alternate?`/api/worlds/${host.worldId}`:'/api/forest/map';
  if(alternate)releaseForestAssets();
  const resume=!alternate&&preference('place','forest')==='trail'?'?resume=trail':'';
  data=await host.api(sceneEndpoint+resume);
  if(token!==generation)return false;
  navigation=createNavigation(data.map,data.collision,data.economy.inventory);
  companion=createCompanion(walkable,data.map.bounds);
  if(alternate){
    const {landscape,regionAt}=await import('/assets/worlds/terrain.mjs');
    if(token!==generation)return false;
    const {layout}=data;
    newMap={height:landscape(data).height,region:(x,z)=>regionAt(layout,x,z)};
  }else{
    Trail=await import('/assets/forest/trail.mjs');
    if(token!==generation)return false;
    Trail.configure(data.layout,z=>bankHeight(data.map.seam,z),data.map);
  }
  const mapModule=host.mode==='2d'?await (alternate?import('/assets/worlds/map-2d.mjs'):import('/assets/forest/map-2d.mjs')):null;
  if(token!==generation)return false;
  if(mapModule)map2d=mapModule.createMap();
  quality = preference("quality", "auto");
  // Earlier versions never allowed overriding reduced motion on the device.
  const previousMotion=preference('motion',preference('still','false')==='true'?'reduced':'system');
  const savedMotion=preference('motion-mode',previousMotion==='reduced'?'reduced':'system');
  motionChoice=['system','full','reduced'].includes(savedMotion)?savedMotion:'system';
  syncMotion();
  dirty = false;
  paused = false;
  last = 0;
  clock = 0;
  regionBannerUntil=0;messageUntil=0;actionTarget='';
  lastCalendarRefresh=performance.now();calendarPending=false;
  angle=cameraYaw(data.position.x,data.position.z);
  distance=defaultDistance();waving=0;blinkAt=3.2;blinkUntil=0;lastSave=0;movingNow=false;
  adaptiveLow = false;
  clip = "Idle";
  pipoClip = "Hover";
  pipoActions = {};
  stats = { frames: 0, times: [], loads: [] };
  currentRegion=regionAt(data.position.x,data.position.z);
  layout();
  if(map2d){
    player=new T.Object3D();
    pipo=new T.Object3D();
    player.position.set(data.position.x,0,data.position.z);
    pipo.position.copy(player.position);
    createFeatures();
    map2d.mount(canvas,data,features);
    map2d.draw(player.position,pipo.position,data);
    bind();
    document.getElementById('forestLoading').remove();
    stats.readyMs=performance.now()-openStarted;
    canvas.dataset.ready='true';
    showForestReward(options.reward);
    frame=requestAnimationFrame(tick);
    return true;
  }
  try {
    renderer = new T.WebGLRenderer({
      canvas,
      antialias: quality==='high',
      powerPreference: "low-power",
      preserveDrawingBuffer: false,
    });
  } catch {
    recordContext('webgl-creation');
    dispose();
    return false;
  }
  renderer.localClippingEnabled=true;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  scene = new T.Scene();
  const sky=newMap?data.layout.sky:'#ddf2fa';
  scene.background=new T.Color(sky);
  scene.fog=new T.Fog(sky,alternate?19:16,42);
  chibi=createChibiPaint();
  legacy=new T.Group();
  scene.add(legacy);
  camera = new T.PerspectiveCamera(44, 1, 0.1, 120);
  scene.add(new T.HemisphereLight("#fff9ee", "#c0cee3", 1.58));
  const sun = new T.DirectionalLight("#fff3de", 2.1);
  sun.position.set(-12, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
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
  sun.shadow.intensity = .48;
  scene.add(sun);
  scene.add(sun.target);
  sunLight = sun;
  const rim = new T.DirectionalLight("#e5f7ff", .37);
  rim.position.set(10, 8, -13);
  scene.add(rim);
  const started = performance.now();
  const sceneData=data;
  const environment=alternate?import('/assets/worlds/scene.mjs').then(({loadWorld})=>loadWorld(sceneData)).then(map=>{
    if(token!==generation)map.dispose();
    else newScene=map;
  }):data.position.x>=6?loadTrail(token):null;
  let loaded;
  try{
    [loaded]=await Promise.all([assets(),environment]);
  }catch(error){
    if(token===generation){generation++;dispose();}
    console.warn('Vista 3D indisponível:',error.message);
    return false;
  }
  if(token!==generation)return false;
  if(newScene){
    scene.add(newScene.group);
    terrain=newScene.ground;
    newScene.progress(data.progress);
    newScene.tick(0,0,true,data.position);
  }
  stats.loads.push(performance.now() - started);
  for (const asset of loaded) {
    if(asset.name==='activity')continue;
    const root = cloneRig(asset.scene);
    const materialCopies = new Map();
    if(['davi','pipo'].includes(asset.name)){
      for(const material of chibi.person(root))ownedMaterials.add(material);
    }else root.traverse((o) => {
      if (o.isMesh) {
        const source = o.material;
        if (!materialCopies.has(source.uuid)) {
          const material=source.clone();ownedMaterials.add(material);materialCopies.set(source.uuid, material);
        }
        o.material = materialCopies.get(source.uuid);
      }
    });
    prepare(root);
    if(['davi','pipo'].includes(asset.name))root.traverse(o=>{
      if(o.isMesh && o.material.isShaderMaterial)o.castShadow=o.receiveShadow=false;
    });
    if(!["davi","pipo"].includes(asset.name))legacy.add(root);
    if (asset.name === "forest") {
      root.updateMatrixWorld(true);
      const occluders = [];
      root.traverse((o) => {
        if(/^(Station_wardrobe|Mossy_landmark)/i.test(o.name)){
          legacySight.push({object:o,sphere:new T.Box3().setFromObject(o).getBoundingSphere(new T.Sphere())});
          o.traverse(child=>{child.userData.keepGroup=true;});
        }
        if(/^(Forest_depth_oak|Hero_oak)/.test(o.name)){
          const p=o.getWorldPosition(new T.Vector3());
          if(p.x>11&&p.z>4){
            legacySight.push({object:o,sphere:new T.Box3().setFromObject(o).getBoundingSphere(new T.Sphere()),passage:true});
            o.traverse(child=>{child.userData.keepGroup=true;});
          }
        }
        if (o.name.startsWith("Forest_depth_oak")) {
          const p = o.getWorldPosition(new T.Vector3());
          if (p.z > 10 && Math.abs(p.x) < 12) occluders.push(o);
        }
      });
      occluders.forEach((o) => o.removeFromParent());
      terrain = root.getObjectByName("Terrain");
      paintBank();
      const seamPlane=new T.Plane(new T.Vector3(-1,0,0),data.map.seam);
      for(const surface of [terrain,root.getObjectByName('Distant_forest_valley')]){
        if(surface)surface.material.clippingPlanes=[seamPlane];
      }
      batch(root);
      // Bare terrain meets the shelter even after culling the clearing props.
      scene.attach(terrain);
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
      if (pipoActions.Walk) pipoActions.Walk.timeScale = 2.1;
      pipoActions.Hover?.reset().play();mixer.update(0);
      buddyHead=root.getObjectByName('Head');if(buddyHead)headBase.copy(buddyHead.quaternion);
    }
  }
  player.position.set(
    data.position.x,
    floor(data.position.x, data.position.z)-supportHeight(playerSupport,actions),
    data.position.z,
  );
  const buddyStart=pipoGoal(player.position);
  pipo.position.set(buddyStart.x,0,buddyStart.z);
  pipo.position.y=pipoHeight();
  if(currentRegion==='Soleira da Roda Baixa'||currentRegion==='Bosque das Bainhas'){
    player.rotation.y=pipo.rotation.y=angle;
  }
  createContactShadows();
  look.copy(player.position).add(new T.Vector3(0, 0.9, 0));
  syncOwned();
  createFeatures();
  const marker=loaded.find(a=>a.name==='activity');
  if(marker) {
    const markers=new T.Group(),materials=new Map();legacy.add(markers);
    for(const f of features.filter(f=>f.activity)) {
      const root=cloneRig(marker.scene);root.position.set(f.x,floor(f.x,f.z),f.z);
      root.traverse(o=>{if(o.isMesh){if(!materials.has(o.material.uuid)){const mat=o.material.clone();ownedMaterials.add(mat);materials.set(o.material.uuid,mat);}o.material=materials.get(o.material.uuid);}});
      markers.add(root);
    }
    prepare(markers);batch(markers);
  }
  if(!newMap){createWater();cascade();motes();}
  setQuality();
  bind();
  updateCamera();
  renderer.render(scene,camera);
  stats.readyMs = performance.now() - openStarted;
  document.getElementById("forestLoading").remove();
  canvas.dataset.ready = "true";
  showForestReward(options.reward);
  frame = requestAnimationFrame(tick);
  return true;
}
window.DaviForest = {
  open,
  close,
  action,
  characterFraming,
  discoveryFraming,
  walkable(x,z) {return walkable(x,z);},
  telemetry() {
    return {
      view:map2d?'2d':renderer?'3d':'agenda',
      region:currentRegion||null,
      quality, effective:map2d?'2d':renderer?(low?'econômico':'detalhado'):null,
      paused, frames:stats.frames, frameMs:stats.times.slice(),
      readyMs:canvas?.dataset.ready==='true'?(stats.readyMs??null):null, assetsMs:stats.loads.at(0)??null,
      trailMs:stats.trailLoadMs??null, dpr:renderer?.getPixelRatio()??null,
      calls:renderer?.info.render.calls??null, triangles:renderer?.info.render.triangles??null,
      events:contextEvents.slice(),
    };
  },
  project(x,z,y=floor(x,z)) {
    if(map2d)return map2d.project(x,z);
    const p=new T.Vector3(x,y,z).project(camera),rect=canvas.getBoundingClientRect();
    const visible=Math.abs(p.x)<1&&Math.abs(p.y)<1&&Math.abs(p.z)<1;
    let groundVisible=visible;
    if(visible){
      const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(p.x,p.y),camera);
      const hit=groundHit(ray);
      groundVisible=!!hit && Math.hypot(hit.point.x-x,hit.point.z-z)<.2 && !picksLeaf(ray,hit);
    }
    return {x:rect.left+(p.x*.5+.5)*rect.width,y:rect.top+(-p.y*.5+.5)*rect.height,visible,groundVisible};
  },
  diagnostics() {
    const outfit=outfitDiagnostics(player,pipo);
    const gl = renderer?.getContext(),
      ext = gl?.getExtension("WEBGL_debug_renderer_info");
    let renderedGroundY=null,renderedBoardY=null;
    if (player && deckBoards.length && owned('bridge')) {
      const ray=new T.Raycaster(new T.Vector3(player.position.x,100,player.position.z),new T.Vector3(0,-1,0));
      renderedBoardY=ray.intersectObjects(deckBoards,false)[0]?.point.y??null;
    }
    if(terrain&&player)renderedGroundY=groundHit(new T.Raycaster(new T.Vector3(player.position.x,100,player.position.z),new T.Vector3(0,-1,0)),false)?.point.y;
    const geometries=new Set(),textures=new Set();let bufferBytes=0,textureBytes=0,instances=0;
    scene?.traverse(o=>{
      if(o.isInstancedMesh){instances+=o.count;bufferBytes+=o.instanceMatrix.array.byteLength;}
      if(o.geometry&&!geometries.has(o.geometry)){geometries.add(o.geometry);for(const a of Object.values(o.geometry.attributes))bufferBytes+=a.array?.byteLength||0;bufferBytes+=o.geometry.index?.array.byteLength||0;}
      for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m)for(const v of Object.values(m))if(v?.isTexture&&!textures.has(v)){textures.add(v);textureBytes+=(v.image?.width||0)*(v.image?.height||0)*4*(v.generateMipmaps?4/3:1);}
    });
    const screen=player&&camera?player.position.clone().add(new T.Vector3(0,1,0)).project(camera):null;
    return {
      renderer: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl?.getParameter(gl.RENDERER),
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null,
      place:data?.world??(player&&beyondSeam(player.position.x)?"trail":"forest"),region:currentRegion,view:map2d?"2d":"3d",
      shelter:trailScene?.shelter.diagnostics()??null,
      hedgehog:trailScene?{
        progress:trailScene.hedgehog.progress,
        position:trailScene.hedgehog.group.getWorldPosition(new T.Vector3()).toArray(),
      }:null,
      frames: stats.frames,
      frameMs: stats.times.slice(),
      loadMs: stats.loads,
      readyMs: stats.readyMs,
      position: player?.position.toArray(),
      pipoPosition: pipo?.position.toArray(),
      pipoScarfVisible:outfit.buddy.length>0,
      outfit,
      pipoSteps:['LegL','LegR'].map(name=>pipo?.getObjectByName(name)?.position.toArray()??null),
      pipoFeetY:pipo&&camera?new T.Box3().setFromObject(pipo,true).min.y:null,
      pipoGroundY:pipo&&camera?floor(pipo.position.x,pipo.position.z):null,
      motion:{choice:motionChoice,reduced:still,system:reducedMotion.matches},
      living:trailScene?.living()??null,
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
      companion: companion?.diagnostics(),
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
      feetY: player&&renderer ? new T.Box3().setFromObject(player, true).min.y : null,
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
