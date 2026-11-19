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
async function matchCamera(page) {
  await page.route('**/forest.js', async route => {
    const response = await route.fetch();
    let code = await response.text();
    const start = code.indexOf('  const pos = player.position,', code.indexOf('function updateCamera('));
    const end = code.indexOf('  clearingSight.update(', start);
    assert(start > 0 && end > start);
    code = code.slice(0, start) + `
      const pos = player.position;
      const shot = {13.35:.63, 6.5:.18, 1.4:.45};
      const yaw = shot[pos.z] ?? .18;
      const length = camera.aspect < .85 ? 7.8 : 6.65;
      const follow = new T.Vector3(pos.x-.28,floor(pos.x,pos.z)+1.02,pos.z-.38);
      camera.fov = 44;
      camera.updateProjectionMatrix();
      camera.position.copy(follow).add(new T.Vector3(Math.sin(yaw)*length,3.2,Math.cos(yaw)*length));
      camera.lookAt(follow);
      camera.updateMatrixWorld();
    ` + code.slice(end);
    await route.fulfill({ response, body: code });
  });
}

async function comparison(checkout, name) {
  const samples = [];
  for (const width of viewports) for (const quality of ['low','high']) {
    await session(name, async ({ page, write }) => {
      await page.addInitScript(value => localStorage.setItem('davi-forest-quality', value), quality);
      for (const [spot, x, z] of spots) {
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
        });
        await shot(page, `${name}-${width}-${quality}-${spot}`);
      }
    }, false, { checkout, beforeOpen:matchCamera, stars:0, viewport:{ width, height:width<700?850:840 } });
    console.log(name, width, quality);
  }
  save(name,samples);
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
      assert.deepEqual(await page.evaluate(()=>performance.getEntriesByType('resource')
        .map(entry=>entry.name).filter(url=>new URL(url).origin!==location.origin)),[]);
      for (const box of await page.locator('.forest-stage button:visible').evaluateAll(buttons => buttons.map(b => {
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
const run = mode==='compare' ? comparison(checkout,name) : mode==='native' ? native() : gameplay();
run.catch(error=>{ console.error(error); process.exitCode=1; });
