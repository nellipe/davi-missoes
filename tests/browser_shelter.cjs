const assert = require('node:assert/strict');
const path = require('node:path');
const { session, diag, ready, distance, out, save } = require('./forest_session.cjs');

const width = Number(process.argv[2] || 1366);
const mobile = width < 700;
const height = mobile ? 850 : 820;
const profile = process.env.FOREST_PROFILE;
const captureOnly = process.env.FOREST_CAPTURE_ONLY === '1';
const visualEvidence = process.env.FOREST_VISUAL_EVIDENCE === '1';
const shortRevisit = process.env.FOREST_SHORT_REVISIT === '1';
const suffix = width + (profile ? '-' + profile : '');
const stem = 'besouro-' + suffix;

session(stem, async ({ page, api, guided, write }) => {
  const start = performance.now();
  const stops = [];
  const samples = [];
  const stages = [];
  const action = (name) => page.locator('[data-action="' + name + '"]');
  const press = (name) => mobile ? action(name).tap() : action(name).click();
  const rotate = () => page.locator('[data-action=forest-rotate][data-turn="1"]').evaluate(button => button.click());
  const point = (x, z) => page.evaluate(([a, b]) => {
    const p = DaviForest.project(a+28, b);
    return { ...p, free: DaviForest.walkable(a+28,b) && document.elementFromPoint(p.x, p.y)?.id === 'forestCanvas' };
  }, [x, z]);
  const touch = (p) => mobile ? page.touchscreen.tap(p.x, p.y) : page.mouse.click(p.x, p.y);
  async function walk(x, z) {
    for (let n = 0; n < 20; n++) {
      const before = await diag(page);
      const [globalX, , b] = before.position;
      const a=globalX-28;
      const len = Math.hypot(x - a, z - b);
      if (len < .19) return;
      let target;
      for (const step of [len, 2.5, 1.8, 1.2, .65, .38]) {
        const t = Math.min(1, step / len);
        const p = await point(a + (x - a) * t, b + (z - b) * t);
        if (p.groundVisible && p.free) {
          target = p;
          break;
        }
      }
      if (!target) {
        await rotate();
        await page.waitForTimeout(760);
        continue;
      }
      await touch(target);
      await page.waitForTimeout(130);
      await page.waitForFunction(() => !DaviForest.diagnostics().target, null, {
        polling: 130, timeout: 6000,
      });
      const d = await diag(page);
      if (distance(before.position, d.position) < .06) {
        await rotate();
        await page.waitForTimeout(760);
        continue;
      }
      assert(d.navigationValid && d.pipoNavigationValid && d.webgl);
      assert(distance(d.position, d.pipoPosition) < 2.65);
      assert(Math.abs(d.feetY - d.renderedGroundY) < .15);
      assert(d.screenPosition.every((axis) => Math.abs(axis) < 1));
    }
    assert.fail('chegada a ' + [x, z]);
  }
  async function mark(name) {
    const d = await diag(page);
    stops.push({ name, seconds: +( (performance.now() - start)/1000 ).toFixed(1),
      region: d.region, position: d.position, shelter: d.shelter });
    console.log(width, name, d.position);
  }
  async function measure(scene) {
    const result = await page.evaluate(async () => {
      const canvas = document.getElementById('forestCanvas');
      const start = Number(canvas.dataset.frames);
      do { await new Promise(requestAnimationFrame); }
      while (Number(canvas.dataset.frames) < start + 36);
      const d = DaviForest.diagnostics();
      const frames = d.frameMs.slice(-36).sort((a,b) => a-b);
      return { p95ms: frames[Math.ceil(frames.length*.95)-1], calls: d.calls,
        triangles: d.triangles, loadMs: d.readyMs, geometryBytes: d.geometryBufferBytes,
        textureBytes: d.estimatedTextureBytes, pixelRatio: d.pixelRatio, low: d.low };
    });
    if (profile) assert.equal(result.low, profile === 'low');
    samples.push({ scene, ...result });
  }
  function shot(name) {
    return page.screenshot({ path: path.join(out, name + '-' + suffix + '.png') });
  }
  async function record() {
    save(stem, { stops, samples, stages, fork, canvas, activeTask: guided.title, width,
      renderer: (await diag(page)).renderer });
  }
  const phase = (stage) => page.waitForFunction((name) =>
    DaviForest.diagnostics().shelter.phase === name, stage);
  async function visualFrame(name) {
    const d = await diag(page);
    stages.push({ name, seconds: +((performance.now() - start)/1000).toFixed(2),
      camera: d.camera, leafRoll: d.shelter.leafRoll, basin: d.shelter.wetBasin,
      fill: d.shelter.basinFill, beetle: d.shelter.beetle, calls: d.calls, triangles: d.triangles });
    await shot(name);
  }
  const showHud = (visible) => page.evaluate((show) => {
    const nodes = document.querySelectorAll(`
      .trail-shell #forestInteract, .trail-shell #forestMessage, .trail-shell .forest-route,
      .trail-shell .forest-camera, .trail-shell .forest-dpad, .trail-hud,
      .trail-shell .forest-pipo, .trail-shell .forest-instructions`);
    for (const node of nodes) {
      if (show) node.style.removeProperty('visibility');
      else node.style.setProperty('visibility', 'hidden', 'important');
    }
  }, visible);
  async function expectShelter(expected) {
    await page.waitForFunction((beetle) => {
      const current = DaviForest.diagnostics().shelter.beetle;
      return Math.hypot(current[0]-beetle[0],current[2]-beetle[2]) < .06;
    }, expected.beetle);
    const current = (await diag(page)).shelter;
    assert.equal(current.leafUp, expected.leafUp);
    assert.deepEqual(current.pool, expected.pool);
    assert(distance(current.beetle, expected.beetle) < .06);
  }
  const before = await (await api.get('/api/world')).json();
  const events = '/api/calendar?start=2026-11-17&end=2026-11-17';
  const agenda = async () => (await (await api.get(events)).json()).events;
  const beforeEvent = (await agenda()).find((item) => item.id === guided.id);
  assert.equal(before.stars, 0);
  if (profile) {
    await press('forest-options');
    await page.locator('#forestQuality').selectOption(profile);
    await press('forest-close');
  }
  await write('/api/forest/map/move',{x:28,z:14},'put');
  await page.reload();
  await ready(page);
  assert.equal((await diag(page)).place,'trail');
  await page.evaluate(() => scrollTo(0, 0));
  await mark('soleira');
  await walk(2.7, 11.5);
  await walk(3.6, 8.6);
  await walk(2.68, 6.5);
  await page.waitForTimeout(400);
  const fork = { casca: await point(1.25, 4.72), lajes: await point(3.72, 4.21) };
  for (const branch of Object.values(fork)) assert(branch.groundVisible && branch.free, JSON.stringify(fork));
  await shot('bifurcacao');
  if(profile) await measure('bifurcacao');
  if (mobile) {
    await touch(fork.lajes);
    await page.waitForFunction(() => {
      const d = DaviForest.diagnostics();
      return !d.target && Math.hypot(d.position[0]-31.72,d.position[2]-4.21)<.18;
    });
    await walk(2.68, 6.5);
  }
  await walk(1.25, 4.72);
  await walk(-1, 4.2);
  await walk(-5.3, 2.1);
  const enter = async () => { await walk(-7.4, 2.6); await walk(-9, 1.4); };
  const leave = async () => { await walk(-7.4, 2.6); await walk(-5.3, 2.1); };
  await enter();
  await page.waitForTimeout(2050);
  const canvas = await page.locator('#forestCanvas').boundingBox();
  if (visualEvidence) await showHud(false);
  await mark('folha inicial');
  if (visualEvidence) await visualFrame('encontro');
  else await shot('encontro');
  const initial = (await diag(page)).shelter;
  assert.equal(initial.leafUp, false);
  if (visualEvidence && !captureOnly) await page.waitForTimeout(1350);
  if (width === 360 || visualEvidence) {
    const target = await page.evaluate(() => {
      const [x, y, z] = DaviForest.diagnostics().shelter.leaf;
      return DaviForest.project(x, z, y + .10);
    });
    assert(target.visible);
    await touch(target);
  } else if (mobile) {
    await press('forest-nearby');
  } else {
    await page.locator('#forestCanvas').focus();
    await page.keyboard.press('e');
  }
  await page.waitForFunction(() => DaviForest.diagnostics().shelter.leafUp);
  if (visualEvidence) {
    await phase('flip');
    await page.waitForTimeout(210);
    await visualFrame('virada');
    await phase('water');
    await visualFrame('goteira');
    await phase('carry');
    await page.waitForTimeout(535);
    await visualFrame('transporte');
    assert.equal(stages[0].basin, stages[1].basin);
    assert.notEqual(stages[0].basin, stages[2].basin);
    assert(distance(stages[0].beetle, stages[2].beetle) < .22);
    assert(distance(stages[0].beetle, stages[3].beetle) > .22);
  }
  await phase('rest');
  const changed = (await diag(page)).shelter;
  assert(distance(initial.beetle, changed.beetle) > .65);
  assert(distance(initial.pool, changed.pool) > 1);
  await mark('folha virada');
  if (visualEvidence) {
    await visualFrame('abrigo');
    for (const frame of stages)
      assert(Math.hypot(...frame.camera.map((v,i)=>v-stages[0].camera[i])) < .002, 'enquadramento fixo');
  } else await shot('abrigo');
  if(profile) await measure('abrigo');
  if(captureOnly) {
    assert.deepEqual(await (await api.get('/api/world')).json(),before);
    await record();
    return;
  }
  if (visualEvidence) await page.waitForTimeout(850);
  await leave();
  if (shortRevisit) {
    await mark('fora do recanto');
  } else {
    await walk(-6, -1.8);
    await walk(-4, -4.7);
    await walk(0, -7);
    await mark('garganta');
    assert.match((await diag(page)).region, /Garganta/);
    await walk(3, -5.7);
    await walk(6.3, -3.1);
    await walk(7, .3);
    await walk(5.4, 3.2);
    await walk(2.4, 5);
    await walk(-1, 4.2);
    await walk(-5.3, 2.1);
  }
  if (visualEvidence) await action('forest-camera').evaluate(button => button.click());
  else await press('forest-camera');
  await page.waitForTimeout(850);
  await enter();
  await page.waitForTimeout(1550);
  await mark('retorno ao tronco');
  await expectShelter(changed);
  if (visualEvidence) {
    await visualFrame('revisita');
    assert(Math.hypot(...stages.at(-1).camera.map((v,i)=>v-stages[0].camera[i])) < .19, 'mesmo enquadramento na volta');
    await page.waitForTimeout(900);
    await showHud(true);
  }
  const where = (await diag(page)).position;
  await press('child-now');
  await page.locator('[data-action=game-learn]').waitFor();
  await page.getByText('Mochila de teste', { exact: true }).first().waitFor();
  await page.waitForTimeout(850);
  await press('game-exit');
  await ready(page);
  assert(distance(where, (await diag(page)).position) < .035);
  await expectShelter(changed);
  if (mobile) {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await ready(page);
    await expectShelter(changed);
    if (visualEvidence) {
      await showHud(false);
      await visualFrame('reduzido');
      await showHud(true);
    }
    await press('forest-nearby');
    await page.waitForFunction(() => !DaviForest.diagnostics().shelter.leafUp);
    await expectShelter(initial);
    await press('forest-options');
    await press('forest-fallback');
    await page.locator('#worldMap').waitFor();
    await press('world-forest');
    await ready(page);
    assert(distance(where, (await diag(page)).position) < .035);
    assert(!(await page.evaluate(() => DaviWorld.diagnostics().active)));
  }
  const after = await (await api.get('/api/world')).json();
  assert.deepEqual(after, before);
  assert.deepEqual((await agenda()).find((item) => item.id === guided.id), beforeEvent);
  await record();
}, (visualEvidence || !mobile) && !captureOnly, { stars: 0, viewport: { width, height }, videoSize: { width, height }, videoFps: 24 })
  .catch((error) => { console.error(error); process.exitCode = 1; });
