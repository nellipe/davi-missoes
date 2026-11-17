/* Jornada essencial da Etapa B. Nenhuma conexão com a instalação da família. */
const {chromium, request}=require('playwright');
const AxeBuilder=require('@axe-core/playwright').default;
const assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const root=path.resolve(__dirname,'..'), python=process.env.PYTHON || 'python';
const data=fs.mkdtempSync(path.join(os.tmpdir(),'davi-gameplay-synthetic-'));
const evidence=path.join(root,'docs','evidencias-etapa-b');
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
  for(const [title,template] of [['Taekwondo sintético','taekwondo'],['Mochila sintética','mochila']]) {
    const event=await write('/api/events',{title,time:'11:00',start_date:'2026-11-17',recurrence:'daily'});
    await write(`/api/events/${event.id}/mission`,{template_id:template},'put');events.push({...event,template,title});
  }
  const dbState=()=>JSON.parse(execFileSync(python,['-c',"import sqlite3,json,sys; c=sqlite3.connect(sys.argv[1]); print(json.dumps({t:c.execute('SELECT * FROM '+t+' ORDER BY 1,2').fetchall() for t in ('step_progress','completions')})); c.close()",path.join(data,'agenda.sqlite3')],{encoding:'utf8',windowsHide:true}));
  browser=await chromium.launch();
  const context=await browser.newContext({viewport:{width:1366,height:1000},locale:'pt-BR',reducedMotion:'reduce',extraHTTPHeaders:{Origin:base}});
  const code=(await write('/api/devices/code',{})).code;
  await context.request.post(base+'/api/pair',{data:{code}});
  const page=await context.newPage(), errors=[];
  await page.clock.setFixedTime(new Date('2026-11-17T13:00:00Z'));
  await page.addInitScript(()=>{
    window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
    Object.defineProperty(window,'speechSynthesis',{value:{cancel(){},getVoices(){return [{lang:'pt-BR'}];},speak(u){window.__spoken={lang:u.lang,text:u.text};}}});
    window.__practice=[];window.addEventListener('davi:practice-complete',e=>window.__practice.push(e.detail));
  });
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const idle=()=>page.waitForFunction(()=>document.querySelector('#content')&&!document.querySelector('#content').hasAttribute('aria-busy'));
  const click=async(sel)=>{await page.locator(sel).first().click();await idle();};
  const game=async action=>click(`[data-action="game-${action}"]`);
  async function capture(name,width) {
    await page.setViewportSize({width,height:1000});
    await page.evaluate(()=>window.scrollTo(0,0));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}: overflow`);
    const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.equal(audit.violations.length,0,JSON.stringify(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));
    const selected=['taekwondo-modos-1366','taekwondo-trilha-360','mochila-bolsa-1366','taekwondo-fazer-360'];
    if(selected.includes(`${name}-${width}`))await page.screenshot({path:path.join(evidence,`${name}-${width}.png`),fullPage:true});
  }
  const enter=async event=>{
    if(await page.locator('#worldMap').count())await click('.w-hud [data-action="world-calendar"]');
    await click(`[data-action="mission-open"][data-id="${event.id}"]`);
  };
  const worldEvidence=path.join(root,'docs','evidencias-etapa-c');fs.mkdirSync(worldEvidence,{recursive:true});
  async function worldCapture(name,width) {
    await page.setViewportSize({width,height:1000});await page.evaluate(()=>window.scrollTo(0,0));
    await page.locator('#content').focus();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mundo sem overflow');
    const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.equal(audit.violations.length,0,JSON.stringify(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));
    await page.screenshot({path:path.join(worldEvidence,`${name}-${width}.png`),fullPage:true});
  }
  await page.goto(base);await idle();await worldCapture('ilha-inicial',1366);
  for(const event of events) {
    await enter(event);
    if(event===events[0])await capture('taekwondo-modos',1366);
    await capture(event.template+'-modos',360);
    const before=dbState();
    await game('learn');
    assert.equal(await page.locator('#gameStepTitle').count(),1);
    await game('speak');assert.equal(await page.evaluate(()=>window.__spoken.lang),'pt-BR');
    await game('help');assert((await page.locator('.g-speech').textContent()).includes('responsável'));
    await game('hint');
    const count=(await (await api.get('/api/missions/'+event.template)).json()).steps.length;
    for(let i=0;i<count;i++)await game('next');
    assert(await page.locator('#gameWinTitle').count());
    assert.deepEqual(dbState(),before,'Aprender não confirma ações reais');
    await game('do');await game('hub');await game('remember');
    await capture(event.template+'-jogos',1366);
    await game('order');
    // Uma tentativa fora de ordem, pista e recomeço, sem perda de tarefa real.
    const order=(await (await api.get('/api/missions/'+event.template)).json()).steps.map(s=>s.id);
    let available=await page.locator('.g-memory-card').evaluateAll(els=>els.map(el=>el.dataset.choice));
    for(const id of order.filter(id=>available.includes(id)).reverse())await click(`.g-memory-card[data-choice="${id}"]`);
    await game('check');assert((await page.locator('.g-game-feedback').textContent()).includes('pista'));
    await game('game-hint');await game('restart');
    await capture(event.template+'-trilha',360);
    for(let round=0;round<2;round++) {
      available=await page.locator('.g-memory-card').evaluateAll(els=>els.map(el=>el.dataset.choice));
      for(const id of order.filter(id=>available.includes(id)))await click(`.g-memory-card[data-choice="${id}"]`);
      await game('check');if(round===0)await game('next-round');
    }
    assert.deepEqual(dbState(),before,'Ordenar não modifica progresso ou conclusão');
    await game('do');await game('hub');await game('remember');await game('bag');
    for(let round=0;round<2;round++) {
      const goal=await page.locator('.g-secret-item strong').allTextContents();
      await game('hide-list');
      if(round===0) {
        const distractor=(await page.locator('.g-item > span:not(.g-emoji)').allTextContents()).find(label=>!goal.includes(label));
        await page.getByRole('button',{name:distractor,exact:true}).click();await idle();
        await game('check');assert((await page.locator('.g-game-feedback').textContent()).includes('pista'));
        await game('game-hint');
        await page.getByRole('button',{name:distractor,exact:true}).click();await idle();
      }
      for(const label of goal) {await page.getByRole('button',{name:label,exact:true}).click();await idle();}
      await capture(event.template+'-bolsa',round===0?360:1366);
      await game('check');if(round===0)await game('next-round');
    }
    assert.deepEqual(dbState(),before,'Bolsa virtual não modifica progresso ou conclusão');
    assert.equal(await page.evaluate(()=>window.__practice.filter(s=>s.mode==='remember'&&s.rounds===2).length),2);
    await capture(event.template+'-celebracao',360);
    await game('do');
    assert.equal(await page.locator('.g-object').evaluate(el=>getComputedStyle(el).animationName),'none');
    if(event===events[0]) {
      await page.emulateMedia({reducedMotion:'no-preference'});
      await game('motion');
      assert.equal(await page.locator('.g-object').evaluate(el=>getComputedStyle(el).animationName),'g-bob');
      await game('motion');await game('sound');
      assert.equal(await page.locator('[data-action="game-sound"]').getAttribute('aria-pressed'),'true');
      await game('sound');await page.emulateMedia({reducedMotion:'reduce'});
    }
    await game('help');
    await capture(event.template+'-fazer',360);await capture(event.template+'-fazer',1366);
    await page.locator('[data-action="game-confirm"]').focus();await page.keyboard.press('Enter');await idle();
    assert.equal(await page.locator('#gameStepTitle').count(),1);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'gameStepTitle');
    await game('previous');await game('undo');
    await game('confirm');await game('exit');
    await page.reload();await idle();
    await enter(event);await game('do');
    const effective=(await (await context.request.get(base+`/api/events/${event.id}/mission?date=2026-11-17`)).json()).mission;
    assert.equal(effective.confirmed,1,'Reabrir conserva a execução real');
    assert.equal(dbState().completions.length,0,'Agenda só conclui pelo botão da agenda');
    await game('exit');
    checks.push(`${event.template}: Aprender, Fazer, trilha e bolsa; pistas, recomeço, teclado e progresso preservado.`);
  }
  // Completar Fazer é independente dos jogos e da conclusão da agenda.
  await enter(events[0]);await game('do');
  for(let i=1;i<7;i++)await game('confirm');
  assert((await page.locator('.g-reward-chest').textContent()).includes('2 estrelas'));
  await game('chest');await game('exit');
  assert.equal(await page.locator('#worldStars').textContent(),'12');
  assert.equal(dbState().completions.length,0);
  // O responsável ajusta preços pela interface protegida, só nesta fixture.
  const adminContext=await browser.newContext();await adminContext.addCookies((await api.storageState()).cookies);
  const admin=await adminContext.newPage();await admin.goto(base);await admin.locator('#parentTab').click();
  await admin.locator('[data-action="world-settings"]').click();await admin.locator('#worldSettingsForm').waitFor();
  for(const id of ['house','portal','buddy','cape'])await admin.locator('#price-'+id).fill('1');
  await admin.locator('#worldSettingsForm').evaluate(form=>form.requestSubmit());
  await admin.waitForFunction(()=>!document.querySelector('#content').hasAttribute('aria-busy'));
  await page.reload();await idle();
  const worldAction=async name=>click(`[data-action="world-${name}"]`);
  for(const id of ['bridge','hat','house','portal','buddy','cape']) {
    await worldAction('shop');await click(`.w-product[data-item="${id}"]`);await worldAction('buy');
  }
  assert.equal(await page.locator('#worldStars').textContent(),'1');
  for(const id of ['bridge','house','portal'])assert.equal(await page.locator(`.w-map [data-building="${id}"]`).getAttribute('data-owned'),'true');
  await click('.w-hud [data-action="world-wardrobe"]');
  for(const id of ['hat','cape','buddy'])await click(`[data-action="world-equip"][data-item="${id}"]`);
  await click('[data-action="world-color"][data-color="sky"]');
  await worldCapture('personagem',390);await worldAction('close');
  await worldCapture('ilha-construida',1366);
  // Andar muda posição/câmera e a posição é guardada pelo servidor.
  await page.locator('#worldMap').focus();await page.keyboard.down('ArrowLeft');await page.waitForTimeout(180);await page.keyboard.up('ArrowLeft');
  await page.waitForFunction(()=>Number(document.querySelector('#worldPlayer').getAttribute('transform').match(/[\d.]+/)[0])<530);
  const point=await page.locator('#worldMap').evaluate(svg=>new DOMPoint(220,350).matrixTransform(svg.getScreenCTM()).toJSON());
  await page.mouse.click(point.x,point.y);await page.waitForTimeout(100);
  const second=await browser.newContext({viewport:{width:390,height:1000},locale:'pt-BR',extraHTTPHeaders:{Origin:base}});
  const secondCode=(await write('/api/devices/code',{})).code;
  assert.equal((await second.request.post(base+'/api/pair',{data:{code:secondCode}})).status(),200);
  const saved=await (await second.request.get(base+'/api/world')).json();
  assert.equal(saved.stars,1);assert.equal(saved.avatar.hat,'hat');assert.equal(saved.avatar.cape,'cape');assert.equal(saved.avatar.buddy,'buddy');
  assert.equal(saved.avatar.color,'sky');assert(saved.inventory.includes('bridge'));assert.equal(Math.round(saved.avatar.x),220);
  const otherPage=await second.newPage();await otherPage.goto(base);await otherPage.locator('#worldMap').waitFor();
  assert.equal(await otherPage.locator('.w-map [data-building="bridge"]').getAttribute('data-owned'),'true');
  await page.reload();await idle();await worldCapture('exploracao',360);
  await adminContext.close();await second.close();
  assert.equal(errors.length,0,JSON.stringify(errors));
  console.log('PASS: modos/minigames validados; estrelas, três construções, avatar/Pipo, movimento e segundo aparelho persistentes.');
  await api.dispose();
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();
  if(server&&server.exitCode===null){const stopped=new Promise(r=>server.once('exit',r));server.kill();await stopped;}
  const target=path.resolve(data);
  if(!target.startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(target).startsWith('davi-gameplay-synthetic-'))throw Error('Limpeza recusada fora da fixture.');
  fs.rmSync(target,{recursive:true,force:true});
});
