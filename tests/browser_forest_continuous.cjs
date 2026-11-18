const assert = require('node:assert/strict');
const path = require('node:path');
const { session, ready, diag, distance, out, save } = require('./forest_session.cjs');

const width = Number(process.argv[2] || 1366);
const mobile = width < 700;
const height = mobile ? 850 : 820;
const profile = process.env.FOREST_PROFILE || (mobile ? 'low' : 'high');
const name = width + '-' + profile;
const stills = process.env.FOREST_REGION_STILLS === '1';

session('volta-' + name, async ({ page, api, guided, plain, write }) => {
  const started = performance.now();
  const visits = [];
  const action = name => page.locator('[data-action="'+name+'"]').first();
  const hit = p => mobile ? page.touchscreen.tap(p.x,p.y) : page.mouse.click(p.x,p.y);
  const position = async () => (await diag(page)).position;
  const landscape = async () => await (await api.get('/api/forest/map')).json();
  const finishedDiscovery=()=>page.waitForFunction(()=>{
    const s=DaviForest.diagnostics().shelter;
    return s?.phase==='rest'&&s.leafUp&&s.wetBasin===0&&s.basinFill[0]>.98;
  });
  async function stable() {
    await page.waitForFunction(() => !DaviForest.diagnostics().target, null, { polling:120,timeout:12000 });
  }
  async function walk(x,z) {
    for(let attempt=0;attempt<30;attempt++){
      const [a,,b]=await position();
      const len=Math.hypot(a-x,b-z);
      if(len<.24)return;
      let destination;
      for(const stride of [3.5,2.3,1.45,.88,.42]){
        const t=Math.min(1,stride/len);
        const point=await page.evaluate(([u,v])=>{
          const point=DaviForest.project(u,v),el=document.elementFromPoint(point.x,point.y);
          return {...point,available:el?.id==='forestCanvas'||!!el?.closest('#worldMap')};
        },[a+t*(x-a),b+t*(z-b)]);
        if(point.groundVisible&&point.available){destination=point;break;}
      }
      if(destination){
        await hit(destination);
        await page.waitForTimeout(120);
        await stable();
        const d=await diag(page);
        if(distance([a,0,b],d.position)>.09){
          assert(d.navigationValid&&d.pipoNavigationValid,JSON.stringify(d.position));
          assert(distance(d.position,d.pipoPosition)<3.1, 'Pipo acompanha '+d.position);
          if(d.view==='3d'){
            assert(Math.abs(d.feetY-d.renderedGroundY)<.18, 'apoio '+JSON.stringify(d.position));
            assert(d.screenPosition.slice(0,2).every(v=>Math.abs(v)<.94),'Davi no quadro');
          }
          continue;
        }
      }
      await page.locator('[data-action=forest-rotate][data-turn="1"]').click();
      await page.waitForTimeout(700);
    }
    assert.fail('Caminho para '+[x,z]+' desde '+await position());
  }
  const walkAll=async points=>{for(const point of points)await walk(...point);};
  const local=async points=>walkAll(points.map(([x,z])=>[x+28,z]));
  async function mark(label) {
    await page.waitForTimeout(500);
    const d=await diag(page);
    const frames=d.frameMs.slice(-30).sort((a,b)=>a-b);
    const visit={label,seconds:Math.round((performance.now()-started)/1000),region:d.region,
      position:d.position,calls:d.calls,triangles:d.triangles,
      fps:frames.length?+(1000*frames.length/frames.reduce((sum,ms)=>sum+ms,0)).toFixed(1):null,
      medianMs:frames[Math.ceil(frames.length*.5)-1],p95ms:frames[Math.ceil(frames.length*.95)-1],
      low:d.low,dpr:d.pixelRatio,openingMs:d.readyMs,modelsMs:d.loadMs[0],
      bufferBytes:d.geometryBufferBytes,textureBytes:d.estimatedTextureBytes};
    visits.push(visit);
    console.log(width,profile,label,d.position);
    await page.screenshot({ path:path.join(out,label+'-'+name+'.png') });
  }
  const initial=await landscape();
  assert.equal(initial.economy.stars,0);
  assert.deepEqual(initial.economy.inventory,[]);
  assert.equal(await action('forest-enter-trail').count(),0);
  await action('forest-options').click();
  await page.locator('#forestQuality').selectOption(profile);
  await action('forest-close').click();
  if(stills){
    const points=[
      ['clareira',0,6.25],['passagem',15.1,5.1],['soleira',28,14],
      ['bosque',30.68,6.5],['besouro',19,1.4],['garganta',24,-12.5],
      ['patio',37.8,-11.4],['copa',46.5,-5.3],
    ];
    for(const [label,x,z] of points){
      await write('/api/forest/map/move',{x,z},'put');
      await page.reload();
      await ready(page);
      await mark(label);
      if(label==='bosque'){
        const fork=await page.evaluate(()=>[DaviForest.project(29.25,4.72),DaviForest.project(31.72,4.21)]);
        assert(fork.every(arm=>arm.groundVisible),'As duas trilhas estão enquadradas');
      }
      if(label==='besouro'&&process.env.FOREST_SHELTER_STILLS==='1'){
        await action('forest-nearby').click();
        await finishedDiscovery();
        await page.screenshot({path:path.join(out,'besouro-depois-'+name+'.png')});
      }
    }
    await action('forest-options').click();
    await action('forest-fallback').click();
    await page.locator('#worldMap[data-ready=true]').waitFor();
    assert.equal((await diag(page)).view,'2d');
    assert.equal((await diag(page)).region,'Copa da Nascente');
    await mark('mapa-2d');
    await walk(47,-3);
    const afterMap=await position();
    await action('world-forest').click();
    await ready(page);
    assert(distance(afterMap,await position())<.05);
    save('regioes-'+name,{visits,checkpoint:afterMap,resumed2d:true,renderer:(await diag(page)).renderer});
    return;
  }
  const canvasId=await page.locator('#forestCanvas').evaluate(element=>{
    element.dataset.continuous='original';
    return element.dataset.continuous;
  });
  const sameCanvas=async()=>assert.equal(await page.locator('#forestCanvas').getAttribute('data-continuous'),canvasId);
  await page.evaluate(()=>scrollTo(0,0));
  await mark('clareira');
  await walkAll([[4.3,7.5],[8,6.65],...initial.map.connection.points.slice(0,3)]);
  await mark('passagem');
  await walkAll(initial.map.connection.points.slice(3));
  await sameCanvas();
  await action('forest-camera').click();
  await mark('soleira');
  assert.equal((await diag(page)).region,'Soleira da Roda Baixa');
  await local([[2.7,11.5],[3.6,8.6],[2.68,6.5]]);
  await action('forest-camera').click();
  await mark('bosque');
  const fork=await page.evaluate(()=>[DaviForest.project(29.25,4.72),DaviForest.project(31.72,4.21)]);
  assert(fork.every(arm=>arm.groundVisible));
  await local([[1.25,4.72],[-1,4.2],[-5.3,2.1],[-7.4,2.6],[-9,1.4]]);
  await page.waitForTimeout(850);
  await action('forest-nearby').click();
  await finishedDiscovery();
  await mark('besouro');
  await local([[-7.4,2.6],[-5.3,2.1],[-6,-1.8],[-4,-4.7],[0,-7],[-1.8,-9.6],[-4,-12.5]]);
  await action('forest-nearby').click();
  await mark('garganta');
  await local([[-1.8,-9.6],[0,-7],[3.3,-8.9],[6.3,-10.6],[9.8,-11.4]]);
  await action('forest-camera').click();
  await mark('patio');
  await action('forest-nearby').click();
  await page.getByRole('heading',{name:'Oficina do bosque'}).waitFor();
  await action('forest-close').click();
  await local([[13,-11.3],[15.7,-9.5],[18.5,-5.3]]);
  await action('forest-camera').click();
  await action('forest-nearby').click();
  await mark('copa');
  assert.equal((await diag(page)).region,'Copa da Nascente');
  await sameCanvas();
  await local([[19,-2.5],[17.3,2.3],[16.2,6.8],[12.1,9.1],[7,12.4],[3.1,15.3],[0,14]]);
  await walkAll(initial.map.connection.points.toReversed());
  await walk(6.3,7.35);
  await action('forest-camera').click();
  await mark('retorno');
  await sameCanvas();
  const at=await position();
  await action('child-now').click();
  await page.getByText('Mochila de teste',{exact:true}).first().waitFor();
  await action('game-exit').click();
  await ready(page);
  assert(distance(at,await position())<.05);
  const agenda=await (await api.get('/api/calendar?start=2026-11-17&end=2026-11-17')).json();
  assert.equal(agenda.events.find(event=>event.id===guided.id).done,false);
  const checkpoint=await landscape();
  assert.equal(checkpoint.leaf_up,true);
  assert.deepEqual(checkpoint.economy.inventory,initial.economy.inventory);
  assert.equal(checkpoint.economy.stars,initial.economy.stars);
  await page.reload();
  await ready(page);
  assert(distance(at,await position())<.05);
  await action('forest-options').click();
  await action('forest-fallback').click();
  await page.locator('#worldMap[data-ready=true]').waitFor();
  assert.equal((await diag(page)).view,'2d');
  assert.equal((await diag(page)).webgl,false);
  assert(distance(at,await position())<.05);
  const two=await diag(page);
  assert(two.features.some(f=>f.id==='source')&&two.features.some(f=>f.id==='house'));
  assert(two.features.some(f=>f.id==='activity-'+plain.id&&!f.hasMission));
  await mark('mapa-2d');
  await walk(7.75,7.3);
  const mapAt=await position();
  assert(distance(at,mapAt)>1);
  await action('world-forest').click();
  await ready(page);
  assert(distance(mapAt,await position())<.05);
  save('regioes-'+name,{visits,checkpoint:checkpoint.position,returned:true,continuousCanvas:true,
    resumed2d:true,renderer:(await diag(page)).renderer});
}, !stills&&!mobile&&profile==='high',{stars:0,viewport:{width,height},videoSize:{width,height},videoFps:24})
  .catch(error=>{console.error(error);process.exitCode=1;});
