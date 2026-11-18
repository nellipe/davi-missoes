const assert = require('node:assert/strict');
const { session, ready, diag, save, distance } = require('./forest_session.cjs');
session(
  'fallback',
  async ({ page, context, errors }) => {
    await page.goto('/?homologacao=1');
    await ready(page);
    const at = (await diag(page)).position;
    await page.evaluate(() => {
      window.testLoss = document
        .querySelector('#forestCanvas')
        .getContext('webgl2')
        .getExtension('WEBGL_lose_context');
      testLoss.loseContext();
    });
    await page.waitForFunction(() => ForestQA.events.some((e) => e.type === 'webgl-lost'));
    await page.waitForTimeout(300);
    await page.evaluate(() => testLoss.restoreContext());
    await page.waitForFunction(
      () => ForestQA.events.some((e) => e.type === 'webgl-restored') && DaviForest.diagnostics().webgl
    );
    assert(distance(at, (await diag(page)).position) < 0.025);
    await page.evaluate(() => testLoss.loseContext());
    await page.locator('#worldMap').waitFor({ timeout: 12000 });
    const events = await page.evaluate(() => ForestQA.events.map((e) => e.type));
    assert(events.includes('fallback'));
    assert.equal((await diag(page)).view, '2d');
    assert.equal((await diag(page)).webgl, false);
    await page.locator('[data-action=world-forest]').click();
    await ready(page);
    assert(distance(at, (await diag(page)).position) < 0.025);
    const noGL = await context.newPage(),
      noGLErrors = [];
    noGL.on('pageerror', (e) => noGLErrors.push(e.message));
    await noGL.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        return /^webgl/.test(kind) ? null : orig.call(this, kind, ...args);
      };
    });
    await noGL.goto('/');
    await noGL.locator('#worldMap').waitFor();
    await noGL.locator('[data-action=forest-calendar]').first().click();
    await noGL.locator('[data-action=world-home]').waitFor();
    assert((await noGL.locator('#content').innerText()).includes('História de teste'));
    assert.deepEqual(noGLErrors, []);
    await noGL.close();
    save('fallback', { events, noWebGL: '2D e agenda', resumed: at, errors, noGLErrors });
  },
  false
).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
