/* Jornada essencial da Etapa B. Nenhuma conexão com a instalação da família. */
const {chromium, request}=require('playwright');
const AxeBuilder=require('@axe-core/playwright').default;
const assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const root=path.resolve(__dirname,'..'), python=process.env.PYTHON || 'python';
const data=fs.mkdtempSync(path.join(os.tmpdir(),'davi-gameplay-synthetic-'));
const evidence=path.join(root,'docs','evidencias-v06-d');
fs.mkdirSync(evidence,{recursive:true});
let server,browser;
const checks=[];
async function main() {
  const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));
  const port=listener.address().port;await new Promise(r=>listener.close(r));
  const base=`http://127.0.0.1:${port}`;
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('DAVI_')));
  Object.assign(env,{DAVI_DATA_DIR:data,DAVI_PORT:String(port),DAVI_HOST:'127.0.0.1'});
  server=spawn(python,['-c',"import server; server.initialize(); server.set_setting('password',server.hash_password('SyntheticPassword123')); server.main()"],{cwd:root,env,stdio:'ignore',windowsHide:true});
  const api=await request.newContext({baseURL:base,extraHTTPHeaders:{Origin:base}});
  let ready=false;
  for(let i=0;i<100;i++) {try{if((await api.get('/api/me')).ok()){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}
  assert(ready);
  await api.post('/api/login',{data:{password:'SyntheticPassword123'}});
  const csrf=(await (await api.get('/api/me')).json()).csrf;
  const write=async(route,data,method='post')=>{
    const response=await api[method](route,{data,headers:{'X-CSRF-Token':csrf}});
    assert(response.ok(),await response.text());return response.json();
  };

  const events=[];
  for(const [title,template] of [['Treino sintético','taekwondo'],['Leitura sem roteiro',null]]) {
    const e=await write('/api/events',{title,time:'11:00',start_date:'2026-11-17',recurrence:'daily'});
    if(template)await write(`/api/events/${e.id}/mission`,{template_id:template},'put');
    events.push(e);
  }
  const config=await (await api.get('/api/world/config')).json();
  await write('/api/world/config',{...config.settings,learn:5,catalog:config.world.catalog},'put');
  const session=await write('/api/world/practice',{event_id:events[0].id,date:'2026-11-17',mode:'learn'});
  for(const step of session.mission.steps)await write(`/api/world/practice/${session.id}/advance`,{step_id:step.id});
  await write('/api/world/buy',{item_id:'hat'});
  await write('/api/world/equip',{color:'mint',hat:'hat'},'put');
  browser=await chromium.launch();
  const context=await browser.newContext({viewport:{width:1366,height:1000},locale:'pt-BR',reducedMotion:'reduce',extraHTTPHeaders:{Origin:base}});
  const code=(await write('/api/devices/code',{})).code;
  await context.request.post(base+'/api/pair',{data:{code}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const idle=()=>page.waitForFunction(()=>document.querySelector('#content')&&!document.querySelector('#content').hasAttribute('aria-busy'));
  const click=async(sel)=>{await page.locator(sel).first().click();await idle();};
  const capture=async(name,width)=>{
    await page.setViewportSize({width,height:1000});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+': overflow');
    const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.equal(audit.violations.length,0,JSON.stringify(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));
    await page.screenshot({path:path.join(evidence,`${name}-${width}.png`),fullPage:true});
  };
  await page.goto(base);await idle();
  await page.locator('#childDate').fill('2026-11-17');await page.locator('#childDate').dispatchEvent('change');await idle();
  for(const width of [1366,360]) {
    await capture('mundo',width);
    await click('.row [data-action="world-missions"]');
    assert.equal(await page.locator('.w-mission-list button').count(),2);
    assert.match(await page.locator('.w-mission-list').innerText(),/Sem roteiro/);
    await capture('atividades',width);
    await click('#worldDialog [data-action="world-close"]');
  }
  await click('.row [data-action="world-missions"]');
  await click('.w-mission-list [data-action="world-calendar"]');
  assert.match(await page.locator('#content').innerText(),/Leitura sem roteiro/);
  await click('[data-action="world-home"]');
  await click('[data-action="childnext"]');
  assert.equal(await page.locator('#childDate').inputValue(),'2026-11-18');
  await page.locator('#childDate').fill('2026-11-16');await page.locator('#childDate').dispatchEvent('change');await idle();
  await click('.row [data-action="world-missions"]');
  assert.match(await page.locator('#worldDialog').innerText(),/Nenhuma atividade nesta data/);
  await click('#worldDialog [data-action="world-calendar"]');
  checks.push('Mundo mostra todas as atividades, horários/status, datas futuras/anteriores e acesso à agenda sem roteiro.');
  await click('#parentTab');
  await page.locator('#password').fill('SyntheticPassword123');
  await page.locator('#loginForm button').click();await idle();
  assert.match(await page.locator('#content').innerText(),/versão 0.6D-1/i);
  await click('[data-action="world-settings"]');
  for(const width of [1366,360])await capture('responsavel',width);
  page.on('dialog',d=>d.type()==='prompt'?d.accept('Ajuste sintético'):d.accept());
  await click('[data-action="parent-revoke"]');
  assert.equal(await page.locator('[data-action="parent-revoke"]').count(),0);
  assert.match(await page.locator('#content').innerText(),/Revogada/);
  assert.match(await page.locator('#content').innerText(),/Ajuste sintético/);
  await capture('revogacao',360);
  await click('[data-action="parent-inventory"]');
  assert.match(await page.locator('#content').innerText(),/Removido/);
  await click('[data-action="parent-inventory"]');
  assert.match(await page.locator('#content').innerText(),/Ativo/);
  const saved=await page.evaluate(async()=>await (await fetch('/api/world')).json());
  assert.equal(saved.stars,-3);assert(saved.inventory.includes('hat'));assert.equal(saved.avatar.hat,null);
  checks.push('Item removido/reativado sem cobrança e sem manter acessório equipado.');
  checks.push('Responsável revoga concessão pela interface e vê estado e motivo no extrato.');
  await click('[data-action="calendar"]');
  await click('[data-action="selectday"][data-date="2026-11-18"]');
  await click(`[data-action="mission-link"][data-id="${events[1].id}"]`);
  await page.locator('#missionTemplate').selectOption('escola');
  await page.locator('#missionLinkForm button[type="submit"]').click();await idle();
  assert.match(await page.locator('#content').innerText(),/Preparar para a escola|escola/i);
  await click('[data-action="mission-open"]');
  await click('[data-action="mission-confirm"]');
  assert.equal(await page.locator('[data-action="mission-confirm"]').first().getAttribute('aria-pressed'),'true');
  await click('[data-action="mission-confirm"]');
  assert.equal(await page.locator('[data-action="mission-confirm"]').first().getAttribute('aria-pressed'),'false');
  await click('[data-action="calendar"]');
  await click(`[data-action="done"][data-id="${events[1].id}"]`);
  assert.equal(await page.locator(`[data-action="done"][data-id="${events[1].id}"]`).getAttribute('data-done'),'true');
  await click(`[data-action="done"][data-id="${events[1].id}"]`);
  assert.equal(await page.locator(`[data-action="done"][data-id="${events[1].id}"]`).getAttribute('data-done'),'false');
  checks.push('Vínculo de roteiro e correção/desfazer do compromisso pelo responsável em dia futuro.');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(evidence,'resultado.json'),JSON.stringify({synthetic:true,checks,errors},null,2));
  await context.close();await api.dispose();
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();
  if(server){server.kill();await new Promise(r=>server.once('exit',r));}
  fs.rmSync(data,{recursive:true,force:true});
});
