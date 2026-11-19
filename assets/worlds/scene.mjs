import * as T from '/vendor/three/three.module.min.js';
import { GLTFLoader } from '/vendor/three/addons/loaders/GLTFLoader.js';
import { smoothstep } from '/assets/forest/navigation.mjs';
import { landscape } from './terrain.mjs';

export async function loadWorld(data) {
  const library = await new GLTFLoader().loadAsync(`/assets/worlds/${data.world}.glb`);
  return build(data,library.scene);
}

function build(data, library) {
  const {world,layout,map:{bounds:[xmin,xmax,zmin,zmax]}}=data;
  const shape=landscape(data);
  const group=new T.Group();
  group.name=layout.title;
  const land=new T.PlaneGeometry(xmax-xmin+4,zmax-zmin+4,156,78).rotateX(-Math.PI/2)
    .translate((xmax+xmin)/2,0,(zmax+zmin)/2);
  const points=land.getAttribute('position'), pigments=new Float32Array(points.count*3);
  const base=new T.Color(layout.ground), pathColor=new T.Color(layout.path), edge=new T.Color(layout.edge), color=new T.Color();
  const city=world==='inventores', beach=world==='praia';
  for(let i=0;i<points.count;i++){
    const x=points.getX(i),z=points.getZ(i),d=shape.coast(x,z), p=shape.path(x,z);
    points.setY(i,shape.height(x,z,d));
    const patch=(Math.sin(x*.88+z*.79)+Math.cos(x*.47-1.04*z)+2)*.25;
    color.copy(base).lerp(edge,(.19+.19*patch)*(city?1:beach?.50:1.25));
    color.lerp(pathColor,1-smoothstep(p,city?1.05:.58,city?1.63:1.45));
    if(beach&&d<1.95)color.lerp(pathColor,(1-smoothstep(d,-.32,1.95))*.64);
    color.multiplyScalar(.94+.085*patch).toArray(pigments,i*3);
  }
  land.setAttribute('color',new T.BufferAttribute(pigments,3));
  land.computeVertexNormals();
  const ground=new T.Mesh(land,new T.MeshStandardMaterial({vertexColors:true,roughness:.96}));
  ground.receiveShadow=true;
  group.add(ground);

  const water=new T.Mesh(new T.PlaneGeometry(170,120).rotateX(-Math.PI/2),new T.ShaderMaterial({
    uniforms:{waterTint:{value:new T.Color(layout.waterColor)},sky:{value:new T.Color(layout.sky)},clock:{value:0}},
    vertexShader:`varying vec3 p; void main(){ p=(modelMatrix*vec4(position,1.)).xyz;
      gl_Position=projectionMatrix*viewMatrix*vec4(p,1.); }`,
    fragmentShader:`uniform vec3 waterTint,sky; uniform float clock; varying vec3 p;
      void main(){vec2 uv=p.xz;
        float ripple=sin(uv.y*4.8+sin(uv.x*1.28)+clock*.9)+.56*sin(uv.x*3.6-uv.y*2.7-clock*.62);
        float glints=smoothstep(1.10,1.48,ripple)*(.22+.78*smoothstep(.08,1.,sin(uv.x*.46+uv.y*.21)));
        float depth=sin(uv.x*.52+uv.y*.29)*.055;
        vec3 teal=waterTint*(.90+depth)+glints*vec3(.34,.53,.50);
        float mist=smoothstep(14.,49.,distance(p,cameraPosition));
        gl_FragColor=vec4(mix(teal,sky,mist*.95),1.);
        #include <colorspace_fragment>
      }`,
  }));
  water.position.set((xmin+xmax)/2,-.43,0);
  group.add(water);

  const batches=new Map(), effects=new Map(), spinners=[], covers=[], characters=new Map();
  const cast=new Map(layout.places.filter(p=>p.character).map(p=>[p.character,p.id]));
  const matrix=new T.Matrix4(), origin=new T.Object3D();
  library.updateMatrixWorld(true);
  for(const [name,x,z,degrees,size] of layout.props){
    const model=library.getObjectByName(name);
    if(!model)throw Error(`Modelo ausente: ${name}`);
    const y=name==='buoy'?-.39:shape.height(x,z);
    const dynamic=cast.has(name)||model.children.some(o=>/^(effect_|prize_|spin_|stage|cover_)/.test(o.name));
    if(dynamic){
      const root=model.clone();
      root.position.set(x,y,z);
      root.scale.setScalar(size);
      root.rotation.y=T.MathUtils.degToRad(degrees);
      if(cast.has(name))characters.set(cast.get(name),{root,y,yaw:root.rotation.y,greeting:0});
      const effect={};
      root.traverse(o=>{
        if(o.name.startsWith('effect_'))effect.moving=o;
        if(o.name.startsWith('prize_'))effect.prize=o;
        if(o.name.startsWith('spin_'))spinners.push([o,o.name.endsWith('reverse')?-.59:.42]);
        if(o.name.startsWith('cover_'))covers.push({object:o,x,z});
        if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}
      });
      if(effect.moving||effect.prize){
        Object.assign(effect,{amount:0,active:false});
        if(effect.prize)effect.prize.visible=false;
        effects.set(name,effect);
      }
      group.add(root);
      continue;
    }
    origin.position.set(x,y,z);
    origin.rotation.y=T.MathUtils.degToRad(degrees);
    origin.scale.setScalar(size);
    origin.updateMatrix();
    const inverse=model.matrixWorld.clone().invert();
    model.traverse(o=>{
      if(!o.isMesh)return;
      if(!batches.has(o.uuid))batches.set(o.uuid,{source:o,matrices:[]});
      batches.get(o.uuid).matrices.push(matrix.multiplyMatrices(origin.matrix,inverse).multiply(o.matrixWorld).clone());
    });
  }
  for(const {source,matrices} of batches.values()){
    const mesh=new T.InstancedMesh(source.geometry,source.material,matrices.length);
    matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    group.add(mesh);
  }
  const details=scatter(data,shape);
  group.add(details);
  const progress=values=>{
    for(const {id,effect} of layout.places)if(effect&&effects.has(effect)){
      effects.get(effect).active=values.includes(id);
    }
  };
  return {
    group, ground, progress,
    setEconomy(low){details.visible=!low;},
    greet(id,time){if(characters.has(id))characters.get(id).greeting=time+1.4;},
    tick(time,dt,still,player){
      water.material.uniforms.clock.value=still?0:time;
      for(const {object,x,z} of covers)object.visible=Math.abs(player.x-x)>1.4||player.z>z+.4||player.z<z-2.4;
      for(const [wheel,speed] of spinners)wheel.rotation.z=still?0:time*speed;
      for(const {root,y,yaw,greeting} of characters.values()){
        const pulse=still?0:Math.sin(Math.PI*Math.max(0,greeting-time)/1.4);
        const toward=Math.atan2(player.x-root.position.x,player.z-root.position.z)-yaw;
        const turn=T.MathUtils.clamp(Math.atan2(Math.sin(toward),Math.cos(toward)),-.48,.48);
        root.rotation.y=yaw+turn*pulse;
        root.position.y=y+.14*pulse;
      }
      for(const [name,{moving,prize,active,amount}] of effects){
        const next=still?Number(active):T.MathUtils.lerp(amount,Number(active),Math.min(1,dt*3));
        effects.get(name).amount=next;
        if(prize){prize.visible=next>.02;prize.scale.setScalar(.4+.6*next);}
        if(name==='chest'&&moving)moving.rotation.x=-1.42*next;
        if(name==='automaton'&&moving){
          moving.rotation.z=still?0:Math.sin(time*5.7)*.23*next;
          moving.rotation.y=still?0:Math.sin(time*2.5)*.66*next;
          moving.position.y=still?0:Math.abs(Math.sin(time*5.7))*.16*next;
        }
      }
    },
    dispose(){disposeModel(group,library);},
  };
}

function scatter(data,shape) {
  const beach=data.world==='praia',city=data.world==='inventores';
  const geometry=city?new T.BoxGeometry(.34,.029,.19):new T.IcosahedronGeometry(1,0);
  const palette=(beach?['#fbe9bd','#dbbd91','#f8d6a7','#e2a18c']:city?['#c6acbb','#d3b4ac','#9299b4','#c8c7d8']:['#a7bf71','#b1c87b','#929b53','#cea47b']).map(c=>new T.Color(c));
  const layer=new T.InstancedMesh(geometry,new T.MeshStandardMaterial({roughness:1}),city?230:440);
  let seed=431, placed=0;
  const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const item=new T.Object3D(),[x0,x1,z0,z1]=data.map.bounds;
  while(placed<layer.count){
    const x=x0+(x1-x0)*rnd(), z=z0+(z1-z0)*rnd();
    if(shape.coast(x,z)<.6 || shape.path(x,z)<(city?.43:1.4))continue;
    const size=.055+rnd()*(beach?.11:.16);
    item.position.set(x,shape.height(x,z)+.028,z);
    item.scale.set(city?1+3*rnd():size,city?1:size*.48,city?1:size*.77);
    item.rotation.y=city?0:rnd()*Math.PI;
    item.updateMatrix();
    layer.setMatrixAt(placed,item.matrix);
    layer.setColorAt(placed++,palette[Math.floor(rnd()*palette.length)]);
  }
  layer.receiveShadow=true;
  return layer;
}

export function disposeModel(...roots){
  const geometry=new Set(), materials=new Set(), textures=new Set();
  for(const root of roots)root?.traverse(o=>{
    if(o.geometry)geometry.add(o.geometry);
    if(o.isInstancedMesh)o.dispose();
    for(const material of (Array.isArray(o.material)?o.material:[o.material]))if(material)materials.add(material);
  });
  for(const mat of materials){
    for(const v of Object.values(mat))if(v?.isTexture)textures.add(v);
    mat.dispose();
  }
  for(const mesh of geometry)mesh.dispose();
  for(const texture of textures){texture.dispose();texture.image?.close?.();}
}
