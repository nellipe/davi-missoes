import * as T from '/vendor/three/three.module.min.js';
import { createSight } from './sight.mjs';
import { recanto } from './recanto.mjs';

const trees = [
  ['Aveleira', -3.7, 10.52, .94, .32],
  ['Carvalho', 3.7, 16.98, .86, 1.14],
  ['Amieiro', 6.55, 10.23, .92, -.77],
  ['Carvalho', -4.8, 15.6, .78, 1.94],
  ['Carvalho', -2.2, 7.5, 1.08, -.42],
  ['Aveleira', 6.35, 8.15, .96, .7],
  ['Carvalho', -.05, 1.65, .89, -.34],
  ['Aveleira', 3.35, -.69, .92, 1.8],
  ['Amieiro', -5.25, 5.9, 1.07, -.64],
  ['Carvalho', -9.43, 5.65, .91, 1.38],
  ['Amieiro', -12.5, 3.2, 1.08, -.79],
  ['Carvalho', -11.44, -3.55, .88, 2.1],
  ['Amieiro', -7.42, -2.83, .83, .93],
  ['Carvalho', 8.32, 2.62, 1.02, -.85],
  ['Amieiro', 9.38, 5.35, .96, 1.38],
  ['Aveleira', 9.42, -.71, 1.09, .79],
  ['Amieiro', 4.55, -3.58, .91, -1.53],
  ['Carvalho', .66, -3.90, .85, -.83],
  ['Amieiro', -2.43, -3.33, .77, .45],
];

const shelves = [
  [-2.90, 8.48, .94, .72, .67, .28],
  [-3.91, 9.01, .80, .60, .76, -.53],
  [ .10, .10, 1.71, 1.05, 1.52, -.40],
  [ 2.00, -.60, 1.42, .96, 1.39, 1.80],
  [-1.55, -1.40, 1.16, .96, 1.15, .76],
  [ 4.90, 1.45, 1.06, .90, .69, -.9],
  [ 6.86, 5.70, 1.01, .77, 1.18, -.30],
  [ 8.66, 4.15, 1.20, 1.10, 1.1, .6],
  [-11.66, -1.62, .72, .55, .74, .7],
  [-12.38, -.37, .45, .37, .40, -.4],
  [-5.74, 5.07, .73, .6, .78, -.6],
  [-4.3, 5.58, .62, .55, .70, 1.3],
  [-4.2, -.11, .94, .79, .81, -.3],
  [ 2.57, 3.30, .62, .36, .82, -.82],
  [ 3.36, 3.49, .44, .26, .58, .51],
];
const foregroundName=/^(Seixo_de_Margem|Moita_de_Bagas)$/;

const meadows = [
  // Round silhouettes close the corners without filling the route.
  [-3.45,13.08,.91],[-2.90,15.05,.94],[-.46,16.63,.72],[2.64,15.56,.70],
  [3.72,13.36,.82],[5.22,11.97,.74],[-2.96,10.22,.68],[-.62,9.90,.66],
  [-1.40,7.0,.80],[-2.58,5.55,1.03],[-.13,6.20,.73],[5.30,7.47,.92],
  [6.60,5.80,.82],[3.19,2.66,.63],[-.71,2.16,.81],[-4.48,4.47,.87],
  [-7.05,4.64,.72,[-6.76,5.16]],[-8.83,3.43,.69,[-9.02,3.72]],[-11.51,2.66,.76],[-12.0,.23,.82],
  [-8.30,-1.32,.83],[-6.67,-.23,.69],[8.52,2.61,.95],[8.72,.85,.84],
  [5.85,-1.66,.79],[-1.86,-.83,.81],[2.40,-1.78,.67],
];

export function inBosque(x, z) {
  return x > -13.2 && x < 10.7 && z > -4.2 && z < 9.8;
}
export function inSceneMaster(x,z) {
  return inBosque(x,z)||(z>=9.8 && z<17.8 && x>-7 && x<8);
}

export function installBosque(group, library, layout, floor, edge, paint, registerSolid) {
  const art = new T.Group();
  const details = new T.Group();
  const economy = new T.Group(), full = new T.Group();
  const blockers = [];
  const solidBatches = [];
  const screening = [];
  group.add(art);
  art.add(details,economy,full);
  const material = paint.toon('#ffffff',{vertexColors:true});
  material.name = 'Pigmentos toon do Bosque';
  const foliage=paint.leafyToon();
  let seed = 24049;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const get = (name) => library.getObjectByName(name).geometry;
  const batches = new Map();
  function place(name, x, z, sx, sy, sz, turn, { detail = false, solid = false, lift = 0 } = {}) {
    const parent = detail ? details : name.endsWith('_economica') ? economy : name.endsWith('_Copa') ? full : art;
    const geometry = get(name);
    if (name==='Tronco_Chibi'||name==='Varal') {
      const paint=name==='Varal'?material.clone():material;
      if(name==='Varal')paint.side=T.DoubleSide;
      const mesh = new T.Mesh(geometry, paint);
      mesh.name='Bosque:'+name;
      mesh.position.set(x, floor(x, z) + lift, z);
      mesh.scale.set(sx, sy, sz);
      mesh.rotation.y = turn;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      blockers.push(mesh);
      if(registerSolid){
        mesh.updateMatrix();
        registerSolid('Bosque:'+name,geometry,mesh.matrix);
      }
      return mesh;
    }
    const key = name + (detail ? '.detail' : '');
    if (!batches.has(key)) batches.set(key, { parent, geometry, poses: [] });
    batches.get(key).poses.push([x, z, sx, sy, sz, turn, lift, solid]);
  }
  for (const [kind, x, z, size, turn] of trees) {
    const key=kind+'_Chibi';
    place(key+'_Tronco',x,z,size,size,size,turn,{solid:true});
    place(key+'_Copa',x,z,size,size,size,turn);
    place(key+'_Copa_economica',x,z,size,size,size,turn);
  }
  for(const [x,z,sx,sy,sz,turn] of shelves)place('Seixo_de_Margem',x,z,sx,sy*.76,sz,turn,{solid:true});
  const log=place('Tronco_Chibi', ...recanto.log, 1, 1, 1, Math.PI+recanto.openingYaw, { solid: true, lift: .83 });
  paint.outline(log,1.55);
  place('Varal', 2.95, 2.95, 1, 1, 1, -.06, { solid: true });
  for(const [x,z,size,turn] of [
    [-1.8,8.3,.9,.4], [4.75,7.48,.85,.5], [1.88,4.0,.91,2],
    [-8.42,-1.66,.82,.8], [-6.62,.75,.68,1.2], [-10.78,1.02,.95,1],
    [-10.2,3.33,.88,2.7], [-1.37,-1.35,.8,1.7],
    [2.26,15.57,.94,1.3],[-2.49,12.03,.68,2],[-3.67,13.81,.80,1.74],
    [-6.49,-.82,.80,.7],
  ])place('Cogumelos',x,z,size,size,size,turn);

  for (const index of [1, 2]) {
    const line = layout.paths[index].points;
    for (let i = 1; i < line.length; i++) {
      const [a, b] = line[i - 1], [c, d] = line[i];
      const steps = Math.ceil(Math.hypot(c-a, d-b) / (index===1?1.10:.71));
      for (let k = 0; k < steps; k++) {
        const t = (k + .31 + random()*.35) / steps;
        const x = T.MathUtils.lerp(a, c, t), z = T.MathUtils.lerp(b, d, t);
        if (!inBosque(x,z)) continue;
        const crossing=index===2 && i===1;
        const skew = crossing?(random()-.5)*.25:(random()-.5)*1.24;
        const width = crossing?.85+random()*.30:.39+random()*.33;
        const turn = Math.atan2(c-a,d-b);
        place(index===1?'Casca_da_Trilha':'Seixo_da_Travessia',
          x + skew*Math.cos(turn),z-skew*Math.sin(turn),width,index===2?.94:.75,
          width*(.78+random()*.45),turn+(random()-.5)*1.06,{lift:index===2?-.028:-.012});
      }
    }
  }

  for (const [x,z,s,bush=[x,z]] of meadows) {
    if(edge(x,z)>.22)place('Moita_de_Bagas',...bush,s,s,s,random()*6.28);
    for (let i=0;i<4;i++) {
      const angle = random()*Math.PI*2;
      const range = .55+random()*1.10;
      const u = x+range*Math.cos(angle), v = z+range*Math.sin(angle);
      if(edge(u,v)<.10 || (u< -8.6 && u> -11.99 && v> -.76 && v<1.93))continue;
      const size=s*(.65+random()*.57);
      place(i===3?'Trevo':'Flores_Chibi',u,v,size,size,size,angle,{detail:i>1});
    }
  }
  for (let i=0;i<560;i++) {
    const x=random()*23-13, z=random()*19-3;
    const rim=edge(x,z);
    if (!inSceneMaster(x,z)||rim < -.23 || rim > .52 || (x < -8.6 && x > -12.05 && z > -.7 && z < 1.9)) continue;
    const s=.13+random()*.29, turn=random()*6.28;
    place('Cascalho',x,z,s,.22+s*.26,s*(.74+random()*.36),turn,{detail:i%4===0});
  }
  const pose = new T.Object3D();
  const surfaceUp = new T.Vector3();
  const vertical = new T.Vector3(0,1,0);
  const turnAroundY = new T.Quaternion();
  const invisible = new T.Matrix4().makeScale(0,0,0);
  const steppingStones=[];
  const pressedMatrix=new T.Matrix4();
  let pressed=null;
  for (const [name, { parent, geometry, poses }] of batches) {
    const canopy = /_Copa/.test(name);
    const mesh = new T.InstancedMesh(geometry,canopy||name==='Moita_de_Bagas'?foliage:material,poses.length);
    mesh.name='Bosque:'+name.replace(/\.detail$/,'');
    const trunk= name.endsWith('_Tronco');
    const foreground=foregroundName.test(name.replace(/\.detail$/,''));
    const tread = name==='Seixo_da_Travessia'||name==='Casca_da_Trilha';
    const visibleSolids=new Set();
    poses.forEach(([x,z,sx,sy,sz,turn,lift,solid],i) => {
      pose.position.set(x,floor(x,z)+lift,z);
      pose.scale.set(sx,sy,sz);
      pose.rotation.y=turn;
      if(tread){
        surfaceUp.set(floor(x-.30,z)-floor(x+.30,z),.60,floor(x,z-.30)-floor(x,z+.30)).normalize();
        pose.quaternion.setFromUnitVectors(vertical,surfaceUp).multiply(turnAroundY.setFromAxisAngle(vertical,turn));
      }
      pose.updateMatrix();
      if(solid && registerSolid)registerSolid('Bosque:'+name,geometry,pose.matrix,name.endsWith('_Tronco'));
      mesh.setMatrixAt(i,pose.matrix);
      if(name==='Seixo_da_Travessia')steppingStones.push({mesh,i,x,z,matrix:pose.matrix.clone()});
      if(solid)visibleSolids.add(i);
      if(canopy||trunk||foreground){
        if(!geometry.boundingSphere)geometry.computeBoundingSphere();
        const sphere=geometry.boundingSphere.clone().applyMatrix4(pose.matrix);
        if(trunk)sphere.radius *= .80;
        screening.push({mesh,parent,i,matrix:pose.matrix.clone(),sphere,foreground:foreground||trunk,solid,visibleSolids,hidden:false});
      }
    });
    mesh.castShadow = trunk || canopy && parent===full || name==='Moita_de_Bagas';
    mesh.receiveShadow = true;
    parent.add(mesh);
    if(name==='Seixo_da_Travessia')paint.outline(mesh,1.05);
    if(visibleSolids.size)solidBatches.push({mesh,visibleSolids});
  }
  let economical=false;
  const sight=createSight();
  return {
    stonePressure() { return pressed ? pressed.matrix.elements[13]-pressedMatrix.elements[13] : 0; },
    step(hero,still,moving) {
      let next=null,gap=.36;
      if(!still && moving)for(const stone of steppingStones){
        const distance=Math.hypot(hero.x-stone.x,hero.z-stone.z);
        if(distance<gap){next=stone;gap=distance;}
      }
      if(pressed && pressed!==next){
        pressed.mesh.setMatrixAt(pressed.i,pressed.matrix);
        pressed.mesh.instanceMatrix.needsUpdate=true;
      }
      pressed=next;
      if(next){
        pressedMatrix.copy(next.matrix).elements[13]-=.065*(1-gap/.36);
        next.mesh.setMatrixAt(next.i,pressedMatrix);
        next.mesh.instanceMatrix.needsUpdate=true;
      }
    },
    setEconomy(low) { economical=low; details.visible = full.visible = !low; economy.visible=low; },
    clearSight(camera, hero, buddy, landmarks) {
      art.visible=inSceneMaster(hero.x,hero.z)||Math.hypot(hero.x-1,hero.z-3.4)<(economical?12.4:16.5);
      if(!art.visible)return;
      sight.update(camera,hero,buddy,landmarks);
      for(const item of screening){
        if(!item.parent.visible)continue;
        const {center,radius}=item.sphere;
        const closeSolid=item.solid&&Math.hypot(hero.x-center.x,hero.z-center.z)<1.25;
        const blocks=!closeSolid&&sight.covers(center,radius*.90,item.foreground?.09:.21,item.foreground);
        if (blocks !== item.hidden) {
          item.hidden=blocks;
          item.mesh.setMatrixAt(item.i,blocks?invisible:item.matrix);
          item.mesh.instanceMatrix.needsUpdate=true;
          if(item.solid){
            if(blocks)item.visibleSolids.delete(item.i);
            else item.visibleSolids.add(item.i);
          }
        }
      }
    },
    blocksTap(ray, hit) {
      return art.visible && (
        blockers.some(mesh=>mesh.visible&&ray.intersectObject(mesh,false)[0]?.distance+.02<hit.distance) ||
        solidBatches.some(({mesh,visibleSolids})=>ray.intersectObject(mesh,false)
          .some(p=>visibleSolids.has(p.instanceId)&&p.distance+.02<hit.distance))
      );
    },
  };
}
