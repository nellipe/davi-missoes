// Smoke test for an already serving revision. Browser callbacks never log URLs with query strings or response bodies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash, X509Certificate } = require('node:crypto');
const { chromium } = require('playwright');

if (process.argv[2] === '--check') {
  if (!fs.existsSync(chromium.executablePath())) process.exitCode = 1;
  return;
}
const [hostname, address, port, expected, attempts, sessionFile, certificate] = process.argv.slice(2);
const synthetic = hostname === 'davi-stability.home.arpa' && address === '127.0.0.1' && !!sessionFile && !!certificate;
const production = hostname === 'aventuras.davi.costa' && /^192\.168\.2\.\d{1,3}$/.test(address) &&
  port === '443' && !sessionFile && !certificate;
if (!synthetic && !production) throw Error('Destino do teste inválido.');
const origin = 'https://' + hostname + (port === '443' ? '' : ':' + port);
const cleanPath = (path) => {
  if (['/', '/app.js', '/forest.js', '/api/build', '/api/forest/map', '/api/calendar', '/api/me'].includes(path))
    return path;
  if (/^\/(?:assets\/forest|vendor\/three)\/[\w./-]+\.(?:glb|m?js|webp|png|woff2)$/.test(path)) return path;
  return '<outra-rota>';
};

(async function verify() {
  let browser, stage = 'Chromium', round = 0;
  const issues = [];
  const record = details => {
    if (issues.length < 20) issues.push({utc:new Date().toISOString(), ...details});
  };
  try {
    const args = ['--no-proxy-server','--host-resolver-rules=MAP '+hostname+' '+address];
    if (process.platform === 'win32') args.push('--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist');
    if (synthetic) {
      // Loopback only. Python and the HTTP/2 load client verify this private test CA separately.
      const key = new X509Certificate(fs.readFileSync(certificate)).publicKey.export({format:'der',type:'spki'});
      args.push('--ignore-certificate-errors-spki-list='+createHash('sha256').update(key).digest('base64'));
    }
    browser = await chromium.launch({args, timeout:20000});
    const context = await browser.newContext({viewport:{width:1100,height:800},serviceWorkers:'block'});
    if (synthetic) {
      const value = JSON.parse(fs.readFileSync(sessionFile,'utf8')).cookie.replace(/^davi_session=/,'');
      await context.addCookies([{name:'davi_session',value,domain:hostname,path:'/',secure:true,httpOnly:true}]);
    }
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin === origin && ['GET','HEAD'].includes(request.method())) return route.continue();
      record({path:cleanPath(url.pathname), issue:'requisição bloqueada'});
      return route.abort();
    });
    const page = await context.newPage();
    let maps = 0, models = 0;
    page.on('response', response => {
      const path = new URL(response.url()).pathname;
      if (!response.ok()) record({path:cleanPath(path),status:response.status()});
      else {
        if (path === '/api/forest/map') maps++;
        if (path.endsWith('.glb')) models++;
      }
    });
    page.on('requestfailed', request => {
      const reason = request.failure()?.errorText;
      if (reason !== 'net::ERR_ABORTED')
        record({path:cleanPath(new URL(request.url()).pathname),
          issue:/^net::ERR_[A-Z0-9_]+$/.test(reason)?reason:'falha de transporte'});
    });
    page.on('pageerror', error => record({issue:error.name === 'TypeError' ? 'TypeError' : 'erro JavaScript'}));
    stage = 'API build';
    const build = await page.goto(origin+'/api/build',{timeout:12000});
    assert.equal(build.status(),200);
    assert.equal((await build.json()).commit,expected);
    const ready = () => page.waitForFunction(() =>
      document.querySelector('#forestCanvas[data-ready=true]') &&
      window.DaviForest?.telemetry().view === '3d' && DaviForest.telemetry().frames > 2,
      undefined,{timeout:15000});
    stage = 'Floresta 3D';
    for (round=1; round<=Number(attempts); round++) {
      const previousMaps = maps, previousModels = models;
      const response = round === 1
        ? await page.goto(origin,{waitUntil:'domcontentloaded',timeout:15000})
        : await page.reload({waitUntil:'domcontentloaded',timeout:15000});
      assert.equal(response.status(),200);
      await ready();
      assert(maps > previousMaps && models > previousModels);
      assert.equal(issues.length,0);
    }
    stage = 'Agora';
    await page.getByRole('button',{name:'Agora',exact:true}).click({timeout:7000});
    await page.getByRole('heading',{name:'Agora',exact:true}).or(page.locator('.game-shell'))
      .first().waitFor({state:'visible',timeout:8000});
    assert.equal(issues.length,0);
    console.log(JSON.stringify({https:200, commit:expected, openings:round-1, maps, agora:true, issues}));
  } catch (error) {
    console.log(JSON.stringify({utc:new Date().toISOString(),stage,round,error:error.name,issues}));
    process.exitCode=1;
  } finally {
    if (browser) await browser.close();
  }
})();
