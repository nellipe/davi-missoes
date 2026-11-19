import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createNavigation, route, segmentClear } from '../assets/forest/navigation.mjs';
import { createCompanion } from '../assets/forest/companion.mjs';

const snapshot=spawnSync('python',['-c',
  'import json,world_maps as w; print(json.dumps([w.BOUNDS,w.LAYOUTS,w.COLLISIONS]))'],{encoding:'utf8'});
assert.equal(snapshot.status,0,snapshot.stderr);
const [bounds,layouts,collisions]=JSON.parse(snapshot.stdout);
const point=([x,z])=>({x,z});

for(const [key,layout] of Object.entries(layouts)){
  const collision=collisions[key];
  const walkable=createNavigation({bounds},collision,[]);
  test(`${key} connects both ends and every discovery without inventory`,()=>{
    const routeTo=goal=>{
      const steps=route(layout.spawn,goal,walkable,bounds);
      assert.deepEqual(steps.at(-1),goal);
      assert(steps.every((step,i)=>segmentClear(i?steps[i-1]:layout.spawn,step,walkable)));
    };
    routeTo(point(layout.paths[0][0]));
    routeTo(point(layout.paths[0].at(-1)));
    layout.places.forEach(({x,z})=>routeTo({x,z}));
    for(const [_,vertices] of collision.solids){
      const sum=vertices.reduce(([x,z],[a,b])=>[x+a,z+b],[0,0]);
      const [x,z]=sum.map(value=>value/vertices.length);
      assert(!walkable(x,z),'solid center must block walking');
    }
  });

  test(`${key} companion follows the player along a collision-safe route`,()=>{
    const player=layout.spawn;
    const follower=createCompanion(walkable,bounds);
    let buddy={...player};
    const goal=point(layout.paths[0].at(-1));
    const path=route(player,goal,walkable,bounds);
    let previous=player;
    for(const next of path){
      const ticks=Math.ceil(Math.hypot(next.x-previous.x,next.z-previous.z)/.06);
      for(let i=1;i<=ticks;i++){
        const position={x:previous.x+(next.x-previous.x)*i/ticks,z:previous.z+(next.z-previous.z)*i/ticks};
        const result=follower.update(buddy,position,position,.032,()=>true);
        buddy=result.position;
        assert(walkable(buddy.x,buddy.z));
      }
      previous=next;
    }
    assert(Math.hypot(buddy.x-goal.x,buddy.z-goal.z)<2.5);
  });
}
