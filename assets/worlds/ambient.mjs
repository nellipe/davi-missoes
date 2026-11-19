import * as T from '/vendor/three/three.module.min.js';
import { randomSequence } from './landscape-art.mjs';

export function atmosphere(data,shape){
  const group=new T.Group(), bird=data.world==='praia';
  if(bird){
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute([-.41,0,0,0,.07,0,-.12,0,.13],3));
    const wings=new T.MeshBasicMaterial({color:'#fff8dc',side:T.DoubleSide});
    const flock=[];
    for(let i=0;i<6;i++){
      const body=new T.Group(), left=new T.Mesh(geometry,wings),right=new T.Mesh(geometry,wings);
      right.rotation.y=Math.PI;
      body.add(left,right);
      body.scale.setScalar(.86+i*.036);
      group.add(body);
      flock.push([body,left,right]);
    }
    return {
      group,
      tick(time,still,low){
        for(const [i,[body,left,right]] of flock.entries()){
          body.visible=i<(low?3:6);
          const t=(still?0:time*.19)+i*.34;
          const home=i<3?[4,-10]:[28,2];
          body.position.set(home[0]+Math.sin(t)*5.4,4.0+i*.21+Math.cos(t*1.6)*.38,home[1]+Math.cos(t)*3.4);
          body.rotation.y=Math.atan2(Math.cos(t)*5.4,-Math.sin(t)*3.4);
          left.rotation.z=right.rotation.z=still?.12:Math.sin(time*6.7+i)*.53;
        }
      },
    };
  }
  const city=data.world==='inventores';
  const sources=city?data.layout.props.filter(([name])=>name==='industrial'||name==='workshop-red'):[[null,8,3],[null,17,-5],[null,38,-4.5],[null,30,7]];
  const random=randomSequence(313), positions=new Float32Array(sources.length*6*3), phases=[];
  const geometry=new T.BufferGeometry();
  const attribute=new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage);
  geometry.setAttribute('position',attribute);
  const material=new T.ShaderMaterial({
    transparent:true,depthWrite:false, uniforms:{tint:{value:new T.Color(city?'#fff1db':'#fff6ae')},size:{value:city?.48:.14}},
    vertexShader:`uniform float size;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(440.*size/max(1.,-mv.z),1.,38.);}`,
    fragmentShader:`uniform vec3 tint;void main(){float a=(1.-smoothstep(.02,.5,length(gl_PointCoord-.5)))*.46; if(a<.02)discard;gl_FragColor=vec4(tint,a);
      #include <colorspace_fragment>
    }`,
  });
  const motes=new T.Points(geometry,material);
  motes.frustumCulled=false;
  group.add(motes);
  sources.forEach(([name,x,z],n)=>{
    const y=shape.height(x,z)+(city?(name==='industrial'?1.35:3.4):.44);
    for(let i=0;i<6;i++)phases.push({x,y,z,offset:random()+i*.16+n*.03,a:random()*6.28});
  });
  return {
    group,
    tick(time,still,low){
      motes.visible=!still;
      if(still)return;
      geometry.setDrawRange(0,low?Math.ceil(phases.length*.66):phases.length);
      phases.forEach(({x,y,z,offset,a},i)=>{
        const t=(time*(city?.37:.15)+offset)%1;
        attribute.setXYZ(i,x+Math.sin(a+t*2)*t*(city?.72:2.2),y+t*(city?1.35:.88),z+Math.cos(a+t*2)*t*(city?.47:1.42));
      });
      attribute.needsUpdate=true;
    },
  };
}
