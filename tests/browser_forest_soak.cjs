const assert = require('node:assert/strict');
const { session, diag, save, distance } = require('./forest_session.cjs');
session('sessao-10min', async ({ page, context, browser, errors }) => {
  await page.locator('[data-action=forest-options]').click();
  await page.locator('#forestQuality').selectOption('low');
  await page.locator('[data-action=forest-close]').click();
  const cdp = await context.newCDPSession(page);
  const memory = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    const { usedSize } = await cdp.send('Runtime.getHeapUsage');
    return { heapAfterGc: usedSize, ...(await cdp.send('Memory.getDOMCounters')) };
  };
  const warm = await diag(page),
    samples = [],
    memorySamples = [];
  const started = performance.now();
  let intervals = 0,
    travel = 0,
    previous = warm.position,
    previousFrame = warm.frames;
  const frameTimes = [];
  let direction = 'ArrowRight';
  while (performance.now() - started < 600000) {
    await page.keyboard.down(direction);
    await page.waitForTimeout(1800);
    const d = await diag(page);
    frameTimes.push(...d.frameMs.slice(-Math.min(d.frames - previousFrame, d.frameMs.length)));
    previousFrame = d.frames;
    await page.keyboard.up(direction);
    direction = d.position[0] > warm.position[0] + 1 ? 'ArrowLeft' : 'ArrowRight';
    travel += distance(d.position, previous);
    previous = d.position;
    assert(d.webgl && d.low && d.navigationValid);
    assert.equal(d.animation, 'Walk');
    assert.equal(d.moving, true);
    assert(d.screenPosition.every((v) => Math.abs(v) < 1));
    assert(distance(d.position, d.pipoPosition) < 2.25);
    samples.push({
      s: +((performance.now() - started) / 1000).toFixed(2),
      frames: d.frames,
      x: d.position[0],
      z: d.position[2],
      feetError: d.feetY - d.surfaceY,
      companionDistance: distance(d.position, d.pipoPosition),
      calls: d.calls,
      triangles: d.triangles,
      geometries: d.geometries,
      textures: d.textures,
      jsHeap: d.jsHeapBytes,
    });
    if (samples.at(-1).s >= intervals * 60) {
      memorySamples.push({ s: samples.at(-1).s, ...(await memory()) });
      console.log('soak', samples.at(-1).s, d.frames);
      intervals++;
    }
  }
  await page.waitForTimeout(450);
  const end = await diag(page),
    elapsed = (performance.now() - started) / 1000;
  assert.equal(end.animation, 'Idle');
  assert(travel > 150);
  assert.equal(end.geometries, samples[0].geometries);
  assert.equal(end.textures, samples[0].textures);
  frameTimes.sort((a, b) => a - b);
  const frameQuantilesMs = Object.fromEntries(
    [50, 95, 99].map((q) => [q, frameTimes[Math.floor((q / 100) * frameTimes.length)]])
  );
  save('sessao-10min', {
    synthetic: true,
    viewport: [1100, 820],
    quality: 'low',
    renderer: warm.renderer,
    browser: browser.version(),
    elapsed,
    travel,
    fps: (end.frames - warm.frames) / elapsed,
    frameSamples: frameTimes.length,
    frameQuantilesMs,
    longestFrameMs: frameTimes.at(-1),
    readyMs: warm.readyMs,
    geometryBytes: end.geometryBufferBytes,
    estimatedTextureBytes: end.estimatedTextureBytes,
    samples,
    memorySamples,
    errors,
  });
}).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
