import {advance,route,segmentClear} from './navigation.mjs';

const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

export function createCompanion(valid,bounds) {
  let path=[],planned=null,retry=0,stalled=0,separated=0,phase=0,departing=null;
  let recoveries=0,replans=0;
  return {
    update(position,hero,goal,dt,visible){
      retry-=dt;
      const distance=gap(position,hero);
      separated=distance>8?separated+dt:0;
      if(phase>0){
        phase=Math.max(0,phase-dt);
        return {position,scale:1-phase/.18,relocated:false};
      }
      if(departing!==null||stalled>2.4||separated>5||!valid(position.x,position.z)){
        // Stay beside a reachable part of the hero's floor. Fade a visible
        // departure before relocating so no movement crosses the obstacle.
        const landing=valid(goal.x,goal.z)&&segmentClear(hero,goal,valid)?goal:hero;
        if((departing??0)<.22&&visible(position)&&valid(position.x,position.z)){
          departing=(departing??0)+dt;
          return {position,scale:Math.max(0,1-departing/.22),relocated:false};
        }
        path=[];planned=null;retry=0;stalled=0;separated=0;departing=null;phase=.18;recoveries++;
        return {position:{x:landing.x,z:landing.z},scale:0,relocated:true};
      }
      if(gap(position,goal)<.055){
        path=[];planned=null;stalled=0;
        return {position,scale:1,relocated:false};
      }
      if(path.length && gap(position,path[0])<.035)path.shift();
      if(retry<=0 && (!planned||gap(goal,planned)>.66||!path.length)){
        if(segmentClear(position,goal,valid))path=[goal];
        else { path=route(position,goal,valid,bounds,3600);replans++; }
        planned=goal;retry=path.length?.55:.85;
      }
      const target=path[0]??goal;
      const speed=distance>6?4.15:distance>2.5?3.25:2.45;
      const next=advance(position,{x:target.x-position.x,z:target.z-position.z},speed*dt,valid);
      const progressed=gap(next,target)<gap(position,target)-dt*.25;
      stalled=!progressed&&distance>1.6?stalled+dt:0;
      return {position:next,scale:1,relocated:false};
    },
    diagnostics(){return {replans,recoveries,waypoints:path.length};},
  };
}
