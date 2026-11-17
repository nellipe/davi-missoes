/* Jornada essencial da Etapa B. Nenhuma conexão com a instalação da família. */
const {chromium, request}=require('playwright');
const AxeBuilder=require('@axe-core/playwright').default;
const assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const root=path.resolve(__dirname,'..'), python=process.env.PYTHON || 'python';
const data=fs.mkdtempSync(path.join(os.tmpdir(),'davi-gameplay-synthetic-'));
const evidence=path.join(root,'docs','evidencias-v07-horarios');
fs.mkdirSync(evidence,{recursive:true});
let server,browser;
const checks=[];
async function main() {
  const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));
  const port=listener.address().port;await new Promise(r=>listener.close(r));
  const base=`http://127.0.0.1:${port}`;
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('DAVI_')));
  Object.assign(env,{DAVI_DATA_DIR:data,DAVI_PORT:String(port),DAVI_HOST:'127.0.0.1'});
  server=spawn(python,['-c',"import server, schedule_window, datetime; schedule_window.now=lambda: datetime.datetime(2026,11,17,11,15,tzinfo=schedule_window.TZ); server.initialize(); server.set_setting('password',server.hash_password('SyntheticPassword123')); server.main()"],{cwd:root,env,stdio:'ignore',windowsHide:true});
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

  const event=await write('/api/events',{title:'Treino sintético',time:'11:00',start_date:'2026-11-17',recurrence:'daily'});
  await write(`/api/events/${event.id}/mission`,{template_id:'taekwondo'},'put');
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
  await page.locator('#childDate').fill('2026-11-18');await page.locator('#childDate').dispatchEvent('change');await idle();
  await click('.w-hud [data-action="world-calendar"]');
  assert(await page.locator('[data-action="done"]').first().isDisabled());
  assert.match(await page.locator('#content').innerText(),/Confirmação abre/);
  await capture('agenda-futura',360);
  await click('[data-action="mission-open"]');
  assert(await page.locator('[data-action="game-do"]').isDisabled());
  await capture('fazer-bloqueado',390);
  await page.locator('[data-action="game-learn"]').focus();
  await page.locator('[data-action="game-learn"]').press('Enter');await idle();
  assert(await page.locator('[data-action="game-next"]').isEnabled());
  await click('#parentTab');
  await page.locator('#password').fill('SyntheticPassword123');
  await page.locator('#loginForm button').click();await idle();
  await click('[data-action="settings"]');
  await page.locator('#afterMinutes').fill('45');
  await page.locator('#scheduleForm button').click();await idle();
  assert.equal(await page.locator('#afterMinutes').inputValue(),'45');
  await capture('tolerancia',1366);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(evidence,'resultado.json'),JSON.stringify({synthetic:true,checks:['Agenda futura visível, confirmação e Fazer bloqueados, Aprender livre, tolerância editável pelo responsável.'],errors},null,2));
  await context.close();await api.dispose();
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();
  if(server){server.kill();await new Promise(r=>server.once('exit',r));}
  fs.rmSync(data,{recursive:true,force:true});
});
