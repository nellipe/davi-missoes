const path = require('node:path');
process.env.FOREST_EVIDENCE_DIR ||= path.resolve(__dirname, '../docs/evidencias-etapa3');
const assert = require('node:assert/strict');
const { session, ready, save } = require('./forest_session.cjs');

session(
  'agora',
  async ({ page, guided, plain, write }) => {
    const date = '2026-11-17';
    const extra = await write('/api/events', {
      title: 'Regar a muda de teste',
      time: '11:10',
      duration: 20,
      start_date: date,
    });
    const open = () => page.locator('[data-action=child-now]').click();
    const back = async () => {
      await page.locator('[data-action=world-home]').click();
      await ready(page);
    };
    const tasks = page.locator('#content article.task');

    await open();
    await tasks.nth(1).waitFor();
    assert.equal(await tasks.count(), 2);
    assert.match(await tasks.allTextContents().then((t) => t.join(' ')), /Mochila de teste/);
    assert.match(await tasks.allTextContents().then((t) => t.join(' ')), /Regar a muda/);
    await back();
    await write('/api/events/' + guided.id + '/done', { date });
    await open();
    await tasks.first().waitFor();
    assert.equal(await tasks.count(), 1);
    assert.match(await tasks.innerText(), /Regar a muda/);
    const done = tasks.locator('[data-action=done]');
    assert(await done.isEnabled());
    await done.click();
    await ready(page);
    await open();
    await tasks.first().waitFor();
    assert.match(await tasks.innerText(), /História de teste/);
    assert(await tasks.locator('[data-action=done]').isDisabled());
    await page.locator('[data-action=child-now-calendar]').click();
    await page.locator('#dailyAgenda').waitFor();
    await back();
    await write('/api/events/' + plain.id + '/done', { date });
    await open();
    await page.getByText('Dia livre.', { exact: false }).waitFor();
    await back();
    save('agora', {
      simultaneous: [guided.id, extra.id],
      openUnguided: true,
      futureDisabled: true,
      agendaReached: true,
      freeDay: true,
    });
  },
  false
).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
