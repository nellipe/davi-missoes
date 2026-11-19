import * as T from '/vendor/three/three.module.min.js';
import { GLTFLoader } from '/vendor/three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from '/vendor/three/addons/utils/BufferGeometryUtils.js';
import { smoothstep } from '../forest/navigation.mjs';
import { landscape } from './terrain.mjs';
import { makeGround, makeWater, randomSequence } from './landscape-art.mjs';
import { createDiscoveries } from './discoveries.mjs';
import { atmosphere } from './ambient.mjs';

export async function loadWorld(data) {
  const library = await new GLTFLoader().loadAsync(`/assets/worlds/${data.world}.glb`);
  try{return build(data,library.scene);}
  catch(error){disposeModel(library.scene);throw error;}
}

// Most kit materials differ only in pigment. Bake them into spatial batches so
// small narrative props stay visible in Economy without a draw call per piece.
function sceneryBatches(group,batches){
  const opaque=new T.MeshStandardMaterial({vertexColors:true,roughness:.82,side:T.DoubleSide});
  const luminous=new T.MeshBasicMaterial({vertexColors:true});
  for(const {parts,glow} of batches.values()){
    const geometry=mergeGeometries(parts);
    for(const part of parts)part.dispose();
    const mesh=new T.Mesh(geometry,glow?luminous:opaque);
    mesh.castShadow=!glow;
    mesh.receiveShadow=!glow;
    group.add(mesh);
  }
}

function appendMesh(batches,source,rootMatrix,inverse,x,z){
  const glow=source.material.emissiveIntensity>0&&source.material.emissive?.getHex()!==0;
  const key=[Math.floor(x/12),Math.floor(z/12),glow].join(',');
  const geometry=source.geometry.clone();
  for(const attribute of Object.keys(geometry.attributes))if(attribute!=='position'&&attribute!=='normal')geometry.deleteAttribute(attribute);
  if(!geometry.index)geometry.setIndex(Array.from({length:geometry.attributes.position.count},(_,i)=>i));
  geometry.applyMatrix4(rootMatrix.clone().multiply(inverse).multiply(source.matrixWorld));
  const colors=new Float32Array(geometry.attributes.position.count*3);
  const color=glow?source.material.emissive:source.material.color;
  for(let i=0;i<colors.length;i+=3)color.toArray(colors,i);
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));
  if(!batches.has(key))batches.set(key,{parts:[],glow});
  batches.get(key).parts.push(geometry);
}

function mechanismFeedback(root,name){
  if(name==='console-coil'){
    const loop=new T.TorusGeometry(.29,.021,7,20);
    const material=new T.MeshBasicMaterial({color:'#9aebf7'});
    return [1.32,1.58,1.83].map(y=>{
      const mesh=new T.Mesh(loop,material);
      mesh.rotation.x=Math.PI/2;
      mesh.position.set(-.16,y,0);
      root.add(mesh);
      return mesh;
    });
  }
  if(name==='console-commands'){
    const bulb=new T.SphereGeometry(.059,9,6);
    return [-.24,0,.24].map((z,i)=>{
      const mesh=new T.Mesh(bulb,new T.MeshBasicMaterial({color:['#ffe697','#dcb4ff','#9fead9'][i]}));
      mesh.position.set(-.16,1.26,z);
      root.add(mesh);
      return mesh;
    });
  }
  return [];
}

function build(data,library){
  const {world,layout}=data;
  const shape=landscape(data), group=new T.Group();
  group.name=layout.title;
  const ground=makeGround(data,shape),water=makeWater(data,shape);
  group.add(ground,water);
  const discoveries=createDiscoveries(data,shape), ambient=atmosphere(data,shape);
  group.add(discoveries.group,ambient.group);
  const effects=new Map(),characters=new Map(),batches=new Map();
  const spinners=[],covers=[],idles=[],floating=[];
  const cast=new Map(layout.places.filter(p=>p.character).map(p=>[p.character,p.id]));
  const destinations=new Set(layout.places.map(p=>p.effect).filter(Boolean));
  const transform=new T.Object3D();
  library.updateMatrixWorld(true);
  for(const [name,x,z,degrees,size] of layout.props){
    const model=library.getObjectByName(name);
    if(!model)throw Error(`Modelo ausente: ${name}`);
    const floats=name==='buoy', y=floats?-.39:shape.height(x,z), yaw=T.MathUtils.degToRad(degrees);
    const dynamic=floats||cast.has(name)||destinations.has(name)||model.children.some(o=>/^(idle_|spin_|cover_)/.test(o.name));
    if(!dynamic){
      transform.position.set(x,y,z);
      transform.rotation.y=yaw;
      transform.scale.setScalar(size);
      transform.updateMatrix();
      const inverse=model.matrixWorld.clone().invert();
      model.traverse(o=>{if(o.isMesh)appendMesh(batches,o,transform.matrix,inverse,x,z);});
      continue;
    }

    const root=model.clone();
    root.position.set(x,y,z);
    root.scale.setScalar(size);
    root.rotation.y=yaw;
    if(floats)floating.push({root,y,phase:x});
    if(cast.has(name))characters.set(cast.get(name),{root,y,yaw,greeting:-Infinity});
    const effect={root,x,y,z,yaw,active:false,start:-Infinity,parts:[]};
    root.traverse(o=>{
      if(o.name.startsWith('effect_'))effect.moving=o;
      if(o.name.startsWith('prize_'))effect.prize=o;
      if(o.name.startsWith('dial_'))effect.dial=o;
      if(o.name.startsWith('bones'))effect.bones=o;
      if(o.name.startsWith('assemble_'))effect.parts.push({node:o,home:o.position.clone()});
      if(o.name.startsWith('spin_'))spinners.push([o,o.name.includes('reverse')?-.70:.49]);
      if(o.name.startsWith('cover_'))covers.push({object:o,x,z});
      if(o.name.startsWith('idle_'))idles.push({node:o,phase:x});
      if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}
    });
    if(destinations.has(name)){
      effect.indicators=mechanismFeedback(root,name);
      effects.set(name,effect);
    }
    group.add(root);
  }
  sceneryBatches(group,batches);
  const details=scatter(data,shape);
  group.add(details);
  function progress(values){
    discoveries.progress(values);
    for(const {id,effect} of layout.places)if(effects.has(effect))effects.get(effect).active=values.includes(id);
  }
  let low=false;
  return {
    group,ground,progress,
    setEconomy(value){low=value;details.count=value?160:details.instanceMatrix.count;discoveries.setEconomy(value);},
    greet(id,time){if(characters.has(id))characters.get(id).greeting=time;},
    reveal(place,time){
      const effect=effects.get(place.effect);
      if(effect)effect.start=time;
      const x=effect?.x??place.x,z=effect?.z??place.z;
      discoveries.play(place,time,x,z);
      return {x,z,y:shape.height(x,z)+(place.requires?1.3:.65)};
    },
    tick(time,dt,still,player){
      water.material.uniforms.clock.value=still?0:time;
      ambient.tick(time,still,low);
      discoveries.tick(time,still,player);
      for(const {object,x,z} of covers)object.visible=Math.abs(player.x-x)>1.4||player.z>z+.4||player.z<z-2.4;
      for(const [wheel,speed] of spinners)wheel.rotation.z=still?0:time*speed;
      for(const {root,y,phase} of floating){
        root.position.y=y+(still?0:Math.sin(time*1.6+phase)*.115);
        root.rotation.x=still?0:Math.sin(time*1.3+phase)*.14;
      }
      for(const {node,phase} of idles){
        if(node.name.startsWith('idle_lens'))node.rotation.y=still?0:time*.83;
        else if(node.name.startsWith('idle_claw'))node.rotation.z=still?0:Math.sin(time*2.48+phase)*(node.name.includes('-1')?.15:-.15);
        else if(node.name.startsWith('idle_tail'))node.rotation.y=still?0:Math.sin(time*1.64+phase)*.19;
        else node.rotation.x=still?0:.11*Math.sin(time*1.68+phase);
      }
      for(const {root,y,yaw,greeting} of characters.values()){
        const age=time-greeting;
        const pulse=still||age>1.5?0:Math.sin(Math.PI*age/1.5);
        const toward=Math.atan2(player.x-root.position.x,player.z-root.position.z)-yaw;
        const turn=T.MathUtils.clamp(Math.atan2(Math.sin(toward),Math.cos(toward)),-.51,.51);
        root.rotation.y=yaw+turn*pulse;
        root.position.y=y+.13*pulse;
      }
      for(const [name,effect] of effects)tickEffect(name,effect,time,still);
    },
    dispose(){disposeModel(group,library);},
  };
}

function tickEffect(name,{root,y,yaw,start,moving,prize,bones,dial,parts,active,indicators},time,still){
  const age=time-start;
  const amount=active?(still?1:smoothstep(age,0,.83)):0;
  const jump=active&&!still&&age>0&&age<1.48?Math.sin(Math.PI*age/1.48):0;
  if(prize){
    prize.visible=amount>.012;
    prize.scale.setScalar(.44+.56*amount);
  }
  if(name.startsWith('shell-')){
    root.position.y=y+amount*.19+jump*.83;
    root.rotation.y=yaw+jump*2.3+(still?0:amount*.12*Math.sin(time*2));
  }else if(bones){
    bones.position.y=amount*.14+jump*.52;
    bones.rotation.y=jump*1.83;
  }
  if(name==='chest'&&moving){
    moving.rotation.x=-1.55*amount;
    if(prize)prize.position.y=jump*.67+(still?0:amount*.078*Math.sin(time*2.8));
  }
  if(parts.length){
    for(const [i,{node,home}] of parts.entries()){
      const assembled=active?(still?1:smoothstep(age,.12+i*.29,.72+i*.29)):0;
      node.visible=assembled>.004;
      node.position.copy(home);
      node.position.y+=(1-assembled)*(.65+i*.22);
      node.position.x+=(1-assembled)*(.53-i*.47);
      node.rotation.z=(1-assembled)*(.72-i*.67);
    }
  }
  if(dial)dial.rotation.z=(-1.48+(still?0:jump*.31))*amount;
  for(const [i,indicator] of indicators.entries()){
    indicator.visible=active&&(still||age>=.12+i*.23);
    if(name==='console-coil')indicator.scale.setScalar(still||!indicator.visible?1:1+.12*Math.sin(time*5-i*.9));
  }
  if(name==='automaton'&&moving){
    moving.rotation.z=still?0:Math.sin(time*5.7)*.30*amount;
    moving.rotation.y=still?0:Math.sin(time*2.5)*.84*amount;
    moving.position.y=still?0:Math.abs(Math.sin(time*5.7))*.22*amount;
    if(prize)prize.scale.setScalar(.87+amount*(still?.13:.13+.08*Math.sin(time*6)));
  }
}

function scatter(data,shape){
  const city=data.world==='inventores',beach=data.world==='praia';
  const geometry=city?new T.BoxGeometry(.34,.025,.16):new T.IcosahedronGeometry(1,0);
  const palette=(beach?['#fbe9bd','#dbbd91','#f8d6a7','#e2a18c']:city?['#c6acbb','#d3b4ac','#9299b4','#c8c7d8']:['#a7bf71','#b1c87b','#929b53','#cea47b']).map(c=>new T.Color(c));
  const layer=new T.InstancedMesh(geometry,new T.MeshStandardMaterial({roughness:1}),city?250:460);
  const random=randomSequence(431), item=new T.Object3D(),[x0,x1,z0,z1]=data.map.bounds;
  let placed=0;
  while(placed<layer.count){
    const x=x0+(x1-x0)*random(), z=z0+(z1-z0)*random();
    if(shape.coast(x,z)<.62||shape.path(x,z)<(city?.6:1.28))continue;
    const size=.055+random()*(beach?.11:.16);
    item.position.set(x,shape.height(x,z)+.028,z);
    item.scale.set(city?1+2*random():size,city?1:size*.48,city?1:size*.77);
    item.rotation.y=city?0:random()*Math.PI;
    item.updateMatrix();
    layer.setMatrixAt(placed,item.matrix);
    layer.setColorAt(placed++,palette[Math.floor(random()*palette.length)]);
  }
  layer.receiveShadow=true;
  return layer;
}

function disposeModel(...roots){
  const geoms=new Set(),materials=new Set(),textures=new Set();
  for(const root of roots)root?.traverse(o=>{
    if(o.geometry)geoms.add(o.geometry);
    if(o.isInstancedMesh)o.dispose();
    for(const material of (Array.isArray(o.material)?o.material:[o.material]))if(material)materials.add(material);
  });
  for(const mat of materials){
    for(const value of Object.values(mat))if(value?.isTexture)textures.add(value);
    for(const uniform of Object.values(mat.uniforms??{}))if(uniform.value?.isTexture)textures.add(uniform.value);
    mat.dispose();
  }
  for(const geometry of geoms)geometry.dispose();
  for(const texture of textures){texture.dispose();texture.image?.close?.();}
}
