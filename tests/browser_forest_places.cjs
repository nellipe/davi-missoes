const assert = require('node:assert/strict');
const path = require('node:path');
const { session, diag, ready, save, distance, out } = require('./forest_session.cjs');
session('percurso', async ({ page, api, context, guided, plain, errors }) => {
  const started = performance.now(),
    places = [],
    samples = [];
  const click = (name, scope = page) =>
    scope
      .locator('[data-action="' + name + '"]')
      .first()
      .click();
  const dialog = page.locator('#forestDialog');
  const features = (await diag(page)).features;
  const order = [
    'calendar',
    'activity-' + plain.id,
    'wardrobe',
    'portal',
    'shop',
    'activity-' + guided.id,
    'missions',
    'bridge',
    'house',
    'chest',
  ];
  for(const id of order)assert(features.some(f=>f.id===id), 'Destino anterior preservado '+id);
  const titles = {
    wardrobe: 'Seu jeito de explorar',
    portal: 'Portal dos jogos',
    shop: 'Oficina do bosque',
    missions: 'Seu diário de missões',
    bridge: 'A ponte do riacho',
    house: 'Uma casa entre as folhas',
    chest: 'O baú das descobertas',
  };
  const original = await (await api.get('/api/world')).json();
  const inspect = async () => {
    const d = await diag(page);
    assert(d.navigationValid && d.webgl && d.screenPosition.every((v) => Math.abs(v) < 1));
    assert.equal(d.moving, d.animation === 'Walk');
    const gap = distance(d.position, d.pipoPosition);
    assert(d.pipoNavigationValid);
    if (d.renderedBoardY != null) assert(Math.abs(d.feetY - d.renderedBoardY) < 0.07);
    samples.push({
      s: (performance.now() - started) / 1000,
      x: d.position[0],
      z: d.position[2],
      feet: d.feetY,
      surface: d.surfaceY,
      renderedGround: d.renderedGroundY,
      renderedBoard: d.renderedBoardY,
      pipoGap: gap,
      animation: d.animation,
      clipTime: d.animationTime,
      pipo: d.pipoAnimation,
      pipoTime: d.pipoAnimationTime,
    });
    assert(gap < 2.9, 'Pipo ficou para trás: ' + gap);
    assert(Math.abs(d.feetY - d.surfaceY) < 0.065, 'apoio: ' + (d.feetY - d.surfaceY));
    return d;
  };
  for (const id of order) {
    const feature = features.find((f) => f.id === id);
    await click('forest-paths');
    await dialog.locator('[data-action=forest-travel][data-id="' + id + '"]').click();
    let d;
    const until = performance.now() + 23000;
    do {
      await page.waitForTimeout(170);
      d = await inspect();
    } while (d.target && performance.now() < until);
    const near = page.locator('#forestInteract');
    console.log(id, d.position, await near.innerText());
    assert(!d.target && Math.hypot(d.position[0] - feature.x, d.position[2] - feature.z) < 1.8);
    assert((await near.innerText()).includes(feature.title));
    const at = d.position;
    await near.click();
    const visit = { id, title: feature.title, s: (performance.now() - started) / 1000, at };
    if (id === 'calendar' || id === 'activity-' + plain.id) {
      if (id !== 'calendar') {
        assert.equal(await page.locator('#forestDialogTitle').innerText(), feature.title);
        assert.match(await dialog.innerText(), /não tem roteiro/);
        await click('forest-calendar', dialog);
      }
      await page.locator('[data-action=world-home]').waitFor();
      assert((await page.locator('#content').innerText()).includes('História de teste'));
      await click('world-home');
      await ready(page);
    } else if (id === 'activity-' + guided.id) {
      assert.equal(await page.locator('#forestDialogTitle').innerText(), feature.title);
      await click('forest-mission', dialog);
      await page.locator('[data-action=game-learn]').waitFor();
      await page.screenshot({ path: path.join(out, 'missao.png') });
      await click('game-exit');
      await ready(page);
    } else {
      assert.equal(await page.locator('#forestDialogTitle').innerText(), titles[id]);
      if (['bridge', 'house', 'portal'].includes(id)) {
        await dialog.locator('[data-action=forest-buy][data-id="' + id + '"]').click();
        await dialog
          .locator('[data-action="' + (id === 'bridge' ? 'forest-cross' : 'forest-missions') + '"]')
          .waitFor();
      }
      if (id === 'wardrobe') await dialog.locator('[data-action=forest-color][data-color=sky]').click();
      if (id === 'shop') {
        await dialog.locator('[data-action=forest-buy][data-id=buddy]').click();
        await dialog.locator('[data-action=forest-equip][data-id=buddy]').click();
        await page.waitForFunction(() => DaviForest.diagnostics().pipoScarfVisible);
        assert((await diag(page)).pipoScarfVisible);
      }
      if (id === 'bridge') {
        await click('forest-cross', dialog);
        do {
          await page.waitForTimeout(120);
          d = await inspect();
        } while (d.target && performance.now() < until + 10000);
        assert(d.position[2] < -5.2);
        await page.screenshot({ path: path.join(out, 'outra-margem.png') });
      } else await click('forest-close', dialog);
    }
    d = await diag(page);
    if (id !== 'bridge') assert(distance(at, d.position) < 0.025);
    places.push(visit);
  }
  const at = (await diag(page)).position;
  await page.waitForTimeout(850);
  assert.equal((await diag(page)).pipoAnimation, 'Hover');
  assert(new Set(samples.filter((s) => s.pipo === 'Walk').map((s) => s.pipoTime.toFixed(2))).size > 5);
  assert(new Set(samples.filter((s) => s.animation === 'Walk').map((s) => s.clipTime.toFixed(2))).size > 5);
  await page.reload();
  await ready(page);
  const restored = await diag(page);
  assert(distance(restored.position, at) < 0.025 && restored.pipoScarfVisible);
  const end = await (await api.get('/api/world')).json();
  const purchased = ['bridge', 'house', 'portal', 'buddy'];
  const cost = original.catalog.filter((i) => purchased.includes(i.id)).reduce((a, i) => a + i.price, 0);
  assert.equal(end.stars, original.stars - cost);
  assert.equal(end.avatar.color, 'sky');
  const { csrf } = await (await context.request.get('/api/me')).json();
  const denied = await context.request.post('/api/events/' + plain.id + '/done', {
    data: { date: '2026-11-17' },
    headers: { 'X-CSRF-Token': csrf },
  });
  assert.equal(denied.status(), 409);
  const events = (await (await api.get('/api/calendar?start=2026-11-17&end=2026-11-17')).json()).events;
  assert.equal(events.find((e) => e.id === plain.id).done, false);
  save('percurso', {
    places,
    samples,
    restored: restored.position,
    remainingStars: end.stars,
    earlyCompletion: denied.status(),
    errors,
  });
}).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
