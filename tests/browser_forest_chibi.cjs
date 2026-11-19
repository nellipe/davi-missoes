const assert = require('node:assert/strict');
const path = require('node:path');
const AxeBuilder = require('@axe-core/playwright').default;
const { session, diag, ready, distance, out, save } = require('./forest_session.cjs');

const viewports = [360, 390, 1366];
const spots = [
  ['soleira', 28, 13.35],
  ['bosque', 30.68, 6.50],
  ['tronco', 19, 1.4],
];
const action = (page, name, suffix = '') =>
  page.locator(`[data-action="${name}"]${suffix}`).first();
const click = (page, name, suffix) => action(page, name, suffix).click();
const shot = (page, name) => page.screenshot({ path: path.join(out, name + '.png') });

// Inject the same lens and offset in both checkouts for the comparison images.
// Ordinary gameplay and the native HUD captures use the production camera.
async function matchCamera(page, master = false) {
  if(master)await page.route('**/forest.css',async route=>{
    const response=await route.fetch();
    const size='\n@media (max-width: 700px) { #forestStage { height: 62svh;min-height:0;max-height:none } }';
    await route.fulfill({response,body:await response.text()+size});
  });
  await page.route('**/forest.js', async route => {
    const response = await route.fetch();
    let code = await response.text();
    const start = code.indexOf('  const pos = player.position,', code.indexOf('function updateCamera('));
    const end = code.indexOf('  clearingSight.update(', start);
    assert(start > 0 && end > start);
    code = code.slice(0, start) + `
      const pos = player.position;
      const shot = {13.35:.63, 6.5:.18, 1.4:.45, 4.21:.18};
      const yaw = shot[pos.z] ?? .18;
      const length = camera.aspect < .85 ? 7.8 : 6.65;
      const follow = new T.Vector3(pos.x-.28,floor(pos.x,pos.z)+1.02,pos.z-.38);
      camera.fov = 44;
      camera.updateProjectionMatrix();
      camera.position.copy(follow).add(new T.Vector3(Math.sin(yaw)*length,3.2,Math.cos(yaw)*length));
      camera.lookAt(follow);
      camera.updateMatrixWorld();
    ` + code.slice(end);
    if(master) code += `
      window.forestArtBudget=()=>{
        const buckets={};
        const list=renderer.renderLists.get(scene,0);
        for(const item of [...list.opaque,...list.transparent]){
          const {object,geometry,group}=item;
          if(!object.isMesh)continue;
          const name=object.name || object.parent?.name || '';
          if(!name.startsWith('Bosque:') && !name.startsWith('Soleira')
            && !(object.geometry.type==='CircleGeometry' && object.parent===trailScene?.group)
            && name!=='Trilha:slab')continue;
          let role='solo';
          if(/(_Copa|_Tronco|_Pontas)/.test(name))role='arvores';
          if(/Bagas|Mirtilo|Samambaia|Azaleia|Cogumelos|Flores|Trevo/.test(name))role='vegetacao';
          if(name.startsWith('Soleira') || object.geometry.type==='CircleGeometry' || name==='Trilha:slab')
            role='agua';
          if(!buckets[role])buckets[role]={calls:0,triangles:0};
          const range=Math.min(group?.count ?? Infinity,geometry.drawRange.count,geometry.index?.count??geometry.attributes.position.count);
          const passes=item.material.transparent && item.material.side===T.DoubleSide && !item.material.forceSinglePass?2:1;
          buckets[role].calls+=passes;
          buckets[role].triangles+=range/3*(object.isInstancedMesh?object.count:1)*passes;
        }
        return buckets;
      };
    `;
    await route.fulfill({ response, body: code });
  });
}

async function comparison(checkout, name, master=false) {
  const samples = [];
  for (const width of viewports) for (const quality of ['low','high']) {
    await session(name, async ({ page, write }) => {
      await page.addInitScript(value => localStorage.setItem('davi-forest-quality', value), quality);
      const positions=master?[...spots,['lajes',31.72,4.21]]:spots;
      for (const [spot, x, z] of positions) {
        await write('/api/forest/map/move', { x, z }, 'put');
        await page.reload();
        await ready(page);
        await page.waitForFunction(() => DaviForest.telemetry().frameMs.length >= 55);
        const d = await diag(page);
        assert(distance(d.position,[x,0,z])<.01 && d.low === (quality === 'low'));
        const frames = d.frameMs.slice(-45).sort((a,b) => a-b);
        samples.push({
          width, quality, spot, position:d.position, camera:d.camera, gpu:d.renderer,
          calls:d.calls, triangles:d.triangles, readyMs:d.readyMs, dpr:d.pixelRatio,
          fps:1000*frames.length/frames.reduce((s,v)=>s+v,0), p95ms:frames[42],
          geometryBytes:d.geometryBufferBytes, textureBytes:d.estimatedTextureBytes, heapBytes:d.jsHeapBytes,
          ...(master?{art:await page.evaluate(()=>window.forestArtBudget())}:{}),
        });
        await shot(page, `${name}-${width}-${quality}-${spot}`);
      }
    }, false, { checkout, beforeOpen:page=>matchCamera(page,master), stars:0, viewport:{ width, height:width<700?850:840 } });
    console.log(name, width, quality);
  }
  save(name,samples);
}

async function mobileGameplay(width) {
  assert([360,390].includes(width));
  await session('jogabilidade-'+width,async({page,context,api})=>{
    const cdp=await context.newCDPSession(page);
    const canvas=page.locator('#forestCanvas');
    const nearby=page.locator('#forestInteract');
    const route=[];
    const pause=ms=>page.waitForTimeout(ms);
    const touch=async(x,z)=>{
      for(let attempt=0;attempt<15;attempt++){
        const before=(await diag(page)).position;
        const gap=distance(before,[x,0,z]);
        if(gap<.20)return;
        let point;
        for(const stride of [3.15,2.0,1.15,.50]){
          const t=Math.min(1,stride/gap);
          const p=await page.evaluate(([x,z])=>{
            const target=DaviForest.project(x,z);
            return {...target,clear:document.elementFromPoint(target.x,target.y)?.id==='forestCanvas'};
          },[before[0]+t*(x-before[0]),before[2]+t*(z-before[2])]);
          if(p.groundVisible && p.clear){point=p;break;}
        }
        if(point){
          await page.touchscreen.tap(point.x,point.y);
          await page.waitForFunction(()=>!DaviForest.diagnostics().target);
          if(distance(before,(await diag(page)).position)>.08)continue;
        }
        await click(page,'forest-rotate','[data-turn="1"]');
        await pause(740);
      }
      assert.fail('Toque no caminho para '+[x,z]);
    };
    const observe=async name=>{
      const state=await diag(page);
      assert(state.webgl && state.navigationValid && state.pipoNavigationValid);
      const framing=await page.evaluate(()=>DaviForest.characterFraming());
      for(const points of Object.values(framing))
        assert(points.filter(p=>p.clear && Math.abs(p.x)<.95 && Math.abs(p.y)<.95).length>=2,
          name+': '+JSON.stringify(framing));
      route.push({name, position:state.position, angle:state.angle, framing, living:state.living});
    };

    await page.waitForFunction(()=>DaviForest.diagnostics().living);
    await page.waitForFunction(()=>document.querySelector('#forestInteract').textContent.includes('Soltar um barquinho'));
    await observe('Soleira');
    await nearby.tap();
    await pause(1560);
    const speech=await page.locator('.pipo-speech').boundingBox();
    assert(speech.width>145 && speech.width>speech.height*1.55,'O balão usa poucas linhas');
    const start=(await diag(page)).angle;
    const box=await canvas.boundingBox();
    const x=box.x+box.width*.65,y=box.y+box.height*.45;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{
      type:'touchMove',touchPoints:[{x:x-i*9,y}],
    });
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await pause(900);
    assert(Math.abs((await diag(page)).angle-start)>.30);
    await observe('Giro livre da roda');
    await click(page,'forest-camera');
    await page.waitForFunction(()=>DaviForest.diagnostics().living.lowBoat[2]>14);
    await shot(page,'roda-'+width);
    for(const [x,z] of [[30.7,11.5],[31.6,8.6],[30.68,6.5],[31.72,4.21]])await touch(x,z);
    await page.evaluate(()=>{
      window.crossingPressure=0;
      window.crossingProbe=setInterval(()=>{
        window.crossingPressure=Math.max(window.crossingPressure,DaviForest.diagnostics().living.stonePressure);
      },35);
    });
    await touch(33.2,3.55);
    const pressure=await page.evaluate(()=>{clearInterval(window.crossingProbe);return window.crossingPressure;});
    assert(pressure>.025,'A laje cedeu sob o passo');
    await click(page,'forest-camera');
    await pause(840);
    await observe('Travessia das lajes');
    await shot(page,'lajes-'+width);
    await click(page,'forest-paths');
    await click(page,'forest-travel','[data-id=leaf]');
    await page.waitForFunction(()=>!DaviForest.diagnostics().target,null,{timeout:45000});
    await page.waitForFunction(()=>document.querySelector('#forestInteract').textContent.includes('Virar a folha'));
    await click(page,'forest-camera');
    await pause(900);
    await nearby.tap();
    await page.waitForFunction(()=>DaviForest.diagnostics().shelter.phase==='rest'
      && DaviForest.diagnostics().shelter.leafUp);
    await observe('Tronco e besouro');
    await shot(page,'tronco-'+width);
    assert.equal((await (await api.get('/api/world')).json()).stars,0);
    await click(page,'child-now');
    await action(page,'game-learn').waitFor();
    await pause(850);
    await click(page,'game-exit');
    await ready(page);
    await page.waitForFunction(()=>DaviForest.diagnostics().shelter?.leafUp);
    await pause(700);
    save('jogabilidade-'+width,{ width, pressure,route,stars:0 });
  },true,{
    stars:0, position:{x:28,z:13.35}, viewport:{width,height:850},
    videoSize:{width,height:850}, videoFps:24,
    beforeOpen:page=>page.addInitScript(()=>localStorage.setItem('davi-forest-quality','low')),
  });
}

async function gameplay() {
  await session('jogabilidade', async ({ page, api, guided }) => {
    const childWorld = async () => (await api.get('/api/world')).json();
    const initial = await childWorld();
    const canvas = page.locator('#forestCanvas');
    const interact = page.locator('#forestInteract');
    const near = id => page.waitForFunction((name) =>
      document.getElementById('forestInteract')?.textContent.includes(name), id);
    await page.waitForFunction(() => DaviForest.diagnostics().living);
    await canvas.focus();
    await page.keyboard.down('w');
    await page.waitForFunction(() => DaviForest.diagnostics().moving);
    await page.waitForTimeout(430);
    await page.keyboard.up('w');
    await near('Soltar um barquinho');
    const before = await diag(page);
    assert(before.pipoFeetY-before.pipoGroundY>.65);
    await page.waitForTimeout(500);
    assert.equal((await diag(page)).living.lowWheel,before.living.lowWheel);
    await interact.tap();
    await page.waitForFunction(start => DaviForest.diagnostics().living.lowBoat[2]>start+3, before.living.lowBoat[2]);
    assert.notEqual((await diag(page)).living.lowWheel,before.living.lowWheel);
    await shot(page,'barquinho');

    await click(page,'forest-paths');
    await click(page,'forest-travel','[data-id=leaf]');
    await page.waitForFunction(() => !DaviForest.diagnostics().target, null, { timeout:45000 });
    const atLog = await diag(page);
    assert.equal(atLog.region,'Bosque das Bainhas');
    assert(atLog.navigationValid && atLog.pipoNavigationValid);
    await near('Virar a folha');
    await canvas.focus();
    await page.keyboard.press('e');
    await page.waitForFunction(() => {
      const s=DaviForest.diagnostics().shelter;
      return s?.leafUp && s.phase==='rest' && s.basinFill[0]>.99;
    });
    assert.equal((await childWorld()).stars,initial.stars);
    const shelter = await diag(page);
    assert.notDeepEqual(shelter.shelter.beetle,atLog.shelter.beetle);
    await shot(page,'besouro');
    await click(page,'child-now');
    await action(page,'game-learn').waitFor();
    for (const mode of ['learn','do','remember']) assert(await action(page,'game-'+mode).isVisible());
    await page.waitForTimeout(1200);
    const mission = (await (await api.get(`/api/events/${guided.id}/mission?date=2026-11-17`)).json()).mission;
    await click(page,'game-learn');
    for (let i=0;i<mission.steps.length;i++){
      await page.waitForTimeout(420);
      await click(page,'game-next');
    }
    await page.locator('.g-reward-chest').waitFor();
    const credit = (await childWorld()).stars;
    assert(credit>initial.stars);
    await click(page,'game-chest');
    await page.waitForTimeout(900);
    await click(page,'game-exit');
    await ready(page);
    assert.match(await page.locator('#forestMessage').textContent(),/estrela[s]? guardada[s]?!/);
    assert.equal(Number(await page.locator('.forest-wallet strong').textContent()),credit);
    assert(distance((await diag(page)).position,shelter.position)<.05);
    assert((await diag(page)).shelter.leafUp);
    await shot(page,'estrelas');
    await page.waitForTimeout(1150);
    save('jogabilidade',{ start:before.position, atLog:atLog.position, end:(await diag(page)).position,
      boatStart:before.living.lowBoat, from:initial.stars, balance:credit, leafUp:shelter.shelter.leafUp });
  }, true, { stars:0, position:{ x:28,z:14.12 }, viewport:{ width:1120,height:770 }, videoSize:{ width:1120,height:770 }, videoFps:24 });
}

async function native() {
  for (const width of viewports) for (const quality of ['low','high']) {
    await session('visual', async ({ page, write }) => {
      const canvas=page.locator('#forestCanvas');
      await page.waitForTimeout(600);
      await page.evaluate(()=>scrollTo(0,0));
      await shot(page,`jogo-${width}-${quality}`);
      const { violations }=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      assert.deepEqual(violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      if(width<700){
        const camera=await page.locator('.forest-camera').boundingBox();
        const view=await canvas.boundingBox();
        assert(camera.y>=view.y+view.height-.5 && camera.y+camera.height<=850,
          'A câmera fica acessível fora da cena');
      }
      assert.deepEqual(await page.evaluate(()=>performance.getEntriesByType('resource')
        .map(entry=>entry.name).filter(url=>new URL(url).origin!==location.origin)),[]);
      for (const box of await page.locator('.forest-stage button:visible,.forest-camera button:visible').evaluateAll(buttons => buttons.map(b => {
        const {width,height}=b.getBoundingClientRect();
        return [width,height,b.getAttribute('aria-label') || b.textContent];
      }))) assert(box[0]>=48 && box[1]>=48,JSON.stringify(box));
      const previous=(await diag(page)).angle;
      const bounds=await canvas.boundingBox();
      await page.mouse.move(bounds.x+bounds.width*.45,bounds.y+bounds.height*.47);
      await page.mouse.down();
      await page.mouse.move(bounds.x+bounds.width*.68,bounds.y+bounds.height*.47,{steps:7});
      await page.mouse.up();
      assert(Math.abs((await diag(page)).angle-previous)>.3);
      assert.equal((await diag(page)).target,null);
      await click(page,'forest-camera');
      await action(page,'forest-hint').tap();
      await page.locator('.pipo-speech').waitFor();
      if(width===390 && quality==='low'){
        await write('/api/forest/map/move',{x:31.72,z:4.21},'put');
        await page.reload();
        await ready(page);
        const point=await page.evaluate(()=>DaviForest.project(33.2,3.55));
        assert(point.visible && point.groundVisible);
        await page.touchscreen.tap(point.x,point.y);
        await page.waitForFunction(()=>DaviForest.diagnostics().living.stonePressure>.025);
        await page.waitForFunction(()=>!DaviForest.diagnostics().target);
        assert.equal((await diag(page)).living.stonePressure,0);
        assert(distance((await diag(page)).position,[33.2,0,3.55])<.18);
      }
    }, false, {
      beforeOpen:page=>page.addInitScript(value=>localStorage.setItem('davi-forest-quality',value),quality),
      position:{ x:28,z:13.35 }, stars:0, viewport:{ width,height:width<700?850:840 },
    });
    console.log('Jogo, teclado, toque e axe',width,quality);
  }
}

const [mode, checkout, name] = process.argv.slice(2);
const run = mode==='compare' || mode==='compare-master' ? comparison(checkout,name,mode==='compare-master')
  : mode==='mobile' ? mobileGameplay(Number(checkout)) : mode==='native' ? native() : gameplay();
run.catch(error=>{ console.error(error); process.exitCode=1; });
