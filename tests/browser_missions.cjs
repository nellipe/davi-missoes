/* Etapa A: navegador real, loopback efêmero, SQLite e credenciais sintéticos. */
const {chromium, request} = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const {spawn} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'davi-v06-synthetic-'));
const evidence = path.join(root, 'docs', 'evidencias-v06-a');
fs.mkdirSync(evidence, {recursive:true});
const report = {fixture:'Dados inteiramente sintéticos; servidor e navegador em loopback.',checks:[],captures:[],errors:[]};
let server, browser;
async function main() {
  const listener = net.createServer();
  await new Promise(r=>listener.listen(0,'127.0.0.1',r));
  const port = listener.address().port;
  await new Promise(r=>listener.close(r));
  const base = `http://127.0.0.1:${port}`;
  const env = Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('DAVI_')));
  Object.assign(env,{DAVI_DATA_DIR:data,DAVI_HOST:'127.0.0.1',DAVI_PORT:String(port)});
  const bootstrap = "import server; server.initialize(); server.set_setting('name','Explorador sintético'); server.set_setting('password',server.hash_password('SyntheticPassword123')); server.main()";
  server = spawn(process.env.PYTHON || 'python',['-c',bootstrap],{cwd:root,env,stdio:'ignore',windowsHide:true});
  const api = await request.newContext({baseURL:base,extraHTTPHeaders:{Origin:base}});
  let ready = false;
  for(let i=0;i<100;i++) {
    try { if((await api.get('/api/me')).ok()) {ready=true;break;} } catch {}
    if(server.exitCode!==null) throw Error('Servidor sintético encerrou.');
    await new Promise(r=>setTimeout(r,50));
  }
  assert(ready,'servidor temporário iniciou');
  assert.equal((await api.post('/api/login',{data:{password:'SyntheticPassword123'}})).status(),200);
  let csrf = (await (await api.get('/api/me')).json()).csrf;
  const mutate = async (route,data,method='post') => {
    const response=await api[method](route,{data,headers:{'X-CSRF-Token':csrf}});
    assert(response.ok(),await response.text());
    return response.json();
  };
  const ids=[];
  for(const [i,title] of ['Taekwondo sintético','Escola sintética','Higiene sintética','Futsal sintético','Sono sintético'].entries()) {
    ids.push((await mutate('/api/events',{title,time:`${11+i}:00`,start_date:'2026-11-17',recurrence:'daily'})).id);
  }
  browser=await chromium.launch();
  const context=await browser.newContext({viewport:{width:1366,height:1000},reducedMotion:'reduce',locale:'pt-BR',extraHTTPHeaders:{Origin:base}});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date('2026-11-17T13:00:00Z'));
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('dialog',d=>d.accept());
  const idle=()=>page.waitForFunction(()=>document.querySelector('#content')&&!document.querySelector('#content').hasAttribute('aria-busy'));
  const click=async selector=>{await page.locator(selector).first().click();await idle();};
  const submit=async selector=>{await page.locator(selector).evaluate(f=>f.requestSubmit());await idle();assert.equal(await page.locator('#alert:not([hidden])').count(),0,await page.locator('#alert').textContent());};
  async function capture(area,width) {
    await page.setViewportSize({width,height:1000});
    await page.evaluate(()=>window.scrollTo(0,0));
    const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
      outside:[...document.querySelectorAll('main button,main input,main select,main textarea')].filter(el=>{
        const r=el.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1);
      }).map(el=>el.id||el.textContent)}));
    assert(geometry.scroll<=width,JSON.stringify(geometry));
    assert.equal(geometry.outside.length,0,JSON.stringify(geometry));
    const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    const violations=audit.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}));
    report.captures.push({area,width,geometry,violations});
    assert.equal(violations.length,0,JSON.stringify(violations));
    await page.screenshot({path:path.join(evidence,`${area}-${width}.png`),fullPage:area==='passos'});
  }
  await page.goto(base);await idle();
  await click('#parentTab');
  await page.locator('#password').fill('SyntheticPassword123');await submit('#loginForm');
  await click(`[data-action="mission-link"][data-id="${ids[0]}"]`);
  await page.locator('#missionTemplate').selectOption('taekwondo');await submit('#missionLinkForm');
  assert.equal(await page.locator('#missionScope').evaluate(s=>s.options.length),2);
  await page.locator('#missionScope').selectOption('2026-11-17');
  await page.locator('#missionTemplate').selectOption('futsal');await submit('#missionLinkForm');
  const missionAt=async date=>(await (await api.get(`/api/events/${ids[0]}/mission?date=${date}`)).json()).mission.id;
  assert.equal(await missionAt('2026-11-17'),'futsal');
  assert.equal(await missionAt('2026-11-18'),'taekwondo');
  await click('[data-action="mission-inherit"]');
  assert.equal(await missionAt('2026-11-17'),'taekwondo');
  report.checks.push('Seletor com duas opções: vínculo por data persiste sem alterar a série; remover exceção restaura a série.');
  await capture('vinculo',360);
  await click('[data-action="calendar"]');
  await click('[data-action="mission-library"]');
  await click('[data-action="mission-edit"][data-template="taekwondo"]');
  await page.locator('#ms-hint-0').fill('Procure no lugar combinado com o responsável.');
  await click('[data-action="mission-down"][data-index="0"]');
  assert.equal(await page.locator('#ms-title-1').inputValue(),'Localize o dobok');
  assert.equal(await page.locator('#ms-hint-1').inputValue(),'Procure no lugar combinado com o responsável.');
  await click('[data-action="mission-add"]');
  await page.locator('#ms-title-7').fill('Confira com o responsável');
  await page.locator('#ms-instruction-7').fill('Pergunte se está tudo combinado antes de sair.');
  await page.locator('#ms-phase-7').selectOption('preparation');
  await click('[data-action="mission-add"]');
  await click('[data-action="mission-remove"][data-index="8"]');
  assert.equal(await page.locator('.mission-step-editor').count(),8);
  await capture('editor',360);await capture('editor',1366);await capture('editor',1920);
  await submit('#missionForm');
  report.checks.push('Responsável vincula roteiro pelo calendário, edita dica, adiciona/remove e reordena etapas sem perder campos.');
  const code=(await mutate('/api/devices/code',{})).code;
  const childContext=await browser.newContext({viewport:{width:360,height:1000},reducedMotion:'reduce',locale:'pt-BR',extraHTTPHeaders:{Origin:base}});
  assert.equal((await childContext.request.post(base+'/api/pair',{data:{code}})).status(),200);
  const childPage=await childContext.newPage();
  await childPage.clock.setFixedTime(new Date('2026-11-17T13:00:00Z'));
  childPage.on('pageerror',e=>report.errors.push(e.message));
  const childIdle=()=>childPage.waitForFunction(()=>!document.querySelector('#content').hasAttribute('aria-busy'));
  const childGame=async action=>{await childIdle();await childPage.locator(`[data-action="game-${action}"]`).first().click();await childIdle();};
  const openFirst=async()=>{
    await childPage.locator('#worldMap, [data-action="mission-open"]').first().waitFor();
    if(await childPage.locator('#worldMap').count()){await childPage.locator('.w-hud [data-action="world-calendar"]').click();await childIdle();}
    await childPage.locator('[data-action="mission-open"]').first().click();await childIdle();
  };
  await childPage.goto(base);
  await openFirst();
  await childGame('do');
  assert.equal(await childPage.locator('#gameStepTitle').count(),1);
  assert((await childPage.locator('#gameStepTitle').textContent()).includes('Vista o dobok'));
  await childGame('confirm');
  await childPage.locator('[data-action="game-confirm"]').focus();
  await childPage.keyboard.press('Enter');
  await childIdle();
  assert.equal(await childPage.evaluate(()=>document.activeElement.id),'gameStepTitle');
  await childPage.locator('#content').focus();
  await childPage.evaluate(()=>window.scrollTo(0,0));
  await childPage.screenshot({path:path.join(evidence,'passos-360.png'),fullPage:true});
  for(const width of [360,1366,1920]) {
    await childPage.setViewportSize({width,height:1000});
    await childPage.evaluate(()=>window.scrollTo(0,0));
    assert(await childPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const audit=await new AxeBuilder({page:childPage}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    report.captures.push({area:'passos',width,violations:audit.violations.map(v=>v.id)});
    assert.equal(audit.violations.length,0,JSON.stringify(audit.violations.map(v=>v.id)));
    if(width===1366) await childPage.screenshot({path:path.join(evidence,'passos-1366.png'),fullPage:true});
  }
  assert.equal((await childContext.request.get(base+'/api/missions')).status(),403);
  const calendar=await (await childContext.request.get(base+'/api/calendar?start=2026-11-17&end=2026-11-17')).json();
  assert.equal(calendar.events.find(e=>e.id===ids[0]).done,false);
  assert.equal((await (await api.get('/api/missions/history')).json()).history.length,1);
  report.checks.push('Criança confirma por toque/teclado, foco é preservado, API administrativa retorna 403 e compromisso continua pendente.');
  await childPage.reload();await openFirst();
  await childGame('do');
  const progress=await (await childContext.request.get(base+`/api/events/${ids[0]}/mission?date=2026-11-17`)).json();
  assert.equal(progress.mission.confirmed,2);
  await click('[data-action="mission-edit"][data-template="taekwondo"]');
  await page.locator('#ms-title-0').fill('Versão seguinte sintética');await submit('#missionForm');
  await childPage.reload();await openFirst();
  await childGame('learn');
  assert((await childPage.locator('#gameStepTitle').textContent()).includes('Vista o dobok'));
  await childGame('exit');
  await childPage.locator('.w-hud [data-action="world-calendar"]').click();await childIdle();
  await childPage.locator('#childDate').fill('2026-11-18');
  await childPage.waitForFunction(()=>document.querySelector('#childDate')?.value==='2026-11-18'&&!document.querySelector('#content').hasAttribute('aria-busy'));
  await openFirst();
  await childGame('learn');
  assert((await childPage.locator('#gameStepTitle').textContent()).includes('Versão seguinte sintética'));
  const nextProgress=await (await childContext.request.get(base+`/api/events/${ids[0]}/mission?date=2026-11-18`)).json();
  assert.equal(nextProgress.mission.confirmed,0);
  report.checks.push('Reabrir preserva progresso. Edição seguinte conserva snapshot iniciado e aparece na próxima ocorrência sem herdar confirmações.');
  assert.equal(report.errors.length,0,JSON.stringify(report.errors));
  await childContext.close();await context.close();await api.dispose();
}
main().then(()=>{report.result='passed';console.log('PASS: jornada de missões, isolamento por ocorrência, editor e acessibilidade.');})
  .catch(e=>{report.result='failed';report.failure=e.stack;console.error(e);process.exitCode=1;})
  .finally(async()=>{
    fs.writeFileSync(path.join(evidence,'validation.json'),JSON.stringify(report,null,2)+'\n');
    if(browser) await browser.close();
    if(server&&server.exitCode===null) {const stopped=new Promise(r=>server.once('exit',r));server.kill();await stopped;}
    const resolved=path.resolve(data),tempRoot=path.resolve(os.tmpdir())+path.sep;
    if(!resolved.startsWith(tempRoot)||!path.basename(resolved).startsWith('davi-v06-synthetic-')) throw Error('Limpeza fora da fixture recusada.');
    fs.rmSync(resolved,{recursive:true,force:true});
  });
