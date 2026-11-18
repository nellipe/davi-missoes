const assert = require('node:assert/strict');
const path = require('node:path');
process.env.FOREST_EVIDENCE_DIR ||= path.resolve(__dirname, '../docs/evidencias-etapa3');
const { session, diag, ready, save, out, distance } = require('./forest_session.cjs');
const mobile = process.argv.includes('--mobile');
const width = mobile ? 390 : 1366;
session(
  mobile ? 'trilha-retrato' : 'volta-dos-barquinhos',
  async ({ page, api, errors }) => {
    const started = performance.now(),
      stops = [],
      samples = [];
    const click = (action) =>
      page
        .locator('[data-action="' + action + '"]')
        .first()
        .click();
    const shot = async (name) => {
      await page.screenshot({ path: path.join(out, name + '.png') });
    };
    const mark = async (name) => {
      const d = await diag(page);
      stops.push({
        name,
        seconds: +((performance.now() - started) / 1000).toFixed(1),
        position: d.position,
        region: d.region,
      });
      console.log(name, d.position);
    };
    const walk = async (x, z) => {
      let d = await diag(page);
      for (let i = 0; i < 12; i++) {
        const [a, , b] = d.position,
          len = Math.hypot(x - a, z - b);
        if (len < 0.18) return;
        let p;
        for (const step of [2.45, 1.85, 1.25, 0.72, 0.44]) {
          const t = Math.min(step / len, 1);
          const point = await page.evaluate(
            ([u, v]) => {
              const p = DaviForest.project(u, v);
              return { ...p, free: document.elementFromPoint(p.x, p.y)?.id === 'forestCanvas' };
            },
            [a + (x - a) * t, b + (z - b) * t]
          );
          if (point.groundVisible && point.free) {
            p = point;
            break;
          }
        }
        if (!p) {
          await page.locator('[data-action=forest-rotate][data-turn="1"]').click();
          await page.waitForTimeout(700);
          continue;
        }
        if (mobile) await page.touchscreen.tap(p.x, p.y);
        else await page.mouse.click(p.x, p.y);
        await page.waitForTimeout(180);
        let count = 0;
        do {
          d = await diag(page);
          assert(d.navigationValid && d.pipoNavigationValid && d.webgl);
          assert(d.screenPosition.every((v) => Math.abs(v) < 1));
          samples.push({
            gap: distance(d.position, d.pipoPosition),
            feet: Math.abs(d.feetY - d.renderedGroundY),
            calls: d.calls,
            triangles: d.triangles,
            frame: d.frameMs.at(-1),
            low: d.low,
          });
          assert(samples.at(-1).gap < 2.65, 'Pipo distante em ' + d.position);
          if (d.target) await page.waitForTimeout(170);
        } while (d.target && count++ < 45);
        assert(
          !d.target && Math.hypot(d.position[0] - a, d.position[2] - b) > 0.07,
          'sem avanço em ' + d.position + ' para ' + [x, z]
        );
      }
      throw Error('falha ao chegar a ' + [x, z]);
    };
    const world = async () => await (await api.get('/api/world')).json();
    const sliceRenderer = (await diag(page)).renderer;
    const old = await world();
    assert.equal(old.stars, 0);
    assert.equal(old.inventory.length, 0);
    await click('forest-enter-trail');
    await page.waitForFunction(
      () =>
        DaviForest.diagnostics().place === 'trail' && document.querySelector('#forestCanvas[data-ready=true]')
    );
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(380);
    await mark('Soleira');
    await shot('soleira-' + width);
    const entrance = await page.evaluate(() => DaviForest.project(-4, -12.5));
    assert(!entrance.groundVisible, 'mirante visível da entrada');
    await click('forest-nearby');
    await page.waitForTimeout(600);
    await walk(2.7, 11.5);
    await walk(3.6, 8.6);
    await walk(2.9, 6.7);
    await page.waitForTimeout(500);
    await shot('bifurcacao-' + width);
    await walk(2.4, 5);
    await mark('Bifurcação');
    await click('forest-hint');
    await page.waitForTimeout(650);
    if (mobile) {
      await page.setViewportSize({ width: 360, height: 850 });
      await page.waitForTimeout(330);
      await shot('bifurcacao-360');
      const at = (await diag(page)).position;
      await page.reload();
      await ready(page);
      assert(distance(at, (await diag(page)).position) < 0.025);
      await click('forest-options');
      await click('forest-fallback');
      await page.locator('#worldMap').waitFor();
      await click('child-now');
      await page.locator('[data-action=game-learn]').waitFor();
      await click('game-exit');
      await page.locator('#worldMap').waitFor();
      await click('world-forest');
      await ready(page);
      assert(distance(at, (await diag(page)).position) < 0.025);
      assert(!(await page.evaluate(() => DaviWorld.diagnostics().active)));
      await page.locator('#forestCanvas').focus();
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(220);
      assert.equal((await diag(page)).animation, 'Walk');
      await page.keyboard.up('ArrowRight');
      await walk(5.4, 3.2);
      await walk(7, 0.3);
      await click('forest-nearby');
      await mark('Lajes na ida');
      await walk(6.3, -3.1);
      await walk(3, -5.7);
      await walk(0, -7);
      await walk(-1.8, -9.6);
      await walk(-4, -12.5);
      await mark('Garganta por cima');
      await shot('garganta-360');
      await page.setViewportSize({ width, height: 850 });
    } else {
      await walk(-1, 4.2);
      await walk(-5.3, 2.1);
      await mark('Trilha da casca');
      await shot('casca-1366');
      await walk(-7.4, 2.6);
      await walk(-9, 1.4);
      await click('forest-nearby');
      assert.match(await page.locator('#forestMessage').innerText(), /prateado/);
      await mark('Avesso da folha');
      await shot('tronco-1366');
      await page.waitForTimeout(800);
      await walk(-7.4, 2.6);
      await walk(-5.3, 2.1);
      await walk(-6, -1.8);
      await walk(-4, -4.7);
      await walk(0, -7);
      await mark('Reencontro');
      await walk(-1.8, -9.6);
      await walk(-4, -12.5);
      await click('forest-nearby');
      await mark('Janela da queda');
      await shot('garganta-1366');
      await page.waitForTimeout(700);
      await walk(-1.8, -9.6);
      await walk(0, -7);
      await walk(3, -5.7);
      await walk(6.3, -3.1);
      await walk(7, 0.3);
      await click('forest-nearby');
      assert.match(await page.locator('#forestMessage').innerText(), /responde/);
      await mark('Eco nas lajes');
      await shot('lajes-1366');
      await walk(5.4, 3.2);
      await walk(2.4, 5);
      await walk(3.6, 8.6);
      await walk(2.7, 11.5);
      await walk(0, 14);
      await mark('Volta à roda');
    }
    const before = (await diag(page)).position;
    await click('child-now');
    await page.locator('[data-action=game-learn]').waitFor();
    await page.waitForTimeout(800);
    await shot('agora-' + width);
    await click('game-exit');
    await ready(page);
    await mark('Retorno de Agora');
    assert(distance(before, (await diag(page)).position) < 0.035);
    assert.equal((await diag(page)).place, 'trail');
    const end = await world();
    assert.equal(end.stars, 0);
    assert.deepEqual(end.avatar, old.avatar);
    await click('forest-leave-trail');
    await ready(page);
    await page.waitForFunction(() => DaviForest.diagnostics().place === 'forest');
    const frames = samples
      .map((s) => s.frame)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    save('resultado-' + width, {
      stops,
      overlookVisibleFromStart: entrance.groundVisible,
      samples: samples.length,
      renderer: sliceRenderer,
      frameP95ms: frames[Math.floor(frames.length * 0.95)],
      maxGap: Math.max(...samples.map((s) => s.gap)),
      maxFeetError: Math.max(...samples.map((s) => s.feet)),
      maxCalls: Math.max(...samples.map((s) => s.calls)),
      maxTriangles: Math.max(...samples.map((s) => s.triangles)),
      low: samples.at(-1).low,
      stars: end.stars,
      errors,
    });
  },
  !mobile,
  {
    stars: 0,
    viewport: { width, height: mobile ? 850 : 820 },
    videoSize: { width: 1366, height: 820 },
    videoFps: 24,
  }
).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
