const { chromium, request } = require('playwright');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const out = process.env.FOREST_EVIDENCE_DIR || path.join(root, 'docs/evidencias-issue18/etapa2');
const ready = (page) => page.locator('#forestCanvas[data-ready=true]').waitFor({ timeout: 20000 });
const diag = (page) => page.evaluate(() => DaviForest.diagnostics());
const distance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const save = (name, value) =>
  fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(value, null, 2) + '\n');
async function session(
  name,
  run,
  record = true,
  {
    stars = 40,
    viewport = { width: 1100, height: 820 },
    videoSize = { width: 880, height: 656 },
    videoFps = 12,
  } = {}
) {
  fs.mkdirSync(out, { recursive: true });
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'forest-regression-'));
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const base = 'http://127.0.0.1:' + port;
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('DAVI_')));
  const password = randomUUID();
  Object.assign(env, {
    DAVI_DATA_DIR: temp,
    DAVI_HOST: '127.0.0.1',
    DAVI_PORT: String(port),
    FIXTURE_PASSWORD: password,
  });
  const seed = [
    'import server, datetime, os',
    'server.timing.now=lambda:datetime.datetime(2026,11,17,11,15,tzinfo=server.TZ)',
    'server.initialize()',
    'server.set_setting("password",server.hash_password(os.environ["FIXTURE_PASSWORD"]))',
    'with server.db() as c:',
    ...(stars
      ? [
          ` c.execute("INSERT INTO world_ledger(id,delta,label,day) VALUES(?,?,?,?)",("qa",${Number(stars)},"Sintético","2026-11-17"))`,
        ]
      : []),
    ' c.execute("UPDATE world_state SET x=530,y=445")',
    'server.main()',
  ].join('\n');
  const server = spawn('python', ['-c', seed], {
    cwd: root,
    env,
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });
  server.stderr.resume();
  let browser, api;
  try {
    api = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
    for (let i = 0; i < 100; i++) {
      try {
        if ((await api.get('/api/me')).ok()) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    assert((await api.post('/api/login', { data: { password } })).ok());
    const { csrf } = await (await api.get('/api/me')).json();
    const write = async (url, data, method = 'post') => {
      const r = await api[method](url, { data, headers: { 'X-CSRF-Token': csrf } });
      assert(r.ok(), await r.text());
      return r.json();
    };
    const guided = await write('/api/events', {
      title: 'Mochila de teste',
      time: '11:00',
      duration: 30,
      start_date: '2026-11-17',
      recurrence: 'daily',
    });
    await write('/api/events/' + guided.id + '/mission', { template_id: 'mochila' }, 'put');
    const plain = await write('/api/events', {
      title: 'História de teste',
      time: '15:00',
      duration: 30,
      start_date: '2026-11-17',
    });
    browser = await chromium.launch({
      args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-software-rasterizer'],
    });
    const context = await browser.newContext({
      baseURL: base,
      viewport,
      hasTouch: true,
      locale: 'pt-BR',
      extraHTTPHeaders: { Origin: base },
      ...(record ? { recordVideo: { dir: temp, size: videoSize } } : {}),
    });
    assert(
      (
        await context.request.post(base + '/api/pair', {
          data: { code: (await write('/api/devices/code', {})).code },
        })
      ).ok()
    );
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.setDefaultTimeout(9000);
    await page.goto(base);
    await ready(page);
    await run({ page, context, api, guided, plain, errors, write, browser });
    assert.deepEqual(errors, []);
    const video = page.video();
    await context.close();
    if (video)
      execFileSync(
        'ffmpeg',
        [
          '-loglevel',
          'error',
          '-y',
          '-i',
          await video.path(),
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-crf',
          '30',
          '-r',
          String(videoFps),
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
          path.join(out, name + '.mp4'),
        ],
        { windowsHide: true }
      );
  } finally {
    if (browser) await browser.close();
    if (api) await api.dispose();
    const exited = new Promise((resolve) => server.once('exit', resolve));
    if (server.exitCode === null && server.kill()) await exited;
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5 });
  }
}
module.exports = { session, diag, ready, distance, save, out };
