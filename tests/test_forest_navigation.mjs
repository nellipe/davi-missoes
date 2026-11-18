import test from 'node:test';
import assert from 'node:assert/strict';
import {walkable,terrainHeight,route,advance,segmentClear} from '../assets/forest/navigation.mjs';
import fs from 'node:fs';
const groups=JSON.parse(fs.readFileSync(new URL('../assets/forest/obstacles.json',import.meta.url)));
const obstacles=Object.values(groups).flat();
const valid=(x,z)=>walkable(x,z,['bridge'],obstacles);
test('the six landmark rocks use the horizontal axes of the rendered GLB',()=>{
  const glb=fs.readFileSync(new URL('../assets/forest/forest.glb',import.meta.url));
  const scene=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
  const rocks=scene.nodes.filter(n=>n.name?.startsWith('Mossy landmark'));
  assert.equal(rocks.length,6);
  for(const {translation:[x,,z]} of rocks){
    assert(groups.rocks.some(([a,b])=>Math.hypot(a-x,b-z)<.01));
    assert.equal(valid(x,z),false);
  }
  assert.equal(valid(6,5),true,'old mirrored rock blocked open ground');
});
test('routes reach every side through bridge without crossing water or cascade',()=>{
  assert.deepEqual(route({x:0,z:7.5},{x:-5.7,z:4.6},valid),[],'inside the workshop boulder');
  for(const goal of [{x:-5.7,z:3.6},{x:8.3,z:2.5},{x:-4,z:-4},{x:3.5,z:-6.1}]){
    const points=route({x:0,z:7.5},goal,valid);assert(points.length>0);let last={x:0,z:7.5};
    for(const p of points){assert(segmentClear(last,p,valid));last=p;}assert.deepEqual(last,goal);
  }
  assert.deepEqual(route({x:0,z:7.5},{x:0,z:-5.4},(x,z)=>walkable(x,z,[],obstacles)),[]);
});
test('large frame does not tunnel out of bounds, through river or tree',()=>{
  let p={x:0,z:7.5};
  for(let i=0;i<1000;i++){p=advance(p,{x:Math.sin(i*.1),z:Math.cos(i*.1)},.15,valid);assert(valid(p.x,p.z));}
  const blocked=advance({x:0,z:1},{x:0,z:-20},20,(x,z)=>walkable(x,z,[],obstacles));assert(blocked.z>=.7);
  assert.equal(valid(-9,-3),false);
});
test('surface uses exported triangle diagonal, not bilinear or an unrelated formula',()=>{
  const grid={n:1,bounds:[0,1,0,1],heights:[0,1,2,6]};
  assert.equal(terrainHeight(grid,.75,.25),2);
  assert.equal(terrainHeight(grid,.25,.75),2.5);
  const terrain=JSON.parse(fs.readFileSync(new URL('../assets/forest/navigation.json',import.meta.url)));
  assert(terrainHeight(terrain,0,.71)<0,'bank carve must be present in support height');
});
