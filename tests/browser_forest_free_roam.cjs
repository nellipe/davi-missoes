const assert = require('node:assert/strict');
const { session, ready, diag, distance, save } = require('./forest_session.cjs');

const width=Number(process.argv[2]||1366), mobile=width<700;
const height=mobile?850:820;
const profile=process.env.FOREST_PROFILE||(mobile?'low':'high');
const name='exploracao-'+width+'-'+profile;
const initial={x:33.04,z:-5.4};
const destination={x:32.65,z:-9.8};
const canvas='#forestCanvas[data-ready=true]';
const action=name=>'[data-action="'+name+'"]';

session(name,async({page,context,api,write})=>{
  const checkpoints=[];
  const press=name=>page.locator(action(name)).first().click();
  const select=async()=>{
    await press('forest-options');
    await page.locator('#forestQuality').selectOption(profile);
    await press('forest-close');
  };
  const setup=async(x,z)=>{
    await write('/api/forest/map/move',{x,z},'put');
    await page.reload();await ready(page);
  };
  const before=await (await api.get('/api/forest/map')).json();
  const start=Date.now();
  async function mark(label){
    const framesAtStart=await page.evaluate(()=>DaviForest.telemetry().frames);
    await page.waitForFunction(first=>DaviForest.telemetry().frames-first>=30,framesAtStart);
    const d=await diag(page);
    const frames=d.frameMs.slice(-30).toSorted((a,b)=>a-b);
    assert(d.navigationValid&&d.pipoNavigationValid);
    checkpoints.push({label,seconds:(Date.now()-start)/1000,view:d.view,position:d.position,
      pipo:d.pipoPosition,gap:distance(d.position,d.pipoPosition),follower:d.companion,
      fps:frames.length?1000*frames.length/frames.reduce((a,b)=>a+b,0):null,
      p95ms:frames[Math.ceil(frames.length*.95)-1],openingMs:d.readyMs,
      calls:d.calls,triangles:d.triangles,profile:d.low?'low':'high'});
    console.log(label,d.position.map(v=>+v.toFixed(2)),d.companion);
    return d;
  }
  async function tapWorld({x,z}){
    const p=await page.evaluate(([x,z])=>{
      const p=DaviForest.project(x,z);
      return {...p,available:!!document.elementFromPoint(p.x,p.y)?.closest('#forestCanvas,#worldMap')};
    },[x,z]);
    assert(p.groundVisible&&p.available,JSON.stringify({x,z,...p}));
    if(mobile)await page.touchscreen.tap(p.x,p.y);
    else await page.mouse.click(p.x,p.y);
  }
  const stable=()=>page.waitForFunction(()=>!DaviForest.diagnostics().target,null,{polling:120,timeout:16000});
  const waitBuddy=()=>page.waitForFunction(()=>{
    const d=DaviForest.diagnostics();
    return Math.hypot(d.position[0]-d.pipoPosition[0],d.position[2]-d.pipoPosition[2])<1.6;
  },null,{polling:120,timeout:8500});
  await select();
  const approach=await mark('diante-da-rocha');
  assert.equal(approach.low,profile==='low');
  if(mobile){
    const cdp=await context.newCDPSession(page);
    const button=await page.locator('[data-forest-dir="up"]').boundingBox();
    assert(button);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[
      {x:button.x+button.width/2,y:button.y+button.height/2},
    ]});
    await page.waitForTimeout(2700);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{
    await page.locator(canvas).focus();
    await page.keyboard.down('w');
    await page.waitForTimeout(2700);
    await page.keyboard.up('w');
  }
  const blocked=await mark('direcional-barra-na-rocha');
  assert(blocked.position[2]>-7.2&&blocked.position[2]<-6,JSON.stringify(blocked.position));
  assert(distance(blocked.position,approach.position)>.55);
  const rock={x:32.76,z:-7.58};
  await tapWorld(rock);
  await page.waitForTimeout(300);
  assert(distance((await diag(page)).position,blocked.position)<.08,'toque na rocha não atravessa');
  await tapWorld(destination);
  assert((await diag(page)).target,'toque atrás da rocha inicia desvio');
  await stable();await waitBuddy();
  const around=await mark('desvio-da-rocha-com-pipo');
  assert(distance(around.position,[destination.x,0,destination.z])<.23);
  assert(distance(around.position,around.pipoPosition)<1.6);
  await page.waitForTimeout(600);

  await setup(38.5,-11.3);
  await tapWorld({x:41,z:-11.3});
  await stable();await waitBuddy();
  assert((await mark('passagem-apos-a-bancada')).position[0]>40.75);

  await setup(28,11.43);
  await tapWorld({x:28,z:10});
  await stable();await waitBuddy();
  const explorado=await mark('soleira-fora-da-trilha');
  assert(distance(explorado.position,[28,0,10])<.25);
  const persisted=(await (await api.get('/api/forest/map')).json()).position;
  assert(distance(explorado.position,[persisted.x,0,persisted.z])<.06);
  await page.reload();await ready(page);
  assert(distance(explorado.position,(await diag(page)).position)<.08);
  await page.locator(action('child-now')).click();
  await page.locator('.game-shell').waitFor();
  await page.getByRole('button',{name:'← Agenda',exact:true}).click();
  await ready(page);
  assert(distance(explorado.position,(await diag(page)).position)<.08);
  await press('forest-options');await press('forest-fallback');
  await page.locator('#worldMap[data-ready=true]').waitFor();
  assert(distance(explorado.position,(await diag(page)).position)<.08);
  const terrain=await page.evaluate(()=>[[28,10],[32.76,-7.58],[20.18,.24],[37.87,-12.24]].map(p=>DaviForest.walkable(...p)));
  assert.deepEqual(terrain,[true,false,false,false]);
  await tapWorld({x:30.1,z:9.85});
  await stable();await waitBuddy();
  const fallback=await mark('exploracao-no-mapa-2d');
  assert.equal(fallback.view,'2d');
  assert(distance(explorado.position,fallback.position)>1.65);
  await press('world-forest');await ready(page);
  const resumed=await mark('retomada-na-floresta-3d');
  assert(distance(resumed.position,fallback.position)<.08);
  const after=await (await api.get('/api/forest/map')).json();
  assert.equal(after.economy.stars,before.economy.stars);
  assert.deepEqual(after.economy.inventory,before.economy.inventory);
  save(name,{width,height,profile,checkpoints,renderer:resumed.renderer});
},process.env.FOREST_RECORD==='1',{viewport:{width,height},videoSize:{width,height},videoFps:20,position:initial})
  .catch(error=>{console.error(error);process.exitCode=1;});
