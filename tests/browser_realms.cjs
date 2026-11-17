/* Jornada essencial da Etapa B. Nenhuma conexão com a instalação da família. */
const {chromium, request}=require('playwright');
const AxeBuilder=require('@axe-core/playwright').default;
const assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const root=path.resolve(__dirname,'..'), python=process.env.PYTHON || 'python';
const data=fs.mkdtempSync(path.join(os.tmpdir(),'davi-gameplay-synthetic-'));
const evidence=path.join(root,'docs','evidencias-v07-3d');
fs.mkdirSync(evidence,{recursive:true});
let server,browser;
const checks=[];
async function main() {
  const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));
  const port=listener.address().port;await new Promise(r=>listener.close(r));
  const base=`http://127.0.0.1:${port}`;
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('DAVI_')));
  Object.assign(env,{DAVI_DATA_DIR:data,DAVI_PORT:String(port),DAVI_HOST:'127.0.0.1'});
  server=spawn(python,['-c',"import server; server.initialize(); c=server.sqlite3.connect(server.DB); c.execute(\"INSERT INTO world_ledger(id,delta,label,day) VALUES('synthetic:seed',40,'Crédito sintético','2026-11-17')\"); c.commit(); c.close(); server.set_setting('password',server.hash_password('SyntheticPassword123')); server.main()"],{cwd:root,env,stdio:'ignore',windowsHide:true});
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


  const event=await write('/api/events',{title:'Aventura sintética',time:'11:00',start_date:'2026-11-17',recurrence:'daily'});
  await write(`/api/events/${event.id}/mission`,{template_id:'taekwondo'},'put');
  browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1366,height:1000},locale:'pt-BR',extraHTTPHeaders:{Origin:base}});
  await context.request.post(base+'/api/pair',{data:{code:(await write('/api/devices/code',{})).code}});
  const page=await context.newPage(),errors=[],metrics=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:'))requests.push(r.url());});
  const idle=()=>page.waitForFunction(()=>!document.querySelector('#content').hasAttribute('aria-busy'));
  const sceneReady=()=>page.waitForSelector('#r3Canvas[data-ready="true"]');
  const click=async(sel)=>{await page.locator(sel).first().click();await idle();};
  const capture=async(name,width)=>{await page.setViewportSize({width,height:1000});await page.waitForTimeout(350);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+': overflow');if(name==='portais'||name==='editor-form'){const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.equal(audit.violations.length,0,JSON.stringify(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));}await page.screenshot({path:path.join(evidence,`${name}-${width}.png`),fullPage:true});};
  await page.goto(base);await idle();await sceneReady();
  if(!(await page.locator('#r3Canvas').count()))throw Error(await page.locator('#content').innerText());
  await capture('floresta',1366);
  await page.locator('#r3Canvas').focus();await page.keyboard.down('ArrowRight');await page.waitForTimeout(650);await page.keyboard.up('ArrowRight');await page.waitForTimeout(1400);
  let state=await page.evaluate(async()=>await (await fetch('/api/realms')).json());
  assert(state.worlds[0].progress.x>.1);
  await page.reload();await sceneReady();
  state=await page.evaluate(async()=>await (await fetch('/api/realms')).json());assert(state.worlds[0].progress.x>.1);
  for(const id of ['clouds','robots','treasure','crystal','forest']){
    await click('.r3-toolbar [data-action="r3-portals"]');
    await click(`[data-action="r3-travel"][data-id="${id}"]`);await sceneReady();
    for(const width of [360,390,1366])await capture(id,width);
    metrics.push(await page.locator('#r3Canvas').evaluate(c=>({world:document.querySelector('.r3-hud h1').textContent,calls:Number(c.dataset.calls),triangles:Number(c.dataset.triangles)})));
  }
  await click('.r3-toolbar [data-action="r3-shop"]');
  for(const id of ['bridge','house','portal','hat'])await click(`[data-action="r3-buy"][data-id="${id}"]`);
  await click('[data-action="r3-close"]');
  await click('.r3-toolbar [data-action="r3-wardrobe"]');await click('[data-action="r3-equip"][data-id="hat"]');await click('[data-action="r3-close"]');
  for(const width of [1366,390,360])await capture('construcoes',width);
  const earned=await page.evaluate(async()=>await (await fetch('/api/world')).json());assert.equal(earned.stars,19);assert.equal(earned.avatar.hat,'hat');
  // Software WebGL timing is diagnostic, not a physical-device benchmark.
  const before=Number(await page.locator('#r3Canvas').getAttribute('data-frames')),started=Date.now();await page.waitForTimeout(1500);const frames=Number(await page.locator('#r3Canvas').getAttribute('data-frames'))-before;
  metrics.push({mode:'mobile-360-software-webgl',fps:Math.round(frames*1000/(Date.now()-started)),calls:Number(await page.locator('#r3Canvas').getAttribute('data-calls')),triangles:Number(await page.locator('#r3Canvas').getAttribute('data-triangles'))});
  await page.locator('#r3Motion').uncheck();
  assert.equal(await page.locator('#r3Motion').isChecked(),false);
  await click('.r3-toolbar [data-action="r3-portals"]');await capture('portais',360);
  await click('[data-action="r3-close"]');
  await click('.r3-toolbar [data-action="r3-activities"]');
  assert.match(await page.locator('#r3Dialog').innerText(),/Aventura sintética/);await capture('atividades',390);
  await click('[data-action="r3-close"]');
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  assert.equal(audit.violations.length,0,JSON.stringify(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));
  await click('#parentTab');await page.locator('#password').fill('SyntheticPassword123');await page.locator('#loginForm button').click();await idle();
  await click('[data-action="realm-library"]');await click('[data-action="realm-new"]');
  await page.locator('#realmName').fill('Jardim sintético');await page.locator('#realmPreset').selectOption('crystal');await page.locator('#realmDescription').fill('Um novo caminho de ideias.');
  await page.locator('[name="realmEvent"]').check();await click('[data-action="realm-add"]');
  await page.locator('#rc-title-0').fill('Descoberta sintética');await page.locator('#rc-prompt-0').fill('Qual ajuda a ler à noite?');await page.locator('#rc-kind-0').selectOption('logic');await page.locator('#rc-options-0').fill('Lanterna\nBola');
  for(const width of [390,1366])await capture('editor-form',width);
  await page.locator('#realmForm button[type="submit"]').click();await idle();
  assert.match(await page.locator('#content').innerText(),/Jardim sintético/);await capture('editor',1366);
  const worlds=await (await api.get('/api/realms/config')).json(),created=worlds.worlds.find(w=>w.name==='Jardim sintético');assert(created);assert(created.event_ids.includes(event.id));
  await click('#childTab');await sceneReady();await click('.r3-toolbar [data-action="r3-portals"]');await click(`[data-action="r3-travel"][data-id="${created.id}"]`);await sceneReady();
  await click(`[data-action="r3-challenge"][data-id="${created.challenges[0].id}"]`);
  await click('[data-action="r3-pick"][data-choice="Lanterna"]');await click('[data-action="r3-answer"]');assert.match(await page.locator('#r3Dialog').innerText(),/Descoberta já guardada/);
  await click('[data-action="r3-close"]');await page.reload();await sceneReady();
  assert.match(await page.locator('.r3-hud h1').innerText(),/Jardim sintético/);
  const otherContext=await browser.newContext({viewport:{width:390,height:1000},extraHTTPHeaders:{Origin:base}});
  await otherContext.request.post(base+'/api/pair',{data:{code:(await write('/api/devices/code',{})).code}});
  const second=await otherContext.newPage();await second.goto(base);await second.waitForSelector('#r3Canvas[data-ready="true"]');assert.match(await second.locator('.r3-hud h1').innerText(),/Jardim sintético/);const secondState=await second.evaluate(async()=>await (await fetch('/api/realms')).json());assert(secondState.worlds.find(w=>w.id===secondState.current).challenges[0].completed);assert.equal(secondState.economy.avatar.hat,'hat');await otherContext.close();
  await click('[data-action="r3-fallback"]');assert(await page.locator('#worldMap').count());await capture('comparacao-2d',360);
  await click('[data-action="world-3d"]');await sceneReady();
  await page.evaluate(()=>document.querySelector('#r3Canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  assert.match(await page.locator('#r3Message').innerText(),/3D pausou/);await click('[data-action="r3-fallback"]');assert(await page.locator('#worldMap').count());
  const noGL=await browser.newContext({viewport:{width:390,height:1000},extraHTTPHeaders:{Origin:base}});
  await noGL.request.post(base+'/api/pair',{data:{code:(await write('/api/devices/code',{})).code}});
  await noGL.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl2'||kind==='webgl'?null:get.call(this,kind,...args);};});
  const fallback=await noGL.newPage();await fallback.goto(base);await fallback.waitForSelector('#worldMap');await fallback.screenshot({path:path.join(evidence,'sem-webgl-390.png'),fullPage:true});await noGL.close();
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  fs.writeFileSync(path.join(evidence,'resultado.json'),JSON.stringify({synthetic:true,metrics,errors,externalRequests:requests,checks:['Cinco mundos e controles 3D','Movimento persistente após reload','Editor cria mundo, atividade vinculada e desafio respondido','Mundo/progresso preservados em segunda página','Fallback 2D e perda de contexto WebGL','Capturas 360/390/1366, axe e sem overflow']},null,2));
  await context.close();await api.dispose();
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.once('exit',r));}fs.rmSync(data,{recursive:true,force:true});});
