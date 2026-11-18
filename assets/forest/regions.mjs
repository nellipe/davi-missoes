import * as T from '/vendor/three/three.module.min.js';

// Shared silhouettes from the Bosque library, composed as separate groups within the same terrain.
export function installRegions(root, library, layout, floor, edge) {
  const themes=[
    {x:-5,z:11,tree:'Amieiro',stone:'#a8a692',foliage:'#9fb18a',seed:7},
    {x:-1,z:-10,tree:'Carvalho',stone:'#849a99',foliage:'#859e98',seed:17},
    {x:10,z:-11,tree:'Carvalho',stone:'#b19b86',foliage:'#b0ac7e',seed:27},
    {x:18,z:-5,tree:'Amieiro',stone:'#95a6a7',foliage:'#b8caaa',seed:37},
    {x:13,z:8,tree:'Amieiro',stone:'#9fa99b',foliage:'#a6b995',seed:47},
  ];
  const stamp=new T.Object3D();
  const wood=new T.BoxGeometry(1,1,1);
  const leaf=new T.OctahedronGeometry(1);
  const metalRing=new T.TorusGeometry(1,.11,7,24);
  const materials=new Map();
  const objects=[];
  const occluders=[];
  const hiddenMatrix=new T.Matrix4().makeScale(0,0,0);
  const line=new T.Vector3(), offset=new T.Vector3();
  let boatStart=0, carvingUntil=-1;
  function material(color) {
    if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.85}));
    return materials.get(color);
  }
  function mesh(parent,geometry,color,x,y,z,sx,sy,sz) {
    const m=new T.Mesh(geometry,material(color));
    m.position.set(x,y,z);
    m.scale.set(sx,sy,sz);
    parent.add(m);
    return m;
  }
  function block(parent,color,x,z,w,h,d,lift=0) {
    return mesh(parent,wood,color,x,floor(x,z)+lift+h/2,z,w,h,d);
  }
  function stamps(parent, model, color, positions) {
    if(!positions.length)return;
    const source=library.getObjectByName(model);
    const paint=source.material.clone();
    paint.color.set(color);
    const batch=new T.InstancedMesh(source.geometry,paint,positions.length);
    for(const [i,[x,z,sx,sy,sz,turn]] of positions.entries()){
      stamp.position.set(x,floor(x,z),z);
      stamp.scale.set(sx,sy,sz);
      stamp.rotation.y=turn;
      stamp.updateMatrix();
      batch.setMatrixAt(i,stamp.matrix);
      if(/_Tronco|_Copa/.test(model))occluders.push({
        parent,batch,index:i,matrix:stamp.matrix.clone(),hidden:false,
        center:new T.Vector3(x,stamp.position.y+(model.endsWith('_Copa')?4.85:2.7)*sy,z),
        radius:(model.endsWith('_Copa')?2.35:1.95)*sy,
      });
    }
    batch.receiveShadow=true;
    parent.add(batch);
  }
  for(const theme of themes) {
    const group=new T.Group(), detail=new T.Group();
    root.add(group);
    group.add(detail);
    let seed=theme.seed;
    const rnd=()=> (seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;
    const trees=[], rocks=[], ferns=[], flowers=[];
    for(let i=0;i<84;i++){
      const x=theme.x+(rnd()-.5)*13,z=theme.z+(rnd()-.5)*10;
      if(x<layout.bounds[0]+.35||z< -14.5|| (x>-11&&x<9&&z> -4.2&&z<9.8))continue;
      const rim=edge(x,z), a=rnd()*6.28, s=.48+rnd()*.58;
      if(rim>1.55&&i<30)trees.push([x,z,s,s,s,a]);
      else if(rim>.7&&i<46)rocks.push([x,z,s,s*.64,s,a]);
      else if(rim>.32&&rim<1.8){
        ferns.push([x,z,s,s,s,a]);
        if(i%2)flowers.push([x+.16,z-.26,s,s,s,a]);
      }
    }
    stamps(group,theme.tree+'_Tronco','#e8decb',trees);
    stamps(group,theme.tree+'_Copa',theme.foliage,trees);
    stamps(group,'Ardosia',theme.stone,rocks);
    stamps(group,'Samambaia','#c5d49c',ferns);
    stamps(detail,'Flores','#fff1d8',flowers);
    objects.push({group,detail,...theme});
  }
  const [margin,gorge,patio,copa,returnPath]=objects.map(item=>item.group);

  // The strip of blue cloth repeats from the free bank to the low wheel.
  function pennant(parent,x,z,blue=true) {
    block(parent,'#735843',x,z,.085,1.72,.085);
    const cloth=block(parent,blue?'#6bacc0':'#ead2a0',x+.21,z,.44,.39,.035,1.19);
    cloth.rotation.z=-.12;
  }
  for(const [x,z] of [[-10.1,6.25],[-7.3,9.3],[-4.2,12.4],[-.4,15.72]])pennant(margin,x,z);
  const crossing=[[-9.65,8.27,.62,.47,.69,1],[-8.18,8,.80,.71,.57,2],[-4.3,10.45,.88,.72,.75,-1],
    [2,-8.45,1.20,1.01,.91,.40],[4.7,-8.85,1.45,1.54,1,-.34],[6.3,-8.88,.9,1.52,1.14,.21]];
  stamps(gorge,'Ardosia','#aab4ae',crossing.slice(3));
  stamps(margin,'Ardosia','#bcc2aa',crossing.slice(0,3));
  // Terracotta worktable beside a blue fabric awning, with a recognizable utensil wall.
  for(const [x,z] of [[8.9,-12.54],[11.15,-12.54],[8.9,-10.91],[11.15,-10.91]])
    block(patio,'#865a42',x,z,.14,2.36,.14);
  const awning=block(patio,'#897ba6',10.03,-11.82,2.65,.14,1.95,2.17);
  awning.rotation.x=.19;
  for(let i=0;i<5;i++)block(patio,i%2?'#c8926d':'#dcb184',9.06+i*.48,-10.89,.46,.28,.085,1.96);
  for(const x of [9.39,10.34])block(patio,'#79563c',x,-12.24,.16,.85,.49);
  block(patio,'#c29362',9.87,-12.24,1.58,.15,.71,.81);
  for(let i=0;i<3;i++){
    const tool=block(patio,i===1?'#90a6a3':'#e1b467',9.38+i*.34,-12.20,.13,.14,.27,.99);
    tool.rotation.y=i*.64;
  }
  const bird=new T.Group();
  bird.position.set(11.02,floor(11.02,-10.35)+.63,-10.35);
  patio.add(bird);
  mesh(bird,leaf,'#d1aa74',0,.08,0,.42,.24,.17).rotation.z=.3;
  mesh(bird,leaf,'#f2ce8e',.27,.26,-.12,.25,.20,.12).rotation.z=.72;
  block(patio,'#b98e62',11.02,-10.35,.09,.68,.12);
  for(const [x,z] of [[14.2,-10.77],[16.55,-8.85],[19.22,-5.96],[19.91,-2.70],[16.91,5.4],[11.8,10.25],[6.87,13.75]])
    pennant(x>15&&z<-1?copa:returnPath,x,z,false);

  // A source trough and the high wheel repeat the shape and leaf color seen at the Soleira.
  const headwater=new T.Group();
  copa.add(headwater);
  const crownX=19.42,crownZ=-6.43, crownY=floor(crownX,crownZ);
  const wheel=new T.Group();
  wheel.position.set(crownX,crownY+1.22,crownZ);
  headwater.add(wheel);
  mesh(wheel,metalRing,'#ae734b',0,0,0,1.12,1.12,.7);
  mesh(wheel,metalRing,'#dfb97d',0,0,.19,.97,.97,.55);
  for(let i=0;i<10;i++){
    const a=i*Math.PI/5;
    mesh(wheel,wood,'#966847',0,0,0,.08,2.03,.12).rotation.z=a;
    mesh(wheel,leaf,i%2?'#cdb762':'#b2c17d',1.04*Math.cos(a),1.04*Math.sin(a),-.11,.22,.31,.23).rotation.z=a;
  }
  for(const x of [18.23,20.55])block(headwater,'#967650',x,-6.43,.21,1.42,.28);
  const course=[[18.90,-6.13],[18.55,-6.86],[17.6,-7.49],[16.6,-8.35],[15.43,-9.16],[13.65,-9.59],[11.38,-10.04]];
  const coursePoints=course.map(([x,z])=>new T.Vector3(x,floor(x,z)+.36,z));
  const current=new T.CatmullRomCurve3(coursePoints);
  mesh(headwater,new T.TubeGeometry(current,24,.19,5,false),'#71c6be',0,0,0,1,1,1);
  mesh(headwater,new T.TubeGeometry(current,24,.27,5,false).translate(0,-.14,0),'#ad8259',0,0,0,1,1,1);
  const boat=mesh(headwater,leaf,'#f2c569',0,0,0,.19,.064,.38);
  mesh(headwater,leaf,'#8ed4cc',19.66,crownY+2.22,-6.75,.19,.66,.19).rotation.z=-.38;
  for(const [x,z,angle] of [[17.73,-6.76,.26],[18.15,-4.46,-.6],[19.86,-4.62,-1.2]]){
    const board=block(copa,'#bf9d76',x,z,1.22,.12,.45,.15);
    board.rotation.y=angle;
  }
  for(const [x,z] of [[18.6,1.22],[18.0,3.0],[17.3,4.7]])block(returnPath,'#b4936b',x,z,1.3,.11,.32);
  const setEconomy=(low)=>{for(const item of objects)item.detail.visible=!low;};
  return {
    setEconomy,
    interact(id,t){
      if(id==='source')boatStart=t;
      if(id==='carving')carvingUntil=t+1.6;
    },
    tick(t,still,hero,camera){
      for(const item of objects)item.group.visible=Math.hypot(hero.x-item.x,hero.z-item.z)<17;
      line.copy(hero).sub(camera).y+=1;
      const depth=line.length();
      line.divideScalar(depth);
      for(const item of occluders) {
        if(!item.parent.visible)continue;
        offset.copy(item.center).sub(camera);
        const along=offset.dot(line);
        const hide=along>-item.radius&&along<depth-.25&&
          offset.lengthSq()-along*along<(item.radius+.75)**2;
        if(hide!==item.hidden){
          item.hidden=hide;
          item.batch.setMatrixAt(item.index,hide?hiddenMatrix:item.matrix);
          item.batch.instanceMatrix.needsUpdate=true;
        }
      }
      if(copa.visible){
        wheel.rotation.z=still?-.35:-t*.62;
        const phase=still?.34:((t-boatStart)%5)/5;
        boat.position.copy(current.getPointAt(phase)).y+=.19;
        const travel=current.getTangentAt(phase);
        boat.rotation.y=Math.atan2(travel.x,travel.z);
      }
      if(patio.visible)bird.rotation.y=still?.36:.23+Math.max(0,carvingUntil-t)*.32;
    }
  };
}
