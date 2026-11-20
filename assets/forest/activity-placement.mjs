import { createNavigation, ROUTE_STEP, ROUTE_DIRECTIONS, segmentClear } from './navigation.mjs';

const distance2=(a,b)=>(a.x-b.x)**2+(a.z-b.z)**2;
const DIRECTIONS=[[0,0],...ROUTE_DIRECTIONS];

export function activityGround({map,collision,spawn,landmarks,scenery=[],sector}){
  // Keep the signs accessible before purchases, and reserve every construction's
  // footprint so its later purchase cannot move a sign or close its route.
  const noPurchases={...collision,solids:collision.solids.map(([name,vertices])=>[name,vertices])};
  const valid=createNavigation(map,noPurchases,[]);
  const [xmin,xmax,zmin,zmax]=map.bounds;
  const left=Math.ceil(xmin/ROUTE_STEP),right=Math.floor(xmax/ROUTE_STEP);
  const top=Math.ceil(zmin/ROUTE_STEP),bottom=Math.floor(zmax/ROUTE_STEP);
  const width=right-left+1,depth=bottom-top+1;
  const reached=new Uint8Array(width*depth),queue=[];
  const position=(i,j)=>({x:i*ROUTE_STEP,z:j*ROUTE_STEP});
  function add(i,j,from){
    if(i<left||i>right||j<top||j>bottom)return;
    const index=(j-top)*width+i-left;
    if(reached[index])return;
    const point=position(i,j);
    if(segmentClear(from,point,valid)){
      reached[index]=1;
      queue.push({i,j,point});
    }
  }
  const startI=Math.round(spawn.x/ROUTE_STEP),startJ=Math.round(spawn.z/ROUTE_STEP);
  for(const [di,dj] of DIRECTIONS)add(startI+di,startJ+dj,spawn);
  for(let k=0;k<queue.length;k++){
    const {i,j,point}=queue[k];
    for(const [di,dj] of ROUTE_DIRECTIONS)add(i+di,j+dj,point);
  }

  const reserved=[...landmarks,spawn];
  return queue.flatMap(({point})=>{
    if(reserved.some(p=>distance2(p,point)<2.5**2)||scenery.some(p=>distance2(p,point)<1.05**2))return [];
    const room=ROUTE_DIRECTIONS.every(([i,j])=>segmentClear(point,{x:point.x+i*.58,z:point.z+j*.58},valid));
    if(!room)return [];
    return [{...point,sector:sector(point.x,point.z)}];
  });
}

function hash(value){
  let n=2166136261;
  for(const char of value)n=Math.imul(n^char.charCodeAt(0),16777619);
  return n>>>0;
}

export function placeActivities(ground,activities,{world,date,spawn}){
  if(!activities.length)return [];
  // IDs establish a stable assignment even when the calendar's order changes.
  const events=[...activities].sort((a,b)=>Number(a.id)-Number(b.id));
  const candidates=ground.map(point=>({point,distance:Infinity,tie:hash(`${world}/${date}/${point.x}/${point.z}`)}));
  const counts=new Map(),placements=[];
  const firstView={x:spawn.x-1.4,z:spawn.z-4};
  const separations=[4,3.5,3,2.5,2,1.5,1.1,ROUTE_STEP-.01];
  let threshold=0;
  for(const event of events){
    let best;
    while(!best&&threshold<separations.length){
      const min=separations[threshold]**2;
      for(const candidate of candidates){
        if(candidate.distance<min)continue;
        const count=counts.get(candidate.point.sector)??0;
        const score=placements.length?candidate.distance:-distance2(candidate.point,firstView);
        if(!best||count<best.count||(count===best.count&&(score>best.score||(score===best.score&&candidate.tie<best.candidate.tie))))
          best={candidate,count,score};
      }
      if(!best)threshold++;
    }
    if(!best)break;
    const {point}=best.candidate;
    counts.set(point.sector,best.count+1);
    placements.push({...point,activity:event});
    for(const candidate of candidates)candidate.distance=Math.min(candidate.distance,distance2(candidate.point,point));
  }
  return placements;
}

export function activityStatus(event){
  return event.done?'done':event.window?.state??'';
}

export function activityStatusLabel(event){
  return {done:'Concluída',open:'Disponível',upcoming:'Mais tarde',expired:'Encerrada'}[activityStatus(event)]??'Pendente';
}
