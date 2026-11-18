const assert = require('node:assert/strict');
const path = require('node:path');
const { session, ready, diag, out, save } = require('./forest_session.cjs');

const mode = process.argv[2] || 'movimento';
const width = Number(process.argv[3] || 390);
const height = width < 700 ? 850 : 820;
const name = mode + '-' + width;
const record=process.env.FOREST_RECORD==='1';

session(name, async ({ page, write, api, context, browser }) => {
  const action = code => page.locator('[data-action="' + code + '"]').first();
  const click = code => action(code).click();
  async function shot(suffix) {
    await page.screenshot({path:path.join(out,name+'-'+suffix+'.png')});
    if(record)await page.waitForTimeout(630);
  }
  const options = () => click('forest-options');
  const close = () => click('forest-close');
  const interact = () => click('forest-nearby');
  const state = async () => (await diag(page)).motion;
  const world = async () => (await api.get('/api/world')).json();
  async function checkpoint(x,z) {
    await page.waitForTimeout(300);
    await write('/api/forest/map/move',{x,z},'put');
    await page.reload();
    await ready(page);
    await page.waitForFunction(([x,z])=>Math.hypot(DaviForest.diagnostics().position[0]-x,DaviForest.diagnostics().position[2]-z)<.05,[x,z]);
  }
  async function reduced(choice) {
    await options();
    await page.locator('#forestMotion').selectOption(choice);
    const status=await page.locator('#forestMotionStatus').innerText();
    await close();
    return status;
  }
  async function now() {
    await click('child-now');
    await page.locator('[data-action=game-learn]').waitFor();
    await click('game-exit');
  }

  if(mode==='camera'){
    const frames=[];
    const spots=[['clareira',5.2,5.7],['passagem',15.1,5.1],['bifurcacao',30.68,6.5],
      ['pátio',37.8,-11.4],['copa',46.5,-5.3]];
    for(const [label,x,z] of spots){
      await checkpoint(x,z);
      for(const direction of [0,1]){
        if(direction)await page.locator('[data-action=forest-rotate][data-turn="1"]').click();
        await page.waitForTimeout(920);
        const visible=await page.evaluate(()=>DaviForest.characterFraming());
        for(const [actor,points] of Object.entries(visible)){
          const inside=points.filter(p=>Math.abs(p.x)<.92&&Math.abs(p.y)<.92&&p.clear).length;
          assert(inside>=2,`${label} a ${width} px, giro ${direction}, ${actor}: ${JSON.stringify(points)}`);
        }
        frames.push({label,direction,visible});
        if(!direction)await shot(label.replace('á','a'));
      }
    }
    save(name,{width,frames});
    return;
  }

  if (mode==='movimento') {
    const waterPatch=async()=>{
      const point=await page.evaluate(()=>DaviForest.project(26.62,10.12,.272));
      assert(point.visible,'O trecho visível da calha fica no quadro');
      return page.screenshot({clip:{x:point.x-9,y:point.y-6,width:18,height:12}});
    };
    assert.deepEqual(await state(),{choice:'system',reduced:false,system:false});
    await options();
    assert.equal(await page.locator('#forestMotion').inputValue(),'system');
    assert.equal(await page.locator('#forestMotionStatus').innerText(),'Animações ativadas.');
    await close();
    const walk=[];
    await page.locator('#forestCanvas').focus();
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(260);
    for(let i=0;i<15;i++){
      const d=await diag(page);
      walk.push({pipo:d.pipoPosition,clip:d.pipoAnimation,feet:d.pipoFeetY-d.pipoGroundY,steps:d.pipoSteps,walking:d.moving});
      await page.waitForTimeout(65);
    }
    await page.keyboard.up('ArrowRight');
    assert(walk.every(point=>point.walking&&point.clip==='Walk'));
    assert(walk.every(point=>Math.abs(point.feet)<.065),'Pipo pisa no terreno');
    for(const leg of [0,1]){
      const pose=walk.map(frame=>frame.steps[leg]);
      const stride=Math.max(...pose.map(point=>Math.hypot(...point.map((v,i)=>v-pose[0][i]))));
      assert(stride>.10,'Cada pata percorre um ciclo visível');
    }
    await page.waitForFunction(()=>DaviForest.diagnostics().pipoAnimation==='Hover');
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(930);
    await page.keyboard.up('ArrowLeft');

    await checkpoint(28,13.35);
    await page.waitForTimeout(400);
    const waterFirst=await waterPatch();
    await page.waitForTimeout(220);
    const waterChanges=!waterFirst.equals(await waterPatch());
    assert(waterChanges,'O trecho de água muda entre capturas');
    const lowBefore=(await diag(page)).living;
    await interact();
    await page.waitForTimeout(650);
    const lowMiddle=(await diag(page)).living;
    await page.waitForTimeout(3450);
    const lowEnd=(await diag(page)).living;
    assert(Math.abs(lowMiddle.lowWheel-lowBefore.lowWheel)>.20);
    assert(lowMiddle.lowWater-lowBefore.lowWater>.20,'A fase da corrente avança');
    assert(lowMiddle.lowBoat[2]>lowBefore.lowBoat[2]+.19&&lowEnd.lowBoat[2]>lowMiddle.lowBoat[2]+1.80);
    await shot('soleira');

    await checkpoint(46.5,-5.3);
    const highBefore=(await diag(page)).living;
    await interact();
    await page.waitForTimeout(1450);
    const highAfter=(await diag(page)).living;
    assert(Math.abs(highAfter.highWheel-highBefore.highWheel)>.30);
    assert(Math.hypot(...highAfter.highBoat.map((v,i)=>v-highBefore.highBoat[i]))>.85);
    await shot('copa');

    assert.match(await reduced('reduced'),/reduzido por sua escolha/);
    assert(await page.locator('#forestMotionBadge').isVisible());
    const persisted=await browser.newContext({storageState:await context.storageState(),reducedMotion:'no-preference'});
    try {
      const reopened=await persisted.newPage();
      await reopened.goto(page.url());
      await ready(reopened);
      assert.deepEqual((await diag(reopened)).motion,{choice:'reduced',reduced:true,system:false});
    } finally {
      await persisted.close();
    }
    await now();
    await ready(page);
    assert((await state()).reduced);
    await checkpoint(28,13.35);
    assert((await state()).reduced);
    await page.waitForTimeout(400);
    const quietWater=await waterPatch();
    await page.waitForTimeout(220);
    const waterStill=quietWater.equals(await waterPatch());
    assert(waterStill,'O trecho de água mantém o quadro em movimento reduzido');
    const reducedBefore=(await diag(page)).living;
    await interact();
    await page.waitForTimeout(410);
    const reducedAfter=(await diag(page)).living;
    assert.equal(reducedAfter.lowWheel,reducedBefore.lowWheel);
    assert.equal(reducedAfter.lowWater,0,'A corrente visual fica parada no modo reduzido');
    assert(reducedAfter.lowBoat[2]-reducedBefore.lowBoat[2]>2.7);
    await options();
    await click('forest-fallback');
    const map=page.locator('#worldMap[data-ready=true]');
    await map.waitFor();
    const boat=map.locator('[data-boat=wheel]');
    const svgBefore=await boat.getAttribute('transform');
    await interact();
    await page.waitForTimeout(380);
    assert.notEqual(await boat.getAttribute('transform'),svgBefore);
    assert((await state()).reduced);
    await click('world-forest');
    await ready(page);
    assert.match(await reduced('system'),/ativadas/);
    await options();
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
    await page.waitForFunction(()=>DaviForest.diagnostics().motion.reduced);
    assert.match(await page.locator('#forestMotionStatus').innerText(),/preferência do aparelho/);
    assert.equal(await page.locator('#forestMotion').inputValue(),'system');
    await shot('preferencia-do-aparelho');
    await page.locator('#forestMotion').selectOption('full');
    assert.match(await page.locator('#forestMotionStatus').innerText(),/ativadas por sua escolha.*movimento reduzido no aparelho/);
    await shot('escolha-manual-ativada');
    await close();
    await page.reload();
    await ready(page);
    assert.deepEqual(await state(),{choice:'full',reduced:false,system:true});
    const overrideBefore=(await diag(page)).living;
    await interact();
    await page.waitForTimeout(1000);
    const overrideAfter=(await diag(page)).living;
    assert(overrideAfter.lowWater>overrideBefore.lowWater+.5);
    assert(Math.abs(overrideAfter.lowWheel-overrideBefore.lowWheel)>.35);
    assert(overrideAfter.lowBoat[2]>overrideBefore.lowBoat[2]+.40);
    await options();
    await click('forest-fallback');
    await page.locator('#worldMap[data-ready=true]').waitFor();
    assert.deepEqual(await state(),{choice:'full',reduced:false,system:true});
    await click('world-forest');
    await ready(page);
    assert.deepEqual(await state(),{choice:'full',reduced:false,system:true});
    assert.match(await reduced('system'),/preferência do aparelho/);
    assert((await state()).reduced);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.waitForFunction(()=>!DaviForest.diagnostics().motion.reduced);

    const cookies=(await context.storageState()).cookies;
    const fresh=await browser.newContext({storageState:{cookies,origins:[]},reducedMotion:'no-preference'});
    try {
      const clean=await fresh.newPage();
      await clean.goto(page.url());
      await ready(clean);
      assert.deepEqual((await diag(clean)).motion,{choice:'system',reduced:false,system:false});
      await clean.emulateMedia({reducedMotion:'reduce'});
      await clean.evaluate(()=>{localStorage.setItem('davi-forest-motion','full');});
      await clean.reload();
      await ready(clean);
      assert.deepEqual((await diag(clean)).motion,{choice:'system',reduced:true,system:true});
      await clean.emulateMedia({reducedMotion:'no-preference'});
      await clean.evaluate(()=>{localStorage.removeItem('davi-forest-motion');});
      await clean.evaluate(()=>{localStorage.setItem('davi-forest-still','true');});
      await clean.reload();
      await ready(clean);
      assert.deepEqual((await diag(clean)).motion,{choice:'reduced',reduced:true,system:false});
    } finally {
      await fresh.close();
    }
    save(name,{walk,waterChanges,waterStill,lowBefore,lowMiddle,lowEnd,highBefore,highAfter,reducedBefore,reducedAfter,overrideBefore,overrideAfter});
    return;
  }

  await checkpoint(5.2,5.7);
  const wardrobe=page.locator('#forestDialog');
  const select=id=>wardrobe.locator('[data-action=forest-color][data-color='+id+']');
  const item=(kind,id)=>wardrobe.locator('[data-action=forest-'+kind+'][data-id='+id+']');
  async function pigments(imageData) {
    return page.evaluate(async imageData=>{
      let canvas=document.querySelector('#forestOutfitPreview');
      if(imageData){
        const image=new Image();
        image.src=imageData;
        await image.decode();
        canvas=document.createElement('canvas');
        canvas.width=image.width;
        canvas.height=image.height;
        canvas.getContext('2d').drawImage(image,0,0);
      }
      const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      const pixels={mint:0,sun:0,sky:0,purple:0,scarf:0};
      for(let i=0;i<data.length;i+=4){
        const [r,g,b]=[data[i],data[i+1],data[i+2]];
        if(g>r*1.24&&g>b*1.10)pixels.mint++;
        if(r>g*1.15&&g>b*1.42&&r>145)pixels.sun++;
        if(b>r*1.33&&b>g*1.18)pixels.sky++;
        if(b>g*1.25&&r>g*1.10)pixels.purple++;
        if(r>g*1.52&&r>b*1.7&&r>150)pixels.scarf++;
      }
      return pixels;
    },imageData);
  }
  async function livePigments() {
    const point=await page.evaluate(()=>{
      const {position,feetY}=DaviForest.diagnostics();
      return DaviForest.project(position[0],position[2],feetY+.82);
    });
    const bytes=await page.screenshot({clip:{x:point.x-19,y:point.y-14,width:38,height:28}});
    return pigments('data:image/png;base64,'+bytes.toString('base64'));
  }
  await interact();
  const colors={};
  const expected={mint:'37b686',sun:'ffb72e',sky:'477de0'};
  for(const id of Object.keys(expected)){
    await select(id).click();
    await page.waitForFunction(id=>document.querySelector('[data-color='+id+']')?.getAttribute('aria-pressed')==='true',id);
    const painted=(await diag(page)).outfit;
    assert.equal(painted.shirt,expected[id]);
    assert.equal((await world()).avatar.color,id);
    colors[id]={...painted,pixels:await pigments()};
    await shot(id);
    await close();
    await page.waitForTimeout(180);
    colors[id].live=await livePigments();
    await shot(id+'-mundo');
    await interact();
  }
  for(const id of Object.keys(expected)){
    assert(colors[id].pixels[id]>90,`A prévia mostra pigmento ${id}: ${JSON.stringify(colors[id].pixels)}`);
    const others=Object.values(colors).filter(c=>c!==colors[id]);
    assert(others.every(c=>colors[id].pixels[id]-c.pixels[id]>55));
    assert(others.every(c=>colors[id].live[id]-c.live[id]>18),
      `O jogo pinta a roupa de ${id}: ${JSON.stringify(colors[id].live)}`);
  }

  const initial=(await world()).stars;
  const items={};
  const compare={hat:'sun',cape:'purple',buddy:'scarf'};
  for(const id of ['hat','cape','buddy']){
    assert.equal(await item('equip',id).count(),0);
    await item('buy',id).click();
    await item('equip',id).waitFor();
    assert.equal((await world()).avatar[id],null);
    if(id==='cape')await click('forest-outfit-turn');
    const before=await pigments();
    await item('equip',id).click();
    await page.waitForFunction(id=>DaviForest.diagnostics().outfit[id].length>0,id);
    const painted=await pigments();
    assert(painted[compare[id]]>before[compare[id]]+38,id+': mudança visível de pigmento');
    assert.equal((await world()).avatar[id],id);
    await shot(id+'-vestido');
    await item('equip',id).click();
    await page.waitForFunction(id=>DaviForest.diagnostics().outfit[id].length===0,id);
    assert.equal((await world()).avatar[id],null);
    const after=await pigments();
    assert(Math.abs(after[compare[id]]-before[compare[id]])<15,
      `Tirar ${id} retorna à mesma prévia: ${before[compare[id]]} → ${after[compare[id]]}`);
    items[id]={before,painted,after};
    await shot(id+'-tirado');
    await item('equip',id).click();
    await page.waitForFunction(id=>DaviForest.diagnostics().outfit[id].length>0,id);
    if(id==='cape')await click('forest-outfit-turn');
  }
  assert.equal((await world()).stars,initial-10);
  const check=async()=>{
    const d=await diag(page);
    assert.equal(d.outfit.shirt,expected.sky);
    for(const id of ['hat','cape','buddy'])assert(d.outfit[id].length>0);
    assert(d.navigationValid);
  };
  await close();
  await page.reload();
  await ready(page);
  await check();
  await now();
  await ready(page);
  await check();
  await options();
  await click('forest-fallback');
  const map=page.locator('#worldMap[data-ready=true]');
  await map.waitFor();
  assert.equal(await map.locator('[data-clothes]').getAttribute('fill'),'#477de0');
  for(const id of ['hat','cape','buddy'])
    assert.equal(await map.locator('[data-accessory='+id+']').getAttribute('visibility'),'visible');
  await shot('mapa-2d');
  await interact();
  await item('equip','hat').click();
  await page.waitForFunction(()=>document.querySelector('[data-accessory=hat]')?.getAttribute('visibility')==='hidden');
  await close();
  await click('world-forest');
  await ready(page);
  assert.equal((await diag(page)).outfit.hat.length,0);
  assert.equal((await world()).avatar.hat,null);
  save(name,{colors,items,persisted:true,view2dSync:true,missionReturn:true});
}, record, { viewport:{width,height},videoSize:{width,height},videoFps:24 })
  .catch(error=>{console.error(error);process.exitCode=1;});
