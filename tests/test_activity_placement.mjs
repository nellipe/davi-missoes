import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createNavigation, route, segmentClear } from '../assets/forest/navigation.mjs';
import { activityGround, placeActivities, activityStatusLabel } from '../assets/forest/activity-placement.mjs';

const snapshot=spawnSync('python',['-c',
  'import json,forest as f,world_maps as w; print(json.dumps([f.FOREST,f.COLLISION,w.BOUNDS,w.LAYOUTS,w.COLLISIONS]))'],{encoding:'utf8'});
assert.equal(snapshot.status,0,snapshot.stderr);
const [forestMap,forestCollision,bounds,layouts,collisions]=JSON.parse(snapshot.stdout);
const worlds={forest:{map:forestMap,collision:forestCollision,spawn:{x:0,z:7.5},landmarks:[{x:0,z:.9},{x:8.3,z:1.5}],scenery:[]}};
for(const [id,layout] of Object.entries(layouts)){
  worlds[id]={map:{bounds},collision:collisions[id],spawn:layout.spawn,landmarks:layout.places,
    scenery:layout.props.map(([,x,z])=>({x,z}))};
}
const events=Array.from({length:20},(_,i)=>({id:i+1}));

for(const [world,layout] of Object.entries(worlds)){
  test(`${world} places a full calendar on safe, spaced terrain including after purchases`,()=>{
    const {map,collision,spawn,landmarks}=layout;
    const sector=(x,z)=>`${Math.floor(x/15)}:${Math.floor(z/10)}`;
    const ground=activityGround({...layout,sector});
    const options={world,date:'2026-11-19',spawn};
    const placed=placeActivities(ground,events,options);
    assert.equal(placed.length,20);
    assert(new Set(placed.map(p=>p.sector)).size>=3);
    assert.deepEqual(placeActivities(ground,events.slice().reverse(),options),placed);
    assert.deepEqual(placeActivities(ground,events.slice(0,12),options),placed.slice(0,12));
    for(const [index,point] of placed.entries()){
      assert(placed.slice(0,index).every(p=>Math.hypot(p.x-point.x,p.z-point.z)>=4));
      assert(landmarks.every(p=>Math.hypot(p.x-point.x,p.z-point.z)>=2.5));
    }
    for(const inventory of [[],['bridge','house','portal']]){
      const walkable=createNavigation(map,collision,inventory);
      for(const {x,z} of placed){
        const goal={x,z};
        const path=route(spawn,goal,walkable,map.bounds);
        assert.deepEqual(path.at(-1),goal);
        assert(path.every((next,i)=>segmentClear(i?path[i-1]:spawn,next,walkable)));
      }
    }
  });
}

test('dense calendars adapt spacing and never reuse an occupied coordinate',()=>{
  const grid=Array.from({length:30},(_,i)=>({x:i*.38,z:0,sector:'Clareira'}));
  const input=Array.from({length:40},(_,i)=>({id:i+1}));
  const points=placeActivities(grid,input,{world:'forest',date:'2026-11-19',spawn:{x:0,z:0}});
  assert.equal(points.length,30);
  assert.equal(new Set(points.map(p=>p.x)).size,points.length);
});

test('a completed activity takes precedence over its time window',()=>{
  assert.equal(activityStatusLabel({done:true,window:{state:'expired'}}),'Concluída');
  assert.equal(activityStatusLabel({window:{state:'open'}}),'Disponível');
  assert.equal(activityStatusLabel({window:{state:'upcoming'}}),'Mais tarde');
});
