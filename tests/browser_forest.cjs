const {chromium,request}=require('playwright');
const AxeBuilder=require('@axe-core/playwright').default;
const assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const root=path.resolve(__dirname,'..'),data=fs.mkdtempSync(path.join(os.tmpdir(),'davi-forest-synthetic-')),out=process.env.FOREST_EVIDENCE_DIR || path.join(root,'docs/evidencias-forest-v16');fs.mkdirSync(out,{recursive:true});let server,browser;
async function main(){
 const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));const base=`http://127.0.0.1:${port}`;
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('DAVI_')));Object.assign(env,{DAVI_DATA_DIR:data,DAVI_HOST:'127.0.0.1',DAVI_PORT:String(port)});
 server=spawn('python',['-c',"import server,schedule_window,datetime; schedule_window.now=lambda:datetime.datetime(2026,11,17,11,15,tzinfo=schedule_window.TZ); server.initialize(); server.set_setting('password',server.hash_password('SyntheticPassword123')); c=server.sqlite3.connect(server.DB); c.execute(\"INSERT INTO world_ledger(id,delta,label,day) VALUES('synthetic:art',40,'Crédito sintético','2026-11-17')\"); c.execute('UPDATE world_state SET x=530,y=424'); c.commit(); c.close(); server.main()"],{cwd:root,env,stdio:'ignore',windowsHide:true});
 const api=await request.newContext({baseURL:base,extraHTTPHeaders:{Origin:base}});for(let i=0;i<100;i++){try{if((await api.get('/api/me')).ok())break;}catch{}await new Promise(r=>setTimeout(r,100));}
 await api.post('/api/login',{data:{password:'SyntheticPassword123'}});const csrf=(await(await api.get('/api/me')).json()).csrf;
 const write=async(route,body,method='post')=>{const r=await api[method](route,{data:body,headers:{'X-CSRF-Token':csrf}});assert(r.ok(),await r.text());return r.json();};
 const event=await write('/api/events',{title:'Preparar a mochila de explorador',time:'11:00',duration:30,start_date:'2026-11-17',recurrence:'daily'});await write(`/api/events/${event.id}/mission`,{template_id:'mochila'},'put');
 await write('/api/events',{title:'História na casa da árvore',time:'15:00',duration:30,start_date:'2026-11-17'});
 browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--ignore-gpu-blocklist','--enable-gpu','--disable-software-rasterizer']});
 const context=await browser.newContext({viewport:{width:1366,height:900},locale:'pt-BR',extraHTTPHeaders:{Origin:base},recordVideo:{dir:path.join(data,'videos'),size:{width:1366,height:900}}});await context.request.post(base+'/api/pair',{data:{code:(await write('/api/devices/code',{})).code}});
 const page=await context.newPage(),errors=[],external=[],checks=[],metrics=[];page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('blob:'+base)&&!r.url().startsWith('data:'))external.push(r.url());});
 const idle=()=>page.waitForFunction(()=>!document.querySelector('#content').hasAttribute('aria-busy'));
 const ready=()=>page.waitForSelector('#forestCanvas[data-ready="true"]',{timeout:45000});
 const click=async selector=>{await page.locator(selector).first().click();await idle();};
 const capture=async name=>{assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' overflow');await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});};
 async function moveTo(x,z,limit=10000){await page.locator('#forestCanvas').focus();const started=Date.now();let active=new Set();
  while(Date.now()-started<limit){const pos=await page.evaluate(()=>DaviForest.diagnostics().position),dx=x-pos[0],dz=z-pos[2];if(Math.hypot(dx,dz)<.32)break;const a=.55,sx=dx*Math.cos(a)-dz*Math.sin(a),sz=dx*Math.sin(a)+dz*Math.cos(a),next=new Set();if(Math.abs(sx)>Math.abs(sz)*.44)next.add(sx>0?'ArrowRight':'ArrowLeft');if(Math.abs(sz)>Math.abs(sx)*.44)next.add(sz>0?'ArrowDown':'ArrowUp');for(const key of active)if(!next.has(key))await page.keyboard.up(key);for(const key of next)if(!active.has(key))await page.keyboard.down(key);active=next;await page.waitForTimeout(120);}
  for(const key of active)await page.keyboard.up(key);await page.waitForTimeout(180);const pos=await page.evaluate(()=>DaviForest.diagnostics().position);assert(Math.hypot(x-pos[0],z-pos[2])<.6,`Could not walk to ${x},${z}, got ${pos}`);
 }
 await page.goto(base);await ready();await page.waitForTimeout(750);const initial=await page.evaluate(()=>DaviForest.diagnostics());assert(/NVIDIA/.test(initial.renderer),initial.renderer);assert(initial.animations.includes('Walk'));assert(initial.pipoAnimations.includes('Walk'));await capture('antes-de-construir-1366');
 await moveTo(-2,1.9);await click('[data-action="forest-nearby"]');assert.match(await page.locator('#forestDialog').innerText(),/diário de missões/i);await click('[data-action="forest-mission"]');await page.waitForTimeout(1000);assert(await page.locator('[data-action="game-learn"]').count());await capture('missao-preservada-1366');await click('[data-action="game-exit"]');await ready();await page.waitForTimeout(450);checks.push('Entrou em missão existente e voltou à floresta com a mesma posição.');
 await moveTo(.05,.9);await click('[data-action="forest-nearby"]');await click('[data-action="forest-buy"][data-id="bridge"]');await page.waitForTimeout(650);await click('[data-action="forest-cross"]');await page.waitForFunction(()=>DaviForest.diagnostics().position[2]<-5.2,null,{timeout:10000});await page.waitForTimeout(400);checks.push('Construiu a ponte pela interface e atravessou por movimento real.');
 await moveTo(0,-6.4);await moveTo(3.3,-5.8);await click('[data-action="forest-nearby"]');assert.match(await page.locator('#forestDialog').innerText(),/casa entre as folhas/i);await click('[data-action="forest-buy"][data-id="house"]');await page.waitForTimeout(700);await click('[data-action="forest-close"]');await page.waitForTimeout(1000);await capture('casa-desbloqueada-1366');checks.push('A construção da casa mudou o cenário; interação preservou o saldo.');
 await moveTo(0,-6.3);await moveTo(-5,-6.8);await page.waitForTimeout(1000);await capture('cachoeira-1366');
 const gpu=await page.evaluate(()=>DaviForest.diagnostics());const sorted=gpu.frameMs.slice().sort((a,b)=>a-b);metrics.push({viewport:1366,gpu:gpu.renderer,frameP50ms:sorted[Math.floor(sorted.length*.5)],frameP95ms:sorted[Math.floor(sorted.length*.95)],callsAllPasses:gpu.calls,trianglesAllPasses:gpu.triangles,assetLoadMs:gpu.loadMs});
 const video=page.video();await context.close();const raw=await video.path();execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',raw,'-c:v','libx264','-preset','medium','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,'gameplay.mp4')],{windowsHide:true});
 // Selected synthetic poses for stills, after the uninterrupted recording above.
 await write('/api/forest/move',{x:0,z:3.9},'put');const mobile=await browser.newContext({viewport:{width:390,height:900},locale:'pt-BR',hasTouch:true,extraHTTPHeaders:{Origin:base}});await mobile.request.post(base+'/api/pair',{data:{code:(await write('/api/devices/code',{})).code}});const touch=await mobile.newPage();touch.on('pageerror',e=>errors.push(e.stack));await touch.goto(base+"/?homologacao=1");await touch.waitForSelector('#forestCanvas[data-ready="true"]');await touch.waitForTimeout(800);
 for(const width of [390,360,768,1024,1366]){await touch.setViewportSize({width,height:900});await touch.waitForTimeout(600);assert(await touch.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await touch.screenshot({path:path.join(out,`floresta-${width}.png`),fullPage:true});const audit=await new AxeBuilder({page:touch}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.equal(audit.violations.length,0,JSON.stringify(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));const d=await touch.evaluate(()=>DaviForest.diagnostics()),times=d.frameMs.slice().sort((a,b)=>a-b);metrics.push({viewport:width,gpu:d.renderer,low:d.low,p50ms:times[Math.floor(times.length*.5)],p95ms:times[Math.floor(times.length*.95)],callsAllPasses:d.calls});}
 const before=await touch.evaluate(()=>DaviForest.diagnostics().position);await touch.setViewportSize({width:390,height:900});await touch.locator('[data-forest-dir="down"]').scrollIntoViewIfNeeded();const box=await touch.locator('[data-forest-dir="down"]').boundingBox(),cdp=await mobile.newCDPSession(touch);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2,id:1}]});await touch.waitForTimeout(350);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const after=await touch.evaluate(()=>DaviForest.diagnostics().position);assert(Math.hypot(after[0]-before[0],after[2]-before[2])>.1);const companion=await touch.evaluate(()=>DaviForest.diagnostics().pipoPosition);assert(Math.hypot(companion[0]-after[0],companion[2]-after[2])<2);checks.push('Controles de toque e teclado moveram os personagens.');
 const economy=await(await api.get('/api/world')).json();assert.equal(economy.stars,30);assert(economy.inventory.includes('bridge')&&economy.inventory.includes('house'));
 await touch.reload();await touch.waitForSelector('#forestCanvas[data-ready="true"]');const saved=await touch.evaluate(()=>DaviForest.diagnostics().position);assert(Math.hypot(saved[0]-after[0],saved[2]-after[2])<.3);checks.push('Posição, saldo e construções persistiram após reload e em segundo contexto autorizado.');


 // Buying does not equip; render must follow saved equipment, including Pipo.
 await touch.locator('[data-action="forest-shop"]').click();await touch.waitForFunction(()=>!document.querySelector('#content').hasAttribute('aria-busy'));
 assert.equal(await touch.evaluate(()=>DaviForest.diagnostics().pipoScarfVisible),false);
 await touch.locator('[data-action="forest-buy"][data-id="buddy"]').click();await touch.waitForFunction(()=>!document.querySelector('#content').hasAttribute('aria-busy'));
 assert.equal(await touch.evaluate(()=>DaviForest.diagnostics().pipoScarfVisible),false);
 await touch.locator('[data-action="forest-equip"][data-id="buddy"]').click();await touch.waitForFunction(()=>!document.querySelector('#content').hasAttribute('aria-busy'));
 assert.equal(await touch.evaluate(()=>DaviForest.diagnostics().pipoScarfVisible),true);
 await touch.locator('[data-action="forest-equip"][data-id="buddy"]').click();await touch.waitForFunction(()=>!document.querySelector('#content').hasAttribute('aria-busy'));
 assert.equal(await touch.evaluate(()=>DaviForest.diagnostics().pipoScarfVisible),false);
 await touch.locator('[data-action="forest-equip"][data-id="buddy"]').click();await touch.waitForFunction(()=>!document.querySelector('#content').hasAttribute('aria-busy'));
 await touch.locator('[data-action="forest-close"]').click();
 await touch.reload();await touch.waitForSelector('#forestCanvas[data-ready="true"]');
 assert.equal(await touch.evaluate(()=>DaviForest.diagnostics().pipoScarfVisible),true);
 checks.push('Lenço do Pipo: compra, vestir, tirar e equipamento persistido conferidos na malha renderizada.');
 // Explicit quality persistence, camera, diagnostics and WebGL recovery.
 await touch.locator('[data-action="forest-options"]').click();
 await touch.locator('#forestQuality').selectOption('low');
 assert.equal(await touch.evaluate(()=>DaviForest.diagnostics().low),true);
 await touch.locator('[data-action="forest-close"]').click();
 await touch.reload();await touch.waitForSelector('#forestCanvas[data-ready="true"]');
 assert.equal(await touch.evaluate(()=>DaviForest.diagnostics().quality),'low');
 await touch.waitForTimeout(1100);assert((await touch.evaluate(()=>ForestQA.measure())).worldReadyMs>0);
 const cam=await touch.evaluate(()=>DaviForest.diagnostics().camera);
 await touch.locator('[data-action="forest-rotate"][data-turn="1"]').click();await touch.waitForTimeout(600);
 assert.notDeepEqual(await touch.evaluate(()=>DaviForest.diagnostics().camera),cam);
 await touch.locator('[data-action="forest-camera"]').click();
 checks.push('Câmera gira/centraliza; qualidade econômica persiste; painel mede abertura/FPS/qualidade.');

 await touch.locator('#forestQA summary').click();
 const downloaded=touch.waitForEvent('download');await touch.locator('#qaExport').click();
 const download=await downloaded;const report=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
 assert.equal(report.synthetic,true);assert(report.samples.some(s=>s.worldReadyMs>0&&s.fps>0));
 await touch.locator('#forestQA summary').click();
 checks.push('Relatório JSON baixado e validado com amostras de FPS, abertura, qualidade e WebGL.');
 await touch.evaluate(()=>{window.qaGL=document.querySelector('#forestCanvas').getContext('webgl2').getExtension('WEBGL_lose_context');qaGL.loseContext();});
 await touch.waitForFunction(()=>ForestQA.events.some(e=>e.type==='webgl-lost'));
 await touch.waitForTimeout(300);await touch.evaluate(()=>qaGL.restoreContext());
 await touch.waitForFunction(()=>ForestQA.events.some(e=>e.type==='webgl-restored'));
 await touch.waitForFunction(()=>DaviForest.diagnostics().webgl&&!DaviForest.diagnostics().paused);
 checks.push('Perda de WebGL simulada, registrada e recuperada no Chromium desktop.');
 await touch.setViewportSize({width:1366,height:900});await touch.locator('[data-action="forest-options"]').click();await touch.locator('[data-action="forest-zoom"][data-amount="-2.5"]').click();await touch.locator('[data-action="forest-zoom"][data-amount="-2.5"]').click();await touch.locator('[data-action="forest-close"]').click();await touch.waitForTimeout(600);await touch.screenshot({path:path.join(out,'davi-pipo-1366.png'),fullPage:true});
 await touch.locator('[data-action="forest-options"]').click();await touch.locator('[data-action="forest-fallback"]').click();await touch.waitForSelector('#worldMap');await touch.setViewportSize({width:390,height:900});await touch.screenshot({path:path.join(out,'fallback-2d-390.png'),fullPage:true});await touch.locator('[data-action="world-forest"]').click();await touch.waitForSelector('#forestCanvas[data-ready="true"]');await touch.reload();await touch.waitForSelector('#forestCanvas[data-ready="true"]');checks.push('Retorno da ilha 2D à floresta 3D e preferência após reload conferidos.');await mobile.close();

 // Persistent loss must allow continuation without waiting for a GPU restore.
 const lost=await browser.newContext({viewport:{width:768,height:900},extraHTTPHeaders:{Origin:base}});
 await lost.request.post(base+'/api/pair',{data:{code:(await write('/api/devices/code',{})).code}});
 const lostPage=await lost.newPage();await lostPage.goto(base+'/?homologacao=1');await lostPage.waitForSelector('#forestCanvas[data-ready="true"]');
 await lostPage.evaluate(()=>document.querySelector('#forestCanvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
 await lostPage.waitForSelector('#worldMap',{timeout:15000});
 assert(await lostPage.evaluate(()=>ForestQA.events.some(e=>e.type==='fallback')));await lost.close();
 checks.push('Contexto perdido sem recuperação acionou continuação 2D em 5 s na homologação.');
 const noGL=await browser.newContext({viewport:{width:390,height:900},extraHTTPHeaders:{Origin:base}});await noGL.request.post(base+'/api/pair',{data:{code:(await write('/api/devices/code',{})).code}});await noGL.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return /^webgl/.test(kind)?null:get.call(this,kind,...args);};});const fallback=await noGL.newPage();await fallback.goto(base);await fallback.waitForSelector('#worldMap');await noGL.close();checks.push('Fallback 2D automático sem WebGL e retorno manual mantidos.');assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 fs.writeFileSync(path.join(out,'resultado.json'),JSON.stringify({synthetic:true,firstWorldReadyMs:initial.readyMs,firstAssetLoadMs:initial.loadMs,realHardware:'GPU desktop; viewports móveis emulados; aparelhos físicos pendentes',browser:browser.version(),metrics,checks,errors,externalRequests:external},null,2));await api.dispose();
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.once('exit',r));}fs.rmSync(data,{recursive:true,force:true});});
