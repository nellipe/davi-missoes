const assert = require('node:assert/strict');
const path = require('node:path');
const {session,ready,diag,distance,out,save} = require('./forest_session.cjs');

const width=Number(process.argv[2]||390), mobile=width<700, height=mobile?850:820;
const profile=mobile?'low':'high';
const start={x:24.75,z:3.55}, visit={x:22.01,z:2.74};
const stem='recanto-'+width;
const selector=name=>'[data-action="'+name+'"]';

session(stem,async({page,api})=>{
  const evidence=[];
  const press=name=>page.locator(selector(name)).first().click();
  const shot=name=>page.screenshot({path:path.join(out,stem+'-'+name+'.png')});
  const frame=()=>page.evaluate(()=>({
    discoveries:DaviForest.discoveryFraming(), actors:DaviForest.characterFraming(),
  }));
  const count=points=>points.filter(p=>p.clear&&Math.abs(p.x)<.94&&Math.abs(p.y)<.91).length;
  async function sample(name, requireBoth=true){
    const d=await diag(page), framing=await frame();
    assert(d.navigationValid&&d.pipoNavigationValid);
    assert.equal(d.low,profile==='low');
    const [beetleX,beetleY,beetleZ]=d.shelter.beetle;
    const grounded=await page.evaluate(([x,y,z])=>{
      return DaviForest.walkable(x,z)&&Math.abs(DaviForest.project(x,z).y-DaviForest.project(x,z,y).y)<3;
    },[beetleX,beetleY,beetleZ]);
    assert(grounded,name+' besouro no gramado');
    const samples=d.frameMs.slice(-30).sort((a,b)=>a-b);
    evidence.push({name,leaf:d.shelter.leafUp,wetBasin:d.shelter.wetBasin,
      hedgehog:d.hedgehog,shelter:d.shelter,framing,player:d.position,pipo:d.pipoPosition,
      p95ms:samples[Math.ceil(samples.length*.95)-1],drawCalls:d.calls,triangles:d.triangles});
    if(requireBoth){
      assert(count(framing.discoveries?.hedgehog??[])>=2,name+' ouriço '+JSON.stringify(framing));
      assert(count(framing.discoveries.beetle)>=2,name+' besouro '+JSON.stringify(framing));
      assert(count(framing.actors.davi)>=2&&count(framing.actors.pipo)>=2,name+' personagens '+JSON.stringify(framing));
    }
    await shot(name);
    return d;
  }
  async function tapGround(x,z){
    const point=await page.evaluate(([x,z])=>{
      const p=DaviForest.project(x,z);
      return {...p,available:document.elementFromPoint(p.x,p.y)?.id==='forestCanvas'};
    },[x,z]);
    assert(point.groundVisible&&point.available,JSON.stringify({x,z,...point}));
    if(mobile)await page.touchscreen.tap(point.x,point.y);
    else await page.mouse.click(point.x,point.y);
  }
  const waitForStop=()=>page.waitForFunction(()=>{
    const d=DaviForest.diagnostics();
    return !d.target&&!d.moving;
  });
  const waitForRest=value=>page.waitForFunction(expected=>{
    const d=DaviForest.diagnostics();
    return d.shelter.leafUp===expected&&d.shelter.phase==='rest'&&d.hedgehog.progress===1;
  },value);

  await press('forest-options');
  await page.locator('#forestQuality').selectOption(profile);
  await press('forest-close');
  const balance=(await (await api.get('/api/world')).json()).stars;
  await page.waitForTimeout(950);
  assert.equal((await diag(page)).hedgehog.progress,0);
  await sample('chegada',false);

  if(!mobile) {
    await page.locator('#forestCanvas').focus();
    await page.keyboard.down('a');
    await page.waitForTimeout(320);
    await page.keyboard.up('a');
  }
  await tapGround(visit.x,visit.z);
  await page.waitForFunction(()=>DaviForest.diagnostics().hedgehog.progress>.76);
  await sample('saida',false);
  await waitForStop();
  await page.waitForFunction(()=>DaviForest.diagnostics().hedgehog.progress===1);
  await page.waitForTimeout(700);
  const before=await sample('encontro');
  assert(distance(before.position,[visit.x,0,visit.z])<.23);
  assert(!before.shelter.leafUp);
  assert(await page.evaluate(([x,,z])=>DaviForest.walkable(x,z),before.hedgehog.position));

  if(mobile){
    const leaf=await page.evaluate(()=>{
      const [x,y,z]=DaviForest.diagnostics().shelter.leaf;
      return DaviForest.project(x,z,y+.10);
    });
    assert(leaf.visible);
    await page.touchscreen.tap(leaf.x,leaf.y);
  } else {
    await page.locator('#forestCanvas').focus();
    await page.keyboard.press('e');
  }
  await page.waitForFunction(()=>DaviForest.diagnostics().shelter.phase==='carry');
  await page.waitForTimeout(450);
  await sample('besouro-em-movimento',false);
  await waitForRest(true);
  await page.waitForTimeout(350);
  const changed=await sample('apos-interacao');
  assert(distance(before.shelter.beetle,changed.shelter.beetle)>.75);
  assert.notEqual(changed.shelter.wetBasin,before.shelter.wetBasin);

  const rotate=dir=>page.locator('[data-action=forest-rotate][data-turn="'+dir+'"]').click();
  for(const [direction,side] of [[1,'direita'],[-1,'esquerda']]){
    await press('forest-camera');
    await rotate(direction);
    await page.waitForTimeout(1000);
    await sample(side);
  }
  await page.reload();await ready(page);await waitForRest(true);
  await press('child-now');
  await page.locator(selector('game-learn')).waitFor();
  await press('game-exit');await ready(page);await waitForRest(true);
  await page.waitForTimeout(550);
  const revisit=await sample('retorno');
  assert(distance(revisit.position,changed.position)<.09);
  assert.equal(revisit.shelter.wetBasin,changed.shelter.wetBasin);
  await press('forest-nearby');await waitForRest(false);
  await page.waitForTimeout(250);
  await sample('outro-abrigo');
  await press('forest-options');await press('forest-fallback');
  await page.locator('#worldMap[data-ready=true]').waitFor();
  assert(await page.locator('#forest2dBeetle').getAttribute('transform'));
  await press('world-forest');await ready(page);await waitForRest(false);
  assert(distance((await diag(page)).position,changed.position)<.09);
  assert.equal((await (await api.get('/api/world')).json()).stars,balance);
  save(stem,{width,height,profile,evidence,renderer:revisit.renderer});
},process.env.FOREST_RECORD==='1',{position:start,viewport:{width,height},videoSize:{width,height},videoFps:20})
  .catch(error=>{console.error(error);process.exitCode=1});
