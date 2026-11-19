import * as T from '/vendor/three/three.module.min.js';
import { mergeGeometries } from '/vendor/three/addons/utils/BufferGeometryUtils.js';

export function buildWaterSurfaces(floor, clock) {
  const points=[],uv=[],across=[],indices=[];
  const segments=32;
  const rows=8;
  // Bank and water follow the actual tread height. The scene still uses the
  // same heightfield for foot support, taps and server-side position checks.
  for(let r=0;r<=rows;r++){
    const u=Math.max(.0001,r/rows);
    for(let i=0;i<=segments;i++){
      const a=i/segments*Math.PI*2;
      const irregular=1+.12*Math.sin(a*3+.4)+.06*Math.cos(a*5-1);
      const x=-1.72+1.20*u*Math.cos(a)*irregular;
      const z=13.55+1.34*u*Math.sin(a)*irregular;
      points.push(x,floor(x,z)+.024,z);
      uv.push(x*.64+z*.16,u);
      across.push(x*.8);
      if(r<rows&&i<segments){
        const id=r*(segments+1)+i, next=id+segments+1;
        indices.push(id,id+1,next,id+1,next+1,next);
      }
    }
  }
  const start=points.length/3;
  const creek=new T.CatmullRomCurve3([
    [4.18,1.17],[3.85,2.47],[3.94,3.93],[4.39,5.10],[5.10,5.80],[5.92,7.12],
  ].map(([x,z])=>new T.Vector3(x,0,z)));
  const bands=36,cross=7;
  for(let i=0;i<=bands;i++){
    const t=i/bands;
    const p=creek.getPointAt(t), tangent=creek.getTangentAt(t);
    const width=(.74+.15*Math.sin(t*12))*Math.pow(Math.sin(t*Math.PI),.36)+.012;
    for(let j=0;j<=cross;j++){
      const offset=(j/cross*2-1)*width;
      const x=p.x+tangent.z*offset,z=p.z-tangent.x*offset;
      points.push(x,floor(x,z)+.026,z);
      uv.push(t*4,Math.abs(j/cross*2-1));
      across.push(j/cross);
      if(i<bands&&j<cross){
        const id=start+i*(cross+1)+j,next=id+cross+1;
        indices.push(id,id+1,next,id+1,next+1,next);
      }
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geometry.setAttribute('waterAcross',new T.Float32BufferAttribute(across,1));
  geometry.setIndex(indices);
  const material=new T.MeshBasicMaterial({
    color:'#4bbfe9',side:T.DoubleSide,transparent:true,depthWrite:false,forceSinglePass:true,
  });
  material.onBeforeCompile=shader=>{
    shader.uniforms.waterClock=clock;
    shader.vertexShader='attribute float waterAcross;\nvarying vec3 waterUv;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>','#include <begin_vertex>\nwaterUv=vec3(uv,waterAcross);');
    shader.fragmentShader=`varying vec3 waterUv;
      uniform float waterClock;
    `+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float bank=smoothstep(.54,1.0,waterUv.y);
      float wave=sin(waterUv.x*10.0+sin(waterUv.z*4.1+waterUv.x*.6)*1.9-waterClock*2.8);
      float foam=smoothstep(.72,.96,wave)*(1.0-.55*bank);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.44,.85,.95),.73*bank);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.88,.98,1.0),.60*foam);
      diffuseColor.a *= 1.0-smoothstep(.88,1.0,waterUv.y);`);
  };
  const water=new T.Mesh(geometry,material);
  water.name='Soleira e Bosque: lâmina d’água';
  return water;
}

export function dressWaterWheel(parent, paint, floor, registerSolid) {
  const wheel = new T.Group();
  wheel.name='Soleira:Roda';
  wheel.position.set(-1.28,floor(-1.28,13)+.90,13);
  parent.add(wheel);
  const shape = [];
  const color = new T.Color();
  function add(geometry, tint, x, y, z){
    geometry.translate(x,y,z);
    color.set(tint);
    const count=geometry.attributes.position.count;
    const pigments=new Float32Array(count*3);
    for(let i=0;i<count;i++)color.toArray(pigments,i*3);
    geometry.setAttribute('color',new T.BufferAttribute(pigments,3));
    shape.push(geometry);
  }
  function finish(root,name){
    const geometry=mergeGeometries(shape);
    for(const part of shape)part.dispose();
    shape.length=0;
    const mesh=new T.Mesh(geometry,paint.toon('#ffffff',{vertexColors:true}));
    mesh.name=name;
    mesh.receiveShadow=true;
    root.add(mesh);
    return mesh;
  }
  for(const z of [-.23,.23]){
    add(new T.TorusGeometry(.85,.057,6,30),'#aa6c43',0,0,z);
    for(let i=0;i<4;i++){
      const a=i*Math.PI/4;
      add(new T.BoxGeometry(.077,1.63,.078).rotateZ(a),'#bd8854',0,0,z);
    }
  }
  add(new T.CylinderGeometry(.135,.135,.61,12).rotateX(Math.PI/2),'#d37a53',0,0,0);
  for(let i=0;i<12;i++){
    const a=i*Math.PI*2/12;
    add(new T.BoxGeometry(.14,.265,.53).rotateZ(a),i%2?'#53b5a9':'#e7ad6e',
      Math.cos(a)*.86,Math.sin(a)*.86,0);
  }
  paint.outline(finish(wheel,'Soleira:Aros e pás'),1.35);

  for(const side of [-1,1]){
    const z=13+side*.57;
    for(const leg of [-1,1]){
      add(new T.BoxGeometry(.13,1.05,.13).rotateZ(leg*.40),'#9e6c46',
        -1.28+leg*.23,wheel.position.y-.43,z);
    }
    add(new T.BoxGeometry(.42,.12,.21),'#be8b5a',-1.28,wheel.position.y-.08,z);
  }
  add(new T.CylinderGeometry(.057,.057,1.30,10).rotateX(Math.PI/2),'#704c37',
    -1.28,wheel.position.y,13);
  for(const x of [-1.84,-.92]){
    add(new T.BoxGeometry(.13,.33,5.64),'#ad7750',x,.173,11.17);
  }
  if(registerSolid){
    const span=new T.BoxGeometry(1,1,1);
    registerSolid('Soleira:Calha',span,new T.Matrix4().makeScale(1.05,.4,5.64).setPosition(-1.38,.17,11.17));
    registerSolid('Soleira:Roda',span,new T.Matrix4().makeScale(1.9,1,.90).setPosition(-1.28,.50,13));
  }
  for(const z of [8.85,10.30,11.68]){
    add(new T.BoxGeometry(1.06,.14,.17),'#dba775',-1.38,.117,z);
  }
  finish(parent,'Soleira:Cavaletes e bordas da calha');
  return wheel;
}
