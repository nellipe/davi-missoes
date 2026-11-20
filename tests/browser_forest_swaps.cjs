const assert = require('node:assert/strict');
const path = require('node:path');
const { session, diag, ready, distance, save, out } = require('./forest_session.cjs');

session('alternancias', async ({ page, context, errors }) => {
  const cycles = [];
  const cdp = await context.newCDPSession(page);
  const map = page.locator('#worldMap'),
    canvas = page.locator('#forestCanvas');
  const mode = () => diag(page);
  for (let i = 0; i < 30; i++) {
    const width = [360, 390, 1366][i % 3];
    await page.setViewportSize({ width, height: 850 });
    const oldCanvas = await canvas.elementHandle();
    await page.locator('[data-action=forest-options]').click();
    await page.locator('[data-action=forest-fallback]').click();
    await map.waitFor();
    await map.scrollIntoViewIfNeeded();
    await oldCanvas.evaluate((el) =>
      el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 1, clientY: 1, bubbles: true }))
    );
    await oldCanvas.dispose();
    assert.equal((await diag(page)).view, '2d');
    assert.equal((await diag(page)).webgl, false);
    const x2 = i % 2 ? -.55 : .55, z2 = 6.2;
    const svgPoint = await page.evaluate(([x,z])=>DaviForest.project(x,z),[x2,z2]);
    assert(svgPoint.visible, JSON.stringify(svgPoint));
    await page.touchscreen.tap(svgPoint.x, svgPoint.y);
    await page.waitForFunction(([x,z])=>{
      const p=DaviForest.diagnostics().position;
      return Math.hypot(p[0]-x,p[2]-z)<.2;
    },[x2,z2],{timeout:5500});
    await map.focus();
    const held = i % 2 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(held);
    await page.waitForTimeout(110);
    assert((await mode()).keys.length > 0);
    const oldMap = await map.elementHandle();
    const at2d = await page.locator('[data-action=world-forest]').evaluate(button=>{
      const at=DaviForest.diagnostics().position;
      button.click();
      return at;
    });
    await ready(page);
    await oldMap.evaluate((el) =>
      el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 1, clientY: 1, bubbles: true }))
    );
    await oldMap.dispose();
    await page.keyboard.up(held);
    assert.equal(await map.count(),0);
    assert.equal(await page.evaluate(()=>typeof window.DaviWorld),'undefined');
    if (i % 2) {
      await page.locator('[data-action=forest-rotate][data-turn="1"]').click();
      await page.waitForTimeout(750);
    }
    const start = await diag(page);
    assert.deepEqual(start.keys, []);
    assert.equal(start.target, null);
    assert(distance(start.position, at2d) < 0.04, 'o direcional anterior deve parar ao alternar');
    await canvas.scrollIntoViewIfNeeded();
    await canvas.focus();
    const key = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'][i % 4];
    await page.keyboard.down(key);
    await page.waitForTimeout(180);
    const early = await diag(page);
    await page.waitForTimeout(130);
    const moving = await diag(page);
    await page.keyboard.up(key);
    assert(moving.moving && moving.animation === 'Walk' && moving.frameActive && moving.navigationValid);
    assert(early.animation === 'Walk' && Math.abs(early.animationTime - moving.animationTime) > 0.001);
    assert(moving.pipoNavigationValid && distance(early.pipoPosition, moving.pipoPosition) > 0.03);
    const sx = { ArrowLeft: -1, ArrowRight: 1 }[key] || 0,
      sz = { ArrowUp: -1, ArrowDown: 1 }[key] || 0;
    const dx = moving.position[0] - start.position[0],
      dz = moving.position[2] - start.position[2];
    assert(
      dx * (sx * Math.cos(start.angle) + sz * Math.sin(start.angle)) +
        dz * (-sx * Math.sin(start.angle) + sz * Math.cos(start.angle)) >
        0.15
    );
    assert(distance(moving.camera, start.camera) > 0.025);
    assert(moving.screenPosition.every((v) => Math.abs(v) < 1));
    await page.waitForTimeout(250);
    const target = await page.evaluate(() => {
      const [x, , z] = DaviForest.diagnostics().position;
      for (const [dx, dz] of [
        [0.65, 0.6],
        [-0.8, 0.4],
        [0.55, -0.7],
        [0, -1.1],
        [-0.4, 0.9],
      ]) {
        const p = DaviForest.project(x + dx, z + dz);
        if (p.visible && document.elementFromPoint(p.x, p.y)?.id === 'forestCanvas')
          return { screen: p, x: x + dx, z: z + dz };
      }
    });
    assert(target, 'no exposed ground point');
    await page.touchscreen.tap(target.screen.x, target.screen.y);
    await page.waitForFunction(() => !DaviForest.diagnostics().target, null, { polling: 120 });
    const touched = await diag(page);
    const touchError = distance(touched.position, [target.x, 0, target.z]);
    assert(touchError < 0.17, JSON.stringify({ i, touchError, target, pos: touched.position }));
    const origin = await page.evaluate((p) => DaviForest.project(p[0], p[2]), moving.position);
    assert(await page.evaluate((p) => document.elementFromPoint(p.x, p.y)?.id === 'forestCanvas', origin));
    await page.mouse.click(origin.x, origin.y);
    await page.waitForFunction(() => !DaviForest.diagnostics().target, null, { polling: 120 });
    await page.waitForTimeout(250);
    const end = await diag(page);
    const clickError = distance(end.position, moving.position);
    assert(clickError < 0.17 && end.animation === 'Idle' && !end.moving);
    assert(Math.abs(end.feetY - end.renderedGroundY) < 0.05);
    if (i < 3) await page.screenshot({ path: path.join(out, 'remontagem-' + width + '.png') });
    if (width < 700) {
      const pad = page.locator('[data-forest-dir=right]');
      await pad.scrollIntoViewIfNeeded();
      const rect = await pad.boundingBox();
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }],
      });
      await page.waitForTimeout(140);
      assert((await diag(page)).keys.includes('right'));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      assert.deepEqual((await diag(page)).keys, []);
    }
    let resources;
    if (i % 5 === 0 || i === 29) {
      await cdp.send('HeapProfiler.collectGarbage');
      resources = await cdp.send('Memory.getDOMCounters');
    }
    cycles.push({
      cycle: i + 1,
      width,
      key,
      svgPoint,
      x2,
      z2,
      view: end.view,
      touchError,
      clickError,
      feetError: end.feetY - end.renderedGroundY,
      geometries: end.geometries,
      textures: end.textures,
      readyMs: end.readyMs,
      resources,
    });
    console.log('cycle', i + 1, width, touchError, clickError);
  }
  save('alternancias', { cycles, transitions: cycles.length * 2, errors });
  const counts = cycles.filter((c) => c.resources).map((c) => c.resources);
  assert(
    Math.max(...counts.map((c) => c.nodes)) - Math.min(...counts.map((c) => c.nodes)) < 150,
    'detached scenes accumulate across mounts'
  );
  assert.equal(counts.at(-1).jsEventListeners, counts[0].jsEventListeners);
}).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
