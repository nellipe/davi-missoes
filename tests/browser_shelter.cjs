const assert = require('node:assert/strict');
const path = require('node:path');
const { session, diag, ready, distance, out, save } = require('./forest_session.cjs');

const width = Number(process.argv[2] || 1366);
const mobile = width < 700;
const height = mobile ? 850 : 820;
const stem = 'besouro-' + width;

session(stem, async ({ page, api, guided }) => {
  const start = performance.now();
  const stops = [];
  const action = (name) => page.locator('[data-action="' + name + '"]');
  const press = (name) => mobile ? action(name).tap() : action(name).click();
  const point = (x, z) => page.evaluate(([a, b]) => {
    const p = DaviForest.project(a, b);
    return { ...p, free: document.elementFromPoint(p.x, p.y)?.id === 'forestCanvas' };
  }, [x, z]);
  const touch = (p) => mobile ? page.touchscreen.tap(p.x, p.y) : page.mouse.click(p.x, p.y);
  async function walk(x, z) {
    for (let n = 0; n < 20; n++) {
      const before = await diag(page);
      const [a, , b] = before.position;
      const len = Math.hypot(x - a, z - b);
      if (len < .19) return;
      let target;
      for (const step of [2.5, 1.8, 1.2, .65, .38]) {
        const t = Math.min(1, step / len);
        const p = await point(a + (x - a) * t, b + (z - b) * t);
        if (p.groundVisible && p.free) {
          target = p;
          break;
        }
      }
      if (!target) {
        await page.locator('[data-action=forest-rotate][data-turn="1"]').click();
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
        await page.locator('[data-action=forest-rotate][data-turn="1"]').click();
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
  function shot(name) {
    return page.screenshot({ path: path.join(out, name + '-' + width + '.png') });
  }
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
  await press('forest-enter-trail');
  await page.waitForFunction(() => DaviForest.diagnostics().place === 'trail');
  await ready(page);
  await page.evaluate(() => scrollTo(0, 0));
  await mark('soleira');
  await walk(2.7, 11.5);
  await walk(3.6, 8.6);
  await walk(2.68, 6.5);
  await page.waitForTimeout(400);
  const fork = { casca: await point(1.25, 4.72), lajes: await point(3.72, 4.21) };
  for (const branch of Object.values(fork)) assert(branch.groundVisible && branch.free, JSON.stringify(fork));
  await shot('bifurcacao');
  if (mobile) {
    await touch(fork.lajes);
    await page.waitForFunction(() => {
      const d = DaviForest.diagnostics();
      return !d.target && Math.hypot(d.position[0]-3.72,d.position[2]-4.21)<.18;
    });
    await walk(2.68, 6.5);
  }
  await walk(1.25, 4.72);
  await walk(-1, 4.2);
  await walk(-5.3, 2.1);
  const enter = async () => { await walk(-7.4, 2.6); await walk(-9, 1.4); };
  const leave = async () => { await walk(-7.4, 2.6); await walk(-5.3, 2.1); };
  await enter();
  await page.waitForTimeout(1450);
  await mark('folha inicial');
  await shot('encontro');
  const initial = (await diag(page)).shelter;
  assert.equal(initial.leafUp, false);
  if (width === 360) {
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
  await page.waitForTimeout(1550);
  const changed = (await diag(page)).shelter;
  assert(distance(initial.beetle, changed.beetle) > .65);
  assert(distance(initial.pool, changed.pool) > 1);
  await mark('folha virada');
  await shot('abrigo');
  await leave();
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
  await press('forest-camera');
  await page.waitForTimeout(850);
  await walk(-1, 4.2);
  await walk(-5.3, 2.1);
  await enter();
  await page.waitForTimeout(1550);
  await mark('retorno ao tronco');
  await expectShelter(changed);
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
  save(stem, { stops, fork, activeTask: guided.title, width, renderer: (await diag(page)).renderer });
}, !mobile, { stars: 0, viewport: { width, height }, videoSize: { width, height }, videoFps: 24 })
  .catch((error) => { console.error(error); process.exitCode = 1; });
