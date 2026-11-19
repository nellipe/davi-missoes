import * as T from '/vendor/three/three.module.min.js';
import { mergeGeometries } from '/vendor/three/addons/utils/BufferGeometryUtils.js';
import { recanto, visibleSpot } from './recanto.mjs';

export function buildHedgehog(floor, paint) {
  const group = new T.Group(), head = new T.Group(), eyes = new T.Group();
  group.name = 'Recanto:Ouriço';
  group.add(head);
  head.position.set(0, .40, .31);
  head.add(eyes);
  const sphere = new T.SphereGeometry(1, 12, 8);
  const cone = new T.ConeGeometry(1, 1, 6).translate(0, .5, 0);
  const up = new T.Vector3(0, 1, 0), direction = new T.Vector3();
  const quillTurn = new T.Quaternion();
  function shape(geometry, color, [x,y,z], [sx,sy,sz], turn) {
    const part = geometry.clone().scale(sx,sy,sz);
    if (turn) part.applyQuaternion(turn);
    part.translate(x,y,z);
    const tint = new T.Color(color), colors = [];
    for (let i=0;i<part.attributes.position.count;i++) colors.push(tint.r,tint.g,tint.b);
    part.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    return part;
  }
  const ball = (color, center, size) => shape(sphere,color,center,size);
  function attach(parent, parts, stroke) {
    const geometry = mergeGeometries(parts);
    for (const part of parts) part.dispose();
    const mesh = new T.Mesh(geometry, paint.toon('#ffffff',{vertexColors:true}));
    parent.add(mesh);
    if (stroke) paint.outline(mesh, stroke);
  }
  const body = [ball('#a56c48',[0,.409,-.10],[.49,.385,.57])];
  const fur = ['#63422f','#8d5138','#713e33'];
  for (const [row,count] of [[0,11],[1,10],[2,8],[3,5]]) {
    const layer = .17+row*.28;
    for (let i=0;i<count;i++) {
      const a = Math.PI*.08+Math.PI*1.84*(i+.5)/count+(row%2?.14:0);
      const x = Math.sin(a)*Math.cos(layer), z = Math.cos(a)*Math.cos(layer);
      if (z>.34) continue;
      direction.set(x,Math.sin(layer)+.24,z).normalize();
      quillTurn.setFromUnitVectors(up,direction);
      const base=.093+(i%3)*.009, length=.23+(i%4)*.032;
      body.push(shape(cone,fur[(i+row)%fur.length],
        [x*.43,.41+Math.sin(layer)*.36,z*.51-.13],[base,length,base],quillTurn));
    }
  }
  for (const side of [-1,1]) {
    body.push(ball('#805137',[side*.26,.075,.23],[.135,.071,.16]));
    body.push(ball('#805137',[side*.295,.077,-.34],[.120,.071,.14]));
  }
  attach(group,body,1.8);
  const face = [
    ball('#ffdcad',[0,0,.02],[.35,.277,.30]),
    ball('#fff0ce',[0,-.073,.255],[.204,.146,.204]),
    ball('#34264a',[0,-.012,.442],[.083,.061,.056]),
    ball('#ffdfc9',[.023,.011,.486],[.021,.013,.009]),
  ];
  const eyeParts=[];
  for (const side of [-1,1]) {
    face.push(ball('#d79465',[side*.262,.228,-.044],[.094,.108,.067]));
    face.push(ball('#ffb4a1',[side*.268,.231,.009],[.055,.066,.021]));
    face.push(ball('#ffa299',[side*.231,-.063,.238],[.078,.036,.029]));
    eyeParts.push(ball('#fff8e7',[side*.145,.070,.278],[.084,.099,.045]));
    eyeParts.push(ball('#34264a',[side*.14,.069,.316],[.047,.068,.029]));
    eyeParts.push(ball('#ffffff',[side*.14-.014,.097,.340],[.019,.022,.012]));
  }
  attach(head,face,1.5);
  attach(eyes,eyeParts,0);
  sphere.dispose();
  cone.dispose();

  const [x,z] = recanto.log, yaw = recanto.openingYaw;
  let progress=0, sidestepX=0, sidestepZ=0;
  function tick(dt, time, still, camera, approaching, hero, buddy, reachable) {
    progress=still?Number(approaching):T.MathUtils.clamp(progress+dt*(approaching?1.2:-.8),0,1);
    const slide=T.MathUtils.smoothstep(progress,0,1);
    const step=T.MathUtils.lerp(.35,2.0,slide);
    const baseX=x+Math.sin(yaw)*step,baseZ=z+Math.cos(yaw)*step;
    const [u,v]=reachable&&slide>.77?visibleSpot(baseX,baseZ,camera,hero,buddy,reachable):[baseX,baseZ];
    sidestepX=still?u-baseX:T.MathUtils.damp(sidestepX,u-baseX,10,dt);
    sidestepZ=still?v-baseZ:T.MathUtils.damp(sidestepZ,v-baseZ,10,dt);
    const px=baseX+sidestepX,pz=baseZ+sidestepZ;
    group.visible=progress>.12;
    group.position.set(px,floor(px,pz)+.20*(1-slide)+.105*Math.sin(Math.PI*slide),pz);
    group.rotation.y=yaw;
    const faceCamera=Math.atan2(camera.x-px,camera.z-pz)-yaw;
    head.rotation.y=T.MathUtils.clamp(Math.atan2(Math.sin(faceCamera),Math.cos(faceCamera)),-.75,.75)*slide;
    head.rotation.x=still?0:.065*Math.sin(time*3)*slide;
    group.rotation.z=still?0:.07*Math.sin(progress*15)*Math.sin(Math.PI*slide);
    eyes.visible=still||time%4.3<4.16;
  }
  return {group,head,tick, get progress(){return progress;}};
}
