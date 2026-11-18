const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { session } = require('./forest_session.cjs');

session('diagnostico', async ({ page, context, parentPassword }) => {
  await page.locator('#parentTab').click();
  await page.locator('#loginForm').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Medir desempenho' }).count(), 0);
  assert.equal((await context.request.get('/api/forest/diagnostics')).status(), 403);

  await page.getByLabel('Senha').fill(parentPassword);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('button', { name: 'Medir desempenho' }).click();
  const panel = page.locator('#forestFamilyDiagnostics');
  await panel.waitFor();
  await page.locator('#forestCanvas[data-ready=true]').waitFor();
  await page.waitForFunction(() => /\d+ FPS/.test(document.querySelector('#forestFamilyDiagnostics output')?.value));
  await panel.locator('summary').click();
  await panel.getByLabel('Aparelho').selectOption('Amazon Fire HD 8 (2022)');
  const download = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Baixar JSON' }).click();
  const report = JSON.parse(await readFile(await (await download).path(), 'utf8'));
  assert.match(report.build.commit, /^[a-f0-9]{40}$/);
  assert.equal(report.build.version, '0.7B-chibi.1');
  assert.equal(report.device.model, 'Amazon Fire HD 8 (2022)');
  assert.equal(report.firstOpeningView, '3d');
  assert(report.firstOpeningMs > 0);
  assert(report.samples.some(sample => sample.view === '3d' && sample.fps > 0 && sample.triangles > 0));
  assert(!/Mochila de teste|História de teste|csrf|password|position/i.test(JSON.stringify(report)));
  await panel.getByRole('button', { name: 'Encerrar' }).click();
  await panel.waitFor({ state: 'detached' });
  console.log('Acesso do responsável, amostragem em 3D e exportação JSON verificados.');
}, false).catch(error => { console.error(error); process.exitCode = 1; });
