import * as T from '/vendor/three/three.module.min.js';
import { smoothstep } from '../forest/navigation.mjs';
import { randomSequence } from './landscape-art.mjs';

const themes={
  praia:{color:'#ffcf7d',particle:0},
  dinossauros:{color:'#ffd78c',particle:1},
  inventores:{color:'#bcdeff',particle:2},
};

export function createDiscoveries(data,shape){
  const group=new T.Group(), theme=themes[data.world], marks=new Map();
  const ringGeometry=new T.RingGeometry(.83,1,28).rotateX(-Math.PI/2);
  for(const place of data.layout.places.filter(p=>p.collect||p.inspect)){
    const y=shape.height(place.x,place.z);
    const material=new T.MeshBasicMaterial({color:place.cue??theme.color,transparent:true,opacity:.6,depthWrite:false,side:T.DoubleSide});
    const ring=new T.Mesh(ringGeometry,material);
    ring.position.set(place.x,y+.06,place.z);
    ring.visible=false;
    group.add(ring);
    marks.set(place.id,{place,ring,y,done:false});
  }
  const density=64, random=randomSequence(741);
  const origins=new Float32Array(density*3), phase=new Float32Array(density);
  for(let i=0;i<density;i++){
    const angle=i*2.39996, radius=.24+random();
    origins.set([Math.sin(angle)*radius,random(),Math.cos(angle)*radius],i*3);
    phase[i]=random();
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(origins,3));
  geometry.setAttribute('phase',new T.BufferAttribute(phase,1));
  const material=new T.ShaderMaterial({
    transparent:true,depthWrite:false,
    uniforms:{elapsed:{value:0}, tint:{value:new T.Color(theme.color)}, scale:{value:1}, kind:{value:theme.particle}, renderScale:{value:1}},
    vertexShader:`uniform float elapsed,scale,renderScale; attribute float phase; varying float alpha,tone;
      void main(){float t=clamp(elapsed-phase*.25,0.,2.0);
        vec3 p=vec3(position.xz*(.25+t*.85)*scale,0.).xzy;
        p.y=(1.1+phase)*t*scale-.49*t*t+position.y*.21;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp((5.+phase*7.)*scale*renderScale*10./max(1.,-mv.z),3.,22.);
        alpha=(1.-smoothstep(.62,1.72,t)) * smoothstep(0.,.14,t);
        tone=phase;
      }`,
    fragmentShader:`uniform vec3 tint; uniform float kind; varying float alpha,tone;
      void main(){vec2 p=abs(gl_PointCoord-.5);
        float r=kind<.5?max(p.x,p.y)*1.09+min(p.x,p.y)*2.6:kind<1.5?length(p):p.x+p.y;
        float a=(1.-smoothstep(.32,.50,r))*alpha;
        if(a<.018)discard;
        gl_FragColor=vec4(mix(tint,vec3(1.,.94,.80),tone*.73),a);
        #include <colorspace_fragment>
      }`,
  });
  const burst=new T.Points(geometry,material);
  burst.frustumCulled=false;
  burst.visible=false;
  group.add(burst);
  let last=null, start=-Infinity, low=false;
  return {
    group,
    setEconomy(value){low=value;},
    progress(values){for(const [id,mark] of marks)mark.done=values.includes(id);},
    play(place,time,x=place.x,z=place.z){
      const mark=marks.get(place.id);
      if(!mark)return;
      last=mark;start=time;
      material.uniforms.tint.value.set(place.cue??theme.color);
      material.uniforms.scale.value=place.requires?1.43:1;
      burst.position.set(x,shape.height(x,z)+.45,z);
    },
    tick(time,still,player){
      const duration=time-start;
      burst.visible=!still&&duration>=0&&duration<2;
      if(burst.visible){
        geometry.setDrawRange(0,low?38:density);
        material.uniforms.elapsed.value=duration;
      }
      for(const mark of marks.values()){
        const {place,ring,done}=mark;
        const distance=Math.hypot(player.x-place.x,player.z-place.z);
        ring.visible=distance<15&&(!!place.collect||(last===mark&&duration<1.8));
        if(!ring.visible)continue;
        const wave=still?0:Math.sin(time*2.7+place.x)*.10;
        const visit=!still&&last===mark?1-smoothstep(duration,.2,1.85):0;
        ring.scale.setScalar((place.requires?1.21:.61)+wave*.38+visit*.85);
        ring.material.opacity=(done?.72:.43)+wave+visit*.2;
      }
    },
  };
}
