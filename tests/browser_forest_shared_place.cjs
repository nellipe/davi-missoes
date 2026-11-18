const assert = require('node:assert/strict');
const { session, ready, diag, save } = require('./forest_session.cjs');

session(
  'agenda-cheia',
  async ({ page, write }) => {
    for (let i = 0; i < 48; i++) {
      await write('/api/events', {
        title: 'Atividade sintética ' + (i + 1),
        time: '13:00',
        start_date: '2026-11-17',
      });
    }
    await page.reload();
    await ready(page);
    const activities = (await diag(page)).features.filter((f) => f.id.startsWith('activity-'));
    assert.equal(activities.length, 50);
    const first = activities[0];
    const other = activities.find((f) => f.id !== first.id && f.x === first.x && f.z === first.z);
    assert(other, 'fixture must exercise coincident markers');
    const visits = [];
    for (const expected of [first, other]) {
      await page.locator('[data-action=forest-paths]').click();
      await page.locator('#forestDialog [data-action=forest-travel][data-id="' + expected.id + '"]').click();
      await page.waitForFunction(() => !DaviForest.diagnostics().target, null, { polling: 150 });
      await page.locator('#forestInteract').click();
      const actual = await page.locator('#forestDialogTitle').innerText();
      visits.push({ id: expected.id, expected: expected.title, actual });
      await page.locator('[data-action=forest-close]').click();
    }
    save('agenda-cheia', { total: activities.length, point: [first.x, first.z], visits });
    assert(
      visits.every((v) => v.expected === v.actual),
      JSON.stringify(visits)
    );
  },
  false
).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
