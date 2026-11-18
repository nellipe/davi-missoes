const assert = require('node:assert/strict');
const { session, diag, ready, save, distance } = require('./forest_session.cjs');
const baseline = process.argv.includes('--observe');
session(
  'contacts',
  async ({ page, write, api }) => {
    const place = async (x, z) => {
      await write('/api/forest/move', { x, z }, 'put');
      await page.reload();
      await ready(page);
      await page.waitForTimeout(300);
    };
    const touch = async (x, z) => {
      const p = await page.evaluate(
        ([x, z]) => {
          const p = DaviForest.project(x, z);
          return { ...p, element: document.elementFromPoint(p.x, p.y)?.id };
        },
        [x, z]
      );
      assert.equal(p.element, 'forestCanvas', JSON.stringify(p));
      await page.touchscreen.tap(p.x, p.y);
      await page.waitForTimeout(1650);
      return (await diag(page)).position;
    };
    const state = await (await api.get('/api/world')).json();
    const barrier = async (x, z, key) => {
      await place(x, z);
      await page.locator('#forestCanvas').focus();
      await page.keyboard.down(key);
      const path = [];
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(110);
        const d = await diag(page);
        assert(d.navigationValid);
        path.push({ x: d.position[0], z: d.position[2], animation: d.animation });
      }
      await page.keyboard.up(key);
      return path;
    };
    const bank = await barrier(0, 1.1, 'ArrowUp');
    assert(bank.every((p) => p.z >= 0.7 - 1.1 * Math.sin(p.x * 0.2)));
    await write('/api/world/buy', {
      item_id: 'bridge',
      price: state.catalog.find((i) => i.id === 'bridge').price,
    });
    const rail = await barrier(0.6, -2, 'ArrowRight');
    assert(rail.every((p) => Math.abs(p.x) < 1.03));
    await place(0, -1.3);
    const bridgeTarget = [0, 0, -2.25],
      actual = await touch(0, -2.25);
    const contacts = [];
    // Approach along the right axis of the default camera.
    for (const c of [
      { kind: 'rock', center: [-6, 5], r: 1.1 },
      { kind: 'tree', center: [-10, 3], r: 1 },
    ]) {
      const [x, z] = c.center,
        dx = Math.cos(0.55),
        dz = -Math.sin(0.55);
      await place(x - dx * (c.r + 1.1), z - dz * (c.r + 1.1));
      await page.locator('#forestCanvas').focus();
      await page.keyboard.down('ArrowRight');
      let min = Infinity;
      const points = [];
      let lastPose;
      for (let i = 0; i < 13; i++) {
        await page.waitForTimeout(90);
        const d = await diag(page);
        lastPose = d.animation;
        min = Math.min(min, Math.hypot(d.position[0] - x, d.position[2] - z));
        points.push([d.position[0], d.position[2]]);
      }
      await page.keyboard.up('ArrowRight');
      contacts.push({ ...c, min, points, lastPose });
    }
    const result = {
      bridgeTarget,
      actual,
      bridgeError: distance(actual, bridgeTarget),
      bank,
      rail,
      contacts,
    };
    save(baseline ? 'contatos-base' : 'contatos', result);
    console.log(JSON.stringify(result));
    if (!baseline) {
      assert(result.bridgeError < 0.2);
      for (const c of contacts) {
        assert(c.min >= c.r + 0.23 - 1e-6, c.kind);
        assert.equal(c.lastPose, 'Idle', c.kind);
      }
    }
  },
  false
).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
