/* Ilha local: SVG leve, câmera móvel e avatar de verdade. Estado vem do servidor. */
window.DaviWorld=(()=>{
  let host,w,abort,frame=0,last=0,keys=new Set(),target=null,dialog=null,message='',dirty=false,saveTimer=0,keyboardNavigation=false;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const own=id=>w.inventory.includes(id);
  const item=id=>w.catalog.find(i=>i.id===id);
  const prefs=()=>DaviGame.preferences();
  const motion=()=>prefs().motion??!matchMedia('(prefers-reduced-motion: reduce)').matches;
  const btn=(text,action,attrs='',cls='')=>`<button type="button" class="w-button ${cls}" data-action="world-${action}" ${attrs}>${text}</button>`;
  function tree(x,y,s=1){return `<g transform="translate(${x} ${y}) scale(${s})" aria-hidden="true"><ellipse cy="12" rx="32" ry="11" fill="#477e7655"/><path d="M-6 5v-50h12V5" fill="#9c7755"/><path d="m0-16 20-18m-20 7-18-17" stroke="#9c7755" stroke-width="6"/><circle cy="-60" r="32" fill="#357e67"/><circle cx="-17" cy="-59" r="25" fill="#63af7f"/><circle cx="5" cy="-77" r="26" fill="#91ce8d"/><path d="M-9-90q-16 0-19 12" fill="none" stroke="#c5e7a1" stroke-width="5" stroke-linecap="round"/></g>`;}
  function land(x,y,rx,ry){return `<ellipse cx="${x}" cy="${y+24}" rx="${rx}" ry="${ry}" fill="#488b8c"/><ellipse cx="${x}" cy="${y+10}" rx="${rx}" ry="${ry}" fill="#e6ce9b"/><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#a3d6a8"/><ellipse cx="${x-7}" cy="${y-7}" rx="${rx-13}" ry="${ry-14}" fill="#b6dfae"/>`;}
  function building(id,owned=true){
    const draw={
      bridge:'<path d="m-58 5 118-11v26L-58 32Z" fill="#906e52"/><path d="m-58-4 118-11V8L-58 20Z" fill="#e5bd7f" stroke="#806653" stroke-width="3"/><path d="m-44-5 2 22m18-24 2 22m18-24 2 22m18-24 2 22m18-24 2 22" stroke="#a77f58" stroke-width="3"/><path d="m-64-25 128-11m-125 9V9m30-38v34m32-37V2m32-37v34m30-38v32" stroke="#b58b5c" stroke-width="5" stroke-linecap="round"/>',
      house:'<path d="M-7 56V-24H7v80" fill="#9e7959"/><circle cy="-36" r="62" fill="#60a879"/><circle cx="-26" cy="-48" r="38" fill="#94ce8c"/><path d="m-40-38 41-30 44 30v61H-40Z" fill="#f3d69f" stroke="#8f7258" stroke-width="3"/><path d="m-49-39 50-40 52 40-13 4L0-63l-37 28Z" fill="#b8767b"/><path d="M-10 23v-32h23v32" fill="#607a86"/><path d="M-33-19h15v15h-15m49-15h15v15H16" fill="#aee6e2" stroke="#9a8667" stroke-width="3"/><path d="M-45 21h94m-88 0v12m82-12v12" stroke="#977354" stroke-width="5"/><path d="m-21 33 3 27m-5-17h16m-15 10h16" stroke="#c5a16e" stroke-width="4"/>',
      portal:'<ellipse cy="22" rx="52" ry="16" fill="#718eae"/><path d="M-40 16v-54q40-50 80 0v54" fill="#876bc7" stroke="#515c92" stroke-width="10"/><path d="M-27 14v-48q27-31 54 0v48" fill="#bdadf4"/><path d="m0-43 7 17 17 4-13 12 1 18L0 0-13 8l1-18-13-12 18-4Z" fill="#fff0b0"/><circle cx="-42" cy="-10" r="5" fill="#ffe6a3"/><circle cx="42" cy="-10" r="5" fill="#ffe6a3"/>',
      chest:'<path d="m-31-9 31-11 33 11v32L0 37l-31-14Z" fill="#b27b56" stroke="#74584d" stroke-width="3"/><path d="m-31-9 31-17 33 17L0 5Z" fill="#f3d48d" stroke="#987149" stroke-width="3"/><path d="M-17-18v44m36-44v44" stroke="#eac680" stroke-width="6"/><path d="M-5 4H7v15H-5Z" fill="#ffe49a"/>',
      flag:'<path d="M-25 30h51v-11h-51Z" fill="#b49474"/><path d="M0 20v-74" stroke="#768588" stroke-width="5"/><path d="M3-55h43L34-39l12 16H3Z" fill="#e49c84"/><path d="m20-44 3 5 6 1-4 4 1 6-6-3-5 3 1-6-4-4 6-1Z" fill="#fff1be"/>',
      calendar:'<path d="M-3 35V-7" stroke="#9d7b5c" stroke-width="7"/><path d="M-32-50h65v49H-32Z" fill="#f8eccb" stroke="#9a7a5c" stroke-width="4"/><path d="M-30-49h61v12h-61" fill="#e79e86"/><path d="M-18-24h10m9 0h10m9 0h8m-46 12h10m9 0h10" stroke="#87a4a1" stroke-width="5"/>',
      wardrobe:'<path d="m-35 23 35-58 35 58M0-35v-10q0-10 10-5" fill="none" stroke="#9b7a5e" stroke-width="5"/><path d="m-22-11 22 10 22-10-7 40h-30Z" fill="#b9a7e1"/><path d="m0 1 4 8 9 2-7 6 1 8-7-4-7 4 1-8-7-6 9-2Z" fill="#fff0b0"/>',
    };
    return `<g data-building="${id}" data-owned="${owned}" class="${owned?'w-built':'w-unbuilt'}">${draw[id]||''}</g>`;
  }
  function avatar(a,scale=1){
    const colors={mint:'#65bca1',sun:'#e6b867',sky:'#75aed0'};
    return `<g transform="scale(${scale})" class="w-avatar-art"><ellipse cy="3" rx="18" ry="7" fill="#54787555"/>${a.cape?'<path d="m-12-32-10 32 22-7 22 7-10-32Z" fill="#9b7cc5" stroke="#715e9c" stroke-width="2"/>':''}<path d="M-7-6v8m14-8v8" stroke="#4d6482" stroke-width="7" stroke-linecap="round"/><path d="M-14-28-19-12m33-16 5 16" stroke="#edc18e" stroke-width="6" stroke-linecap="round"/><rect x="-13" y="-32" width="26" height="25" rx="7" fill="${colors[a.color]}"/><path d="m0-26 3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1Z" fill="#fff0b6"/><rect x="-15" y="-59" width="30" height="29" rx="10" fill="#f2ca98"/><path d="M-15-46v-7q0-12 15-12t15 12v7L4-53l-8 4-5-3Z" fill="#5b514f"/><circle cx="-6" cy="-44" r="1.8" fill="#4c5360"/><circle cx="6" cy="-44" r="1.8" fill="#4c5360"/><path d="M-4-36q4 3 8 0" fill="none" stroke="#b67d66" stroke-width="1.6"/>${a.hat?'<path d="M-18-55h36m-29-1v-14H11v14" fill="#e6be7b" stroke="#927a5d" stroke-width="4" stroke-linecap="round"/>':''}</g>`;
  }
  function pipo(dressed=!!w.avatar.buddy){return DaviGame.robot().replace('</svg>',(dressed?'<path d="M57 111h106l-18 18-35-7-33 7Z" fill="#e7a176"/>':'')+'</svg>');}
  function preview(id){return `<svg viewBox="${['hat','cape'].includes(id)?'-90 -160 180 200':'-90 -100 180 180'}" aria-hidden="true">${['hat','cape','buddy'].includes(id)?(id==='buddy'?`<g transform="translate(-68 -95) scale(.6)">${DaviGame.robot().replace('<svg','<svg width="220" height="240"')}</g><path d="m-10-28 24 6-12 13Z" fill="#e5a27a"/>`:avatar({...w.avatar,[id]:id},2)):building(id)}</svg>`;}
  function poi(x,y,label,action,attrs='',kind=''){
    return `<foreignObject x="${x-64}" y="${y}" width="128" height="62"><button xmlns="http://www.w3.org/1999/xhtml" type="button" class="w-sign ${kind}" data-action="world-${action}" data-x="${x}" data-y="${y}" ${attrs}>${esc(label)}</button></foreignObject>`;
  }
  function map(){return `<svg id="worldMap" class="w-map" viewBox="0 0 1100 650" tabindex="0" role="group" aria-label="Mundo explorável: Ilha das ideias" aria-describedby="worldMoveHint">
    <defs><pattern id="waterLines" width="90" height="64" patternUnits="userSpaceOnUse"><path d="M10 31q12 6 24 0m32 20q8 4 16 0" fill="none" stroke="#effbfa" stroke-width="2" opacity=".55"/></pattern></defs>
    <rect x="-1000" y="-1000" width="3200" height="2600" fill="#b8e0e6"/><rect x="-1000" y="-1000" width="3200" height="2600" fill="url(#waterLines)" class="w-water"/>
    <g aria-hidden="true">${land(530,370,265,150)}${land(155,345,115,105)}${land(940,320,145,125)}
    <path d="M390 445q-40-115 60-145t182 70l18 75" fill="none" stroke="#dfe6b4" stroke-width="28" stroke-linecap="round"/>
    <path d="M390 445q-40-115 60-145t182 70l18 75" fill="none" stroke="#eee9c3" stroke-width="18" stroke-linecap="round"/>
    ${tree(355,325,.9)}${tree(385,245,.9)}${tree(510,245,.7)}${tree(730,355,.85)}${tree(600,495,.65)}${tree(120,320,1.1)}${tree(195,290,.8)}${tree(105,390,.75)}${tree(1000,305,.9)}${tree(885,260,.8)}
    <g transform="translate(305 365)">${building('bridge',own('bridge'))}</g>
    ${own('portal')?'<path d="M745 357h80" stroke="#baa9d1" stroke-width="24"/><path d="M745 350h80" stroke="#e5d4ee" stroke-width="20"/>':''}
    <g transform="translate(680 280)">${building('house',own('house'))}</g>
    <g transform="translate(930 340)">${building('portal',own('portal'))}</g>
    <g transform="translate(455 315)">${building('chest')}</g><g transform="translate(575 330)">${building('flag')}</g>
    <g transform="translate(400 435)">${building('calendar')}</g><g transform="translate(660 440)">${building('wardrobe')}</g>
    <g transform="translate(820 520)"><path d="m-30 0 60 0-16 17h-30Z" fill="#9f7b5a"/><path d="M0 0v-55l29 45H0" fill="#f6ecd5" stroke="#9d937a" stroke-width="2"/></g>
    <path d="M475 470h8m-4-4v8m238-166h7m-3-4v8m-524 90h8m-4-4v8" stroke="#f7f2c4" stroke-width="4"/>
    <g id="worldPlayer" transform="translate(${w.avatar.x} ${w.avatar.y})">${avatar(w.avatar)}<g transform="translate(-48 -29) scale(.15)">${pipo().replace('<svg','<svg width="220" height="240"')}</g></g></g>
    ${poi(455,340,'Oficina de estrelas','shop')}${poi(575,342,'Missões do dia','missions','','w-mission-sign')}
    ${poi(400,455,'Calendário','calendar')}${poi(660,465,'Meu personagem','wardrobe')}
    ${poi(290,390,own('bridge')?'Bosque aberto':'Ponte · '+item('bridge').price+' ✦','item','data-item="bridge"')}
    ${poi(680,300,own('house')?'Minha casa':'Casa · '+item('house').price+' ✦',own('house')?'house':'item','data-item="house"')}
    ${poi(930,365,own('portal')?'Portal dos jogos':'Portal · '+item('portal').price+' ✦',own('portal')?'missions':'item','data-item="portal"')}
    </svg>`;}
  function render(){
    stop();
    const next=host.missions.find(e=>!e.done)||host.missions[0];
    host.layout(`<div class="world-shell ${motion()?'':'w-still'}"><div class="w-hud"><div><span class="w-kicker">SEU PEQUENO GRANDE MUNDO</span><h1>Ilha das ideias</h1></div><div class="w-wallet" aria-label="${w.stars} estrelas guardadas"><span aria-hidden="true">✦</span><strong id="worldStars">${w.stars}</strong><small>estrelas</small></div><div class="w-hud-tools"><button type="button" data-action="world-3d" class="w-button">Mundos 3D</button>${btn('♧ Meu personagem','wardrobe')}${btn('▣ Calendário','calendar')}</div></div>
      <div class="row between w-day-controls"><div class="actions"><button data-action="childprev" aria-label="Dia anterior">←</button><button data-action="childtoday">Hoje</button><button data-action="childnext" aria-label="Próximo dia">→</button></div><label>Dia <input id="childDate" type="date" value="${esc(host.date)}"></label>${btn('Atividades do dia · '+host.missions.length,'missions')}</div><p class="w-day-note">${esc(host.dateLabel)} · Todas as atividades estão em Atividades do dia, com ou sem roteiro.</p><div class="w-stage">${map()}<span class="w-map-label" aria-hidden="true">BOSQUE DAS DESCOBERTAS</span><div class="w-compass" aria-hidden="true">✧<small>N</small></div><div class="w-dpad" role="group" aria-label="Andar pelo mundo"><button type="button" data-world-dir="up" aria-label="Andar para cima">↑</button><button type="button" data-world-dir="left" aria-label="Andar para esquerda">←</button><button type="button" data-world-dir="down" aria-label="Andar para baixo">↓</button><button type="button" data-world-dir="right" aria-label="Andar para direita">→</button></div><div class="w-map-tip" id="worldMoveHint">Toque no chão para andar · setas ou WASD</div></div>
      <div class="w-dock"><div class="w-pipo">${pipo()}</div><div class="w-pipo-copy"><strong>Pipo, seu companheiro</strong><p id="worldMessage" role="status">${esc(message||'Cada ideia pode virar uma nova descoberta. Que lugar vamos visitar?')}</p></div>${next?btn(`⚑ ${esc(next.title)} <span>${next.has_mission?'Entrar na missão →':'Ver atividade na agenda →'}</span>`,next.has_mission?'play':'calendar',`data-event="${next.id}" data-date="${next.date}"`,'w-mission-button'):btn('Ver meus compromissos','calendar')}</div></div>
      ${dialog?dialogHTML():''}`);
    document.body.classList.add('world-view');
    bind();camera();
    if(dialog){document.getElementById('worldDialog').showModal();document.getElementById('worldDialog').addEventListener('cancel',e=>{e.preventDefault();dialog=null;render();document.getElementById('worldMap').focus({preventScroll:true});});}
  }
  function dialogHTML(){
    let content='';
    if(dialog==='shop')content=`<span class="w-kicker">A OFICINA DO PIPO</span><h2>O que vamos criar?</h2><p>Você tem ${w.stars} estrelas. Cada descoberta tem um preço combinado.</p><div class="w-shop-grid">${w.catalog.filter(i=>i.available||i.owned).map(i=>`<button type="button" class="w-product" data-action="world-item" data-item="${i.id}">${preview(i.id)}<strong>${esc(i.name)}</strong><span>${i.removed?'Removido pelo responsável':i.owned?'Já é seu ✓':i.price+' ✦'}</span></button>`).join('')}</div>`;
    else if(dialog==='wardrobe')content=`<span class="w-kicker">DO SEU JEITO</span><h2>Meu personagem</h2><div class="w-character-preview"><svg viewBox="-55 -90 110 110" aria-hidden="true">${avatar(w.avatar)}</svg></div><div class="w-color-options">${[['mint','Menta'],['sun','Sol'],['sky','Azul']].map(([color,label])=>btn(label,'color',`data-color="${color}" aria-pressed="${w.avatar.color===color}"`,'w-color-'+color)).join('')}</div><div class="w-accessories">${['hat','cape','buddy'].map(id=>btn(`${esc(item(id).name)} ${own(id)?(w.avatar[id]?'✓ Usando':'· Usar'):'· '+item(id).price+' ✦'}`,own(id)?'equip':'item',`data-item="${id}" ${own(id)?`aria-pressed="${!!w.avatar[id]}"`:''}`)).join('')}</div>`;
    else if(dialog==='missions')content=`<span class="w-kicker">A PORTA DAS AVENTURAS</span><h2>Atividades do dia</h2><p>${esc(host.dateLabel)} · aprender, fazer e brincar de lembrar.</p><div class="w-mission-list">${host.missions.map(e=>btn(`<span>${esc(e.icon)}</span><strong>${esc(e.title)}</strong><small>${esc(e.time)} · ${e.done?'Atividade concluída':'Pendente'} · ${e.has_mission?'Aprender, Fazer e Lembrar':'Sem roteiro · ver na agenda'}</small>`,e.has_mission?'play':'calendar',`data-event="${e.id}" data-date="${e.date}"`)).join('')||'<p>Nenhuma atividade nesta data. Abra os compromissos para consultar outros dias. O responsável pode cadastrar atividades e vincular roteiros pelo calendário.</p>'}</div><p>Sem roteiro? A atividade continua na agenda. O responsável pode vincular em Roteiro e progresso.</p>${btn('Ver todos os compromissos','calendar')}`;
    else if(dialog==='house'&&own('house'))content=`<span class="w-kicker">UM LUGAR SÓ SEU</span><h2>Sua casa na árvore!</h2><div class="w-house-art">${preview('house')}</div><p>O bosque ganhou um esconderijo. Escolha uma história, imagine uma aventura e leve uma ideia para fora da tela.</p>${btn('Visitar as missões','missions')}`;
    else {
      const i=item(dialog);content=`<span class="w-kicker">UMA DESCOBERTA DE VERDADE</span><h2>${esc(i.name)}</h2><div class="w-item-preview">${preview(i.id)}</div><p>${esc(i.description)}</p><p class="w-price">${i.owned?'Já faz parte do seu mundo.':i.price+' estrelas · seu saldo: '+w.stars}</p>${i.removed?'<p>Removido pelo responsável. Peça a ele para reativar, sem nova cobrança.</p>':i.owned?btn(i.kind==='building'?'Voltar para o mundo':'Usar agora',i.kind==='building'?'close':'equip',`data-item="${i.id}"`):i.available?btn(i.kind==='building'?'Construir por '+i.price+' ✦':'Guardar por '+i.price+' ✦','buy',`data-item="${i.id}" ${w.stars<i.price?'disabled':''}`,'w-buy'):'<p>Essa descoberta está descansando na oficina.</p>'}${!i.removed&&!i.owned&&w.stars<i.price?'<p>Novas compras aguardam estrelas suficientes. Você pode continuar brincando e praticando.</p>':''}`;
    }
    return `<dialog id="worldDialog" class="w-dialog" aria-label="Descobertas da ilha"><div class="w-dialog-top">${btn('← Mundo','close')}</div>${content}</dialog>`;
  }
  function walkable(x,y){return ((x-530)/265)**2+((y-370)/150)**2<=1 || own('bridge')&&(((x-185)/135)**2+((y-345)/115)**2<=1 || x>=240&&x<=350&&y>=335&&y<=390) || own('portal')&&(((x-930)/145)**2+((y-320)/125)**2<=1||x>=735&&x<=835&&y>=325&&y<=385);}
  function camera(focus){
    const svg=document.getElementById('worldMap');if(!svg)return;
    const r=svg.getBoundingClientRect(),vw=r.width<700?420:1100,vh=vw*r.height/r.width;
    const p=focus||w.avatar,cx=Math.max(vw/2-30,Math.min(1130-vw/2,p.x)),cy=vw===1100?330:Math.max(vh/2-40,Math.min(700-vh/2,p.y));
    svg.setAttribute('viewBox',`${cx-vw/2} ${cy-vh/2} ${vw} ${vh}`);
    document.getElementById('worldPlayer').setAttribute('transform',`translate(${w.avatar.x} ${w.avatar.y})`);
  }
  async function save(){clearTimeout(saveTimer);if(!dirty)return;dirty=false;try{await host.api('/api/world/move','PUT',{x:w.avatar.x,y:w.avatar.y});}catch{dirty=true;}}
  function step(now){
    if(!last)last=now;const dt=Math.min((now-last)/1000,.04);last=now;
    let dx=(keys.has('right')?1:0)-(keys.has('left')?1:0),dy=(keys.has('down')?1:0)-(keys.has('up')?1:0);
    if(target&&!motion()){w.avatar.x=target.x;w.avatar.y=target.y;target=null;dirty=true;camera();save();}
    if(target){dx=target.x-w.avatar.x;dy=target.y-w.avatar.y;if(Math.hypot(dx,dy)<4){target=null;dx=dy=0;save();}}
    const len=Math.hypot(dx,dy);
    if(len){const speed=170*dt,nx=w.avatar.x+dx/len*Math.min(speed,len),ny=w.avatar.y+dy/len*Math.min(speed,len);
      if(walkable(nx,ny)){w.avatar.x=nx;w.avatar.y=ny;dirty=true;camera();}else{target=null;save();}}
    frame=keys.size||target?requestAnimationFrame(step):0;
  }
  function wake(){if(!frame){last=0;frame=requestAnimationFrame(step);}}
  function stop(){if(abort)abort.abort();cancelAnimationFrame(frame);keys.clear();target=null;last=0;}
  function bind(){
    abort=new AbortController();const on=(el,event,fn)=>el.addEventListener(event,fn,{signal:abort.signal});
    const svg=document.getElementById('worldMap'),dirs={ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'};
    on(document,'keydown',e=>{if(e.key==='Tab')keyboardNavigation=true;if(dialog||!(e.target===svg||e.target.closest('[data-world-dir]')))return;const dir=dirs[e.key];if(dir){e.preventDefault();target=null;keys.add(dir);wake();}});
    on(document,'keyup',e=>{if(dirs[e.key]){keys.delete(dirs[e.key]);save();}});
    on(window,'blur',()=>{keys.clear();save();});
    on(document,'pointerup',()=>{keys.clear();save();});
    on(document,'pointercancel',()=>{keys.clear();save();});
    document.querySelectorAll('[data-world-dir]').forEach(b=>on(b,'pointerdown',e=>{e.preventDefault();target=null;keys.add(b.dataset.worldDir);wake();}));
    on(svg,'pointerdown',e=>{
      keyboardNavigation=false;if(e.target.closest('button')||dialog)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());
      svg.focus({preventScroll:true});
      if(walkable(p.x,p.y)){target={x:p.x,y:p.y};wake();}else{message='Ainda é água por ali. A ponte e o portal abrem novos caminhos!';document.getElementById('worldMessage').textContent=message;}
    });
    on(svg,'focusin',e=>{if(keyboardNavigation&&e.target.dataset.x)camera({x:Number(e.target.dataset.x),y:Number(e.target.dataset.y)});});
    on(window,'resize',()=>camera());frame=0;
  }
  async function action(action,b){
    const name=action.replace('world-','');await save();
    if(name==='calendar'){close();await host.onCalendar();return;}
    if(name==='play'){close();await host.onMission(Number(b.dataset.event),b.dataset.date);return;}
    if(['shop','wardrobe','item','house'].includes(name))w=await host.api('/api/world');
    if(name==='buy'){
      const result=await host.api('/api/world/buy','POST',{item_id:b.dataset.item,price:item(b.dataset.item).price});w=result.world;dialog=null;message=result.charged?`${item(b.dataset.item).name} agora faz parte do seu mundo!`:'Essa descoberta já é sua.';DaviGame.sound();
    }else if(name==='color'||name==='equip'){
      const a={...w.avatar};if(name==='color')a.color=b.dataset.color;else a[b.dataset.item]=a[b.dataset.item]?null:b.dataset.item;
      w=await host.api('/api/world/equip','PUT',a);dialog='wardrobe';
    }else if(name==='close')dialog=null;
    else dialog=name==='item'?b.dataset.item:name;
    render();if(!dialog)document.getElementById('worldMap').focus({preventScroll:true});
  }
  function close(){stop();save();document.body.classList.remove('world-view');document.getElementById('worldDialog')?.close();}
  async function open(options){close();host=options;w=await host.api('/api/world');dialog=null;message='';render();}
  return {open,action,close};
})();
