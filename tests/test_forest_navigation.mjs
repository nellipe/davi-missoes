import test from 'node:test';
import assert from 'node:assert/strict';
import {createNavigation,terrainHeight,route,advance,segmentClear} from '../assets/forest/navigation.mjs';
import {createCompanion} from '../assets/forest/companion.mjs';
import {recanto,visibleSpot} from '../assets/forest/recanto.mjs';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const asset=name=>JSON.parse(fs.readFileSync(new URL('../assets/forest/'+name+'.json',import.meta.url)));
const map=asset('forest-layout'), trail=asset('trail-layout'), obstacles=asset('obstacles');
const valid=createNavigation(map,obstacles,['bridge']), unowned=createNavigation(map,obstacles,[]);
const point=(x,z)=>({x,z});
const center=polygon=>polygon.reduce((p,[x,z])=>({x:p.x+x/polygon.length,z:p.z+z/polygon.length}),point(0,0));
test('the six landmark rocks use the horizontal axes of the rendered GLB',()=>{
  const glb=fs.readFileSync(new URL('../assets/forest/forest.glb',import.meta.url));
  const scene=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
  const rocks=scene.nodes.filter(n=>n.name?.startsWith('Mossy landmark'));
  assert.equal(rocks.length,6);
  for(const {translation:[x,,z]} of rocks){
    assert(obstacles.solids.some(([name,polygon])=>{
      const p=center(polygon);return name.startsWith('Mossy_landmark')&&Math.hypot(p.x-x,p.z-z)<.20;
    }));
    assert.equal(valid(x,z),false);
  }
  assert.equal(valid(6,5),true,'old mirrored rock blocked open ground');
});
test('routes reach every side through bridge without crossing water or cascade',()=>{
  assert.deepEqual(route({x:0,z:7.5},{x:-5.7,z:4.6},valid),[],'inside the workshop boulder');
  for(const goal of [{x:-5.7,z:2.45},{x:8.3,z:2.5},{x:-4,z:-4.8},{x:3.5,z:-6.1}]){
    const points=route({x:0,z:7.5},goal,valid);assert(points.length>0);let last={x:0,z:7.5};
    for(const p of points){assert(segmentClear(last,p,valid));last=p;}assert.deepEqual(last,goal);
  }
  assert.deepEqual(route({x:0,z:7.5},{x:0,z:-5.4},unowned),[]);
  assert.deepEqual(route(point(37,-11),point(12,-9),unowned,map.bounds),[]);
  assert(route(point(0,7.5),point(0,-8),valid,map.bounds).length);
  assert.equal(segmentClear(point(15,-8),point(20,-8),valid),false,'cannot bypass the bridge along the seam');
});
test('large frame does not tunnel out of bounds, through river or tree',()=>{
  let p={x:0,z:7.5};
  for(let i=0;i<1000;i++){p=advance(p,{x:Math.sin(i*.1),z:Math.cos(i*.1)},.15,valid);assert(valid(p.x,p.z));}
  const blocked=advance({x:0,z:1},{x:0,z:-20},20,unowned);assert(blocked.z>=.7);
  assert.equal(valid(-9,-3),false);
});
test('free ground and both paths stay connected; the patio rocks require a real detour',()=>{
  assert(unowned(28,10),'safe grass outside 8A.1 corridors');
  for(const path of [map.connection,...[...trail.paths,...map.paths].map(p=>({
    points:p.points.map(([x,z])=>[x+map.trailOffset,z]),
  }))]){
    for(let i=1;i<path.points.length;i++)
      assert(route(point(...path.points[i-1]),point(...path.points[i]),unowned,map.bounds).length,JSON.stringify(path.points[i]));
  }
  const a=point(32.7,-10.4), b=point(32.7,-6);
  assert.equal(segmentClear(a,b,unowned),false);
  const around=route(a,b,unowned,map.bounds);
  assert(around.length>1);
  assert(around.every((p,i)=>segmentClear(i?around[i-1]:a,p,unowned)));
  for(const name of ['Bosque:Tronco_Chibi','Pátio:Bancada','Pátio:Pilar','Região:Ardosia']){
    const polygon=obstacles.solids.find(([key,poly])=>key===name&&center(poly).x>17)[1];
    const {x,z}=center(polygon);
    assert.equal(unowned(x,z),false,name);
  }
});
test('the trunk is solid and all three discovery stops are on safe ground',()=>{
  const [x,z]=recanto.log;
  assert(!unowned(x+map.trailOffset,z));
  const [leafX,leafZ]=recanto.leaf;
  for(const [u,v] of recanto.shelters)assert(unowned(leafX+u+map.trailOffset,leafZ+v));
  const exit=point(x+2*Math.sin(recanto.openingYaw)+map.trailOffset,z+2*Math.cos(recanto.openingYaw));
  assert(unowned(exit.x,exit.z));
  assert(route(point(19,1.4),exit,unowned,map.bounds).length);
  const camera=point(0,5), davi=point(0,1), pipo=point(2,0);
  const reachable=(_x,_z,u)=>u>0;
  assert(visibleSpot(0,0,camera,davi,pipo,reachable)[0]>.55);
  assert.deepEqual(visibleSpot(0,0,camera,davi,pipo,()=>false),[0,0]);
});
test('Pipo takes the detour and recovers across a disconnected obstacle without a visible crossing',()=>{
  let buddy=point(29,12);
  const hero=point(24,3.1), follower=createCompanion(unowned,map.bounds);
  for(let i=0;i<420;i++){
    const before=buddy, next=follower.update(buddy,hero,hero,1/60,()=>true);
    buddy=next.position;
    assert(!next.relocated);
    assert(segmentClear(before,buddy,unowned));
  }
  assert(Math.hypot(hero.x-buddy.x,hero.z-buddy.z)<.06);
  assert(follower.diagnostics().replans>0);
  const acrossWall=(x,z)=>Math.abs(x)>1&&Math.abs(x)<4&&Math.abs(z)<4;
  const recovery=createCompanion(acrossWall,[-4,4,-4,4]), far=point(3,2);
  buddy=point(-3,0);
  let disappeared=false;
  for(let i=0;i<260;i++){
    const next=recovery.update(buddy,far,far,1/60,()=>true);
    if(!next.relocated&&next.scale<1)disappeared=true;
    if(next.relocated)assert(disappeared&&next.scale===0,'the visible departure fades before relocating');
    buddy=next.position;
  }
  assert.deepEqual(buddy,far);
  assert.equal(recovery.diagnostics().recoveries,1);
});
test('frontend and Python agree around cell boundaries and solid footprints',()=>{
  const cases=[];
  for(let z=-14;z<17;z+=.431)for(let x=-17;x<50;x+=.377)cases.push([x,z]);
  const python=spawnSync('python',['-B','-c',
    'import json,sys; from forest_navigation import walkable; points=json.load(sys.stdin); print(json.dumps([[walkable(x,z,i) for x,z in points] for i in [(),("bridge","house")]]))',
  ],{input:JSON.stringify(cases),encoding:'utf8'});
  assert.equal(python.status,0,python.stderr);
  const equipped=createNavigation(map,obstacles,['bridge','house']);
  assert.deepEqual(JSON.parse(python.stdout),[unowned,equipped].map(check=>cases.map(([x,z])=>check(x,z))));
});
test('surface uses exported triangle diagonal, not bilinear or an unrelated formula',()=>{
  const grid={n:1,bounds:[0,1,0,1],heights:[0,1,2,6]};
  assert.equal(terrainHeight(grid,.75,.25),2);
  assert.equal(terrainHeight(grid,.25,.75),2.5);
  const terrain=JSON.parse(fs.readFileSync(new URL('../assets/forest/navigation.json',import.meta.url)));
  assert(terrainHeight(terrain,0,.71)<0,'bank carve must be present in support height');
});
