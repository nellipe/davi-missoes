import * as T from '/vendor/three/three.module.min.js';
import { smoothstep } from '../forest/navigation.mjs';

export function randomSequence(seed){
  return ()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
}

function surfacePattern(world){
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=256;
  const brush=canvas.getContext('2d'),random=randomSequence(413);
  brush.fillStyle='#f9f7f2';
  brush.fillRect(0,0,256,256);
  if(world==='inventores'){
    brush.fillStyle='#d4cfd2';
    for(let y=0;y<256;y+=32){
      brush.fillRect(0,y,256,2);
      for(let x=y%64===0?0:32;x<256;x+=64)brush.fillRect(x,y,2,32);
      for(let x=y%64===0?0:-32;x<256;x+=64){
        brush.fillStyle=['#eee8e1','#f8f4ed','#f3edea','#f0e8eb'][Math.floor(random()*4)];
        brush.fillRect(x+2,y+2,62,30);
      }
      brush.fillStyle='#d4cfd2';
    }
  }else{
    const pigments=world==='praia'?['#e3ccb0','#ebddc5','#fdf9ee']:['#ddd0b6','#e2d8bf','#efe3cc'];
    for(let i=0;i<1100;i++){
      brush.fillStyle=pigments[i%3];
      brush.fillRect(random()*256,random()*256,1+random()*2.1,1+random()*1.05);
    }
  }
  const map=new T.CanvasTexture(canvas);
  map.wrapS=map.wrapT=T.RepeatWrapping;
  map.colorSpace=T.SRGBColorSpace;
  return map;
}

export function makeGround(data,shape){
  const {world,layout,map:{bounds:[xmin,xmax,zmin,zmax]}}=data;
  const beach=world==='praia',city=world==='inventores';
  const land=new T.PlaneGeometry(xmax-xmin+4,zmax-zmin+4,171,85).rotateX(-Math.PI/2)
    .translate((xmax+xmin)/2,0,(zmax+zmin)/2);
  const points=land.attributes.position,uv=land.attributes.uv,pigments=new Float32Array(points.count*3);
  const base=new T.Color(layout.ground),pathColor=new T.Color(layout.path),edge=new T.Color(layout.edge);
  const verge=new T.Color(beach?'#c5c792':city?'#8e819b':'#748449');
  const shore=new T.Color('#d8ac7d'),street=new T.Color('#b695a3');
  const color=new T.Color();
  for(let i=0;i<points.count;i++){
    const x=points.getX(i),z=points.getZ(i),d=shape.coast(x,z), p=shape.path(x,z);
    const y=shape.height(x,z,d);
    points.setY(i,y);
    uv.setXY(i,x/(city?2.65:3.35),z/(city?2.65:3.35));
    const broad=(Math.sin(x*.28-z*.41)+Math.cos(x*.49+z*.17)+2)*.25;
    const small=(Math.sin(x*1.18+z*1.31)+Math.cos(x*.9-z*1.9)+2)*.25;
    color.copy(base);
    if(city){
      color.lerp(edge,.33*broad);
      const plaza=Math.min(Math.max(Math.abs(x-11)/6.2,Math.abs(z-4)/4.25),Math.max(Math.abs(x-39)/4.9,Math.abs(z-2)/4.2));
      color.lerp(pathColor,(1-smoothstep(plaza,.87,1.08))*.71);
      color.lerp(street,(1-smoothstep(p,.98,1.78))*.85);
      const curb=smoothstep(p,1.1,1.36)*(1-smoothstep(p,1.57,1.94));
      color.lerp(pathColor,.66*curb);
    }else if(beach){
      color.lerp(verge,smoothstep(y,.18,.64)*(.33+.46*broad));
      color.lerp(shore,(1-smoothstep(d,.45,2.8))*.74);
      color.lerp(pathColor,(1-smoothstep(p,.49,1.48))*.67);
    }else{
      color.lerp(verge,.16+.57*broad);
      color.lerp(edge,smoothstep(y,.35,1.26)*(.39+.43*small));
      color.lerp(pathColor,(1-smoothstep(p,.44,1.43))*.90);
    }
    color.multiplyScalar(.92+.085*small+.03*broad).toArray(pigments,i*3);
  }
  land.setAttribute('color',new T.BufferAttribute(pigments,3));
  land.computeVertexNormals();
  const ground=new T.Mesh(land,new T.MeshStandardMaterial({vertexColors:true,map:surfacePattern(world),roughness:.94}));
  ground.receiveShadow=true;
  return ground;
}

export function makeWater(data,shape){
  const {layout,map:{bounds:[xmin,xmax,zmin,zmax]}}=data;
  const width=144,height=72, pixels=new Uint8Array(width*height);
  for(let j=0;j<height;j++)for(let i=0;i<width;i++){
    const x=xmin+i/(width-1)*(xmax-xmin),z=zmin+j/(height-1)*(zmax-zmin);
    pixels[j*width+i]=Math.round(255*T.MathUtils.clamp((shape.coast(x,z)+4)/8,0,1));
  }
  const shore=new T.DataTexture(pixels,width,height,T.RedFormat);
  shore.magFilter=shore.minFilter=T.LinearFilter;
  shore.needsUpdate=true;
  const water=new T.Mesh(new T.PlaneGeometry(170,120).rotateX(-Math.PI/2),new T.ShaderMaterial({
    uniforms:{tint:{value:new T.Color(layout.waterColor)},sky:{value:new T.Color(layout.sky)},clock:{value:0},shore:{value:shore},
      shoreBounds:{value:new T.Vector4(xmin,zmin,xmax-xmin,zmax-zmin)},surf:{value:data.world==='praia'?1:.30}},
    vertexShader:`varying vec3 p; void main(){p=(modelMatrix*vec4(position,1.)).xyz;
      gl_Position=projectionMatrix*viewMatrix*vec4(p,1.); }`,
    fragmentShader:`uniform vec3 tint,sky; uniform float clock,surf; uniform vec4 shoreBounds; uniform sampler2D shore; varying vec3 p;
      void main(){vec2 pos=p.xz, uv=(pos-shoreBounds.xy)/shoreBounds.zw;
        float within=step(0.,uv.x)*step(0.,uv.y)*step(uv.x,1.)*step(uv.y,1.);
        float d=mix(-4.,texture2D(shore,uv).r*8.-4.,within);
        float ripple=sin(pos.y*5.3+sin(pos.x*1.28)+clock*1.3)+.48*sin(pos.x*3.6-pos.y*2.7-clock*.85);
        float glints=smoothstep(1.12,1.46,ripple)*(.22+.78*smoothstep(.08,1.,sin(pos.x*.46+pos.y*.21)));
        float wave=sin(clock*2.2+pos.x*.42+pos.y*.38);
        float foam=(1.-smoothstep(.038,.145,abs(d+.80-wave*.21)))*(.48+.51*glints);
        foam+=.26*(1.-smoothstep(.02,.10,abs(d+1.50-wave*.19)));
        vec3 shallow=mix(tint,vec3(.20,.69,.52),.62*smoothstep(-3.1,.03,d)*surf);
        vec3 sea=shallow*(.92+sin(pos.x*.52+pos.y*.29)*.055)+glints*vec3(.21,.33,.31);
        sea=mix(sea,vec3(.83,.98,.85),foam*surf*.92);
        float mist=smoothstep(15.,54.,distance(p,cameraPosition));
        gl_FragColor=vec4(mix(sea,sky,mist*.95),1.);
        #include <colorspace_fragment>
      }`,
  }));
  water.position.set((xmin+xmax)/2,-.43,0);
  return water;
}
