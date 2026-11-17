/* Gameplay local. Só Fazer chama a API de execução; prática tem contrato próprio. */
window.DaviGame = (() => {
  const PHASE = {preparation:'Antes de sair', main:'Hora da atividade', return:'De volta à base'};
  const KIT = {
    taekwondo:['dobok','belt','bottle','bag'],
    escola:['book','case','notebook','bottle'],
    mochila:['book','case','notebook','bag'],
    futsal:['ball','bottle','shirt','bag'],
  };
  const ITEMS = {
    dobok:['Dobok','🥋'], belt:['Faixa','🎗️'], bottle:['Garrafa','💧'], bag:['Mochila','🎒'],
    book:['Livro','📚'], case:['Estojo','✏️'], notebook:['Caderno','📓'],
    ball:['Bola','⚽'], shirt:['Camiseta','👕'], robot:['Robô de brinquedo','🤖'],
    controller:['Controle de jogo','🎮'], plant:['Vaso de planta','🌱'], pillow:['Travesseiro','🌙'],
  };
  let g, host, settings;
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function preferences() {
    try { return JSON.parse(localStorage.getItem('davi-game-settings')) || {}; } catch { return {}; }
  }
  function saveSettings() {
    try { localStorage.setItem('davi-game-settings',JSON.stringify(settings)); } catch {}
  }
  function button(label, action, cls='', attrs='') {
    return `<button type="button" class="g-button ${cls}" data-action="game-${action}" ${attrs}>${label}</button>`;
  }
  function robot(pose='') {
    return `<svg class="g-robot ${pose}" viewBox="0 0 220 240" aria-hidden="true"><ellipse cx="110" cy="218" rx="65" ry="12" fill="#102443" opacity=".22"/><path d="M66 178v27q15 15 34 0v-27m20 0v27q15 15 34 0v-27" fill="#253d79" stroke="#173363" stroke-width="5"/><path d="M48 114l-18 38 13 13 24-32m105-19 18 38-13 13-24-32" fill="#fdcf67" stroke="#173363" stroke-width="5" stroke-linejoin="round"/><rect x="56" y="102" width="108" height="85" rx="26" fill="#4ed4c6" stroke="#173363" stroke-width="6"/><path d="M66 116h85v13H66" fill="#99f3d6"/><path d="m110 138 7 12 14 3-10 10 1 14-12-6-12 6 1-14-10-10 14-3Z" fill="#fff2b3"/><rect x="47" y="24" width="126" height="91" rx="30" fill="#ffce75" stroke="#173363" stroke-width="6"/><path d="M48 54V43q0-26 31-26h63q31 0 31 26v11l-29-9-21 9-25-10-23 12Z" fill="#31365e"/><rect x="67" y="57" width="86" height="35" rx="16" fill="#203c65"/><path d="M79 74h12m38 0h12" stroke="#a6ffe6" stroke-width="7" stroke-linecap="round"/><path d="M99 99q11 8 22 0" fill="none" stroke="#a65334" stroke-width="4" stroke-linecap="round"/><circle cx="165" cy="31" r="11" fill="#b6f2ed" stroke="#173363" stroke-width="4"/></svg>`;
  }
  function art(kind, icon='⭐') {
    const base='<svg viewBox="0 0 160 160" aria-hidden="true">';
    const end='</svg>';
    const shadow='<ellipse cx="80" cy="140" rx="48" ry="8" fill="#24324c" opacity=".13"/>';
    const drawings={
      bag:'<path d="M59 39v-9q21-18 42 0v9" fill="none" stroke="#253765" stroke-width="9"/><rect x="35" y="37" width="90" height="102" rx="24" fill="#7762e9" stroke="#283664" stroke-width="5"/><path d="M45 54q33-22 70 0" fill="none" stroke="#a99bff" stroke-width="9"/><rect x="47" y="88" width="66" height="40" rx="12" fill="#ffce68" stroke="#283664" stroke-width="4"/><path d="M58 98h44" stroke="#a7723d" stroke-width="4"/><path d="m80 56 6 10 12 2-8 8 2 12-12-6-11 6 2-12-9-8 12-2Z" fill="#e8ffef"/>',
      bottle:'<rect x="64" y="20" width="32" height="18" rx="5" fill="#374974"/><path d="M65 37h30l5 20 11 14v56q-31 22-62 0V71l11-14Z" fill="#54d4d7" stroke="#283664" stroke-width="5"/><path d="M60 83h40v29H60Z" fill="#f4f5ca"/><path d="M65 55v17m-5 6v38" stroke="white" stroke-width="7" opacity=".5" stroke-linecap="round"/>',
      dobok:'<path d="m54 31 26 10 26-10 33 31-20 21-17-12 6 66H52l6-66-17 12-20-21Z" fill="#f7f8ff" stroke="#283664" stroke-width="5" stroke-linejoin="round"/><path d="m54 31 26 36 26-36M80 67v68" fill="none" stroke="#9aaac4" stroke-width="5"/><path d="M53 96h54v13H53" fill="#6f5bc8"/><path d="m78 101 12 28 12-7-16-25Z" fill="#7762e9"/>',
      belt:'<path d="m32 60 95-22 7 21-96 24Z" fill="#9374ed" stroke="#283664" stroke-width="5"/><path d="m71 67-18 69 21 4 18-70m-6-7 14 66 20-7-22-65" fill="#b39af9" stroke="#283664" stroke-width="5"/><path d="m65 59 29-6 9 19-32 9Z" fill="#7461d6" stroke="#283664" stroke-width="5"/>',
      book:'<path d="m30 42 53-17 49 16v94l-49-15-53 15Z" fill="#ffce68" stroke="#283664" stroke-width="5"/><path d="M83 25v95l-45 11V47Z" fill="#f7f0dc" stroke="#283664" stroke-width="4"/><path d="m94 49 25 8m-25 9 25 8m-25 9 19 6" stroke="#a57338" stroke-width="5" stroke-linecap="round"/>',
      notebook:'<rect x="35" y="25" width="90" height="112" rx="11" fill="#54d4c3" stroke="#283664" stroke-width="5"/><path d="M50 26v110" stroke="#283664" stroke-width="5"/><path d="M67 51h38v25H67Z" fill="#fcf6d7"/><path d="M28 44h17m-17 25h17m-17 25h17m-17 25h17" stroke="#283664" stroke-width="5" stroke-linecap="round"/>',
      case:'<path d="m27 68 88-29 22 32-88 48-25-17Z" fill="#f38c93" stroke="#283664" stroke-width="5" stroke-linejoin="round"/><path d="m27 68 22 30 88-27m-88 27v21" fill="none" stroke="#283664" stroke-width="5"/><path d="m45 66 63-21" stroke="#ffd0ae" stroke-width="6" stroke-linecap="round"/>',
      pillow:'<path d="M29 47q49-17 102 0l-6 46 7 31q-52 18-104 0l7-35Z" fill="#c0a6ef" stroke="#283664" stroke-width="5" stroke-linejoin="round"/><path d="M40 55q43-10 79 0m-79 60q43 10 79 0" fill="none" stroke="#eadbff" stroke-width="5"/><path d="m75 66 5 10 12 2-9 8 2 12-10-6-11 6 2-12-9-8 12-2Z" fill="#fff0b2"/>',
      ball:'<circle cx="80" cy="83" r="52" fill="#faf6df" stroke="#283664" stroke-width="5"/><path d="m80 59 23 16-9 27H65l-8-27Zm0-28v28m23 16 26-8m-35 35 16 26m-45-26-18 24m10-51-26-8" fill="#546494" stroke="#283664" stroke-width="5"/>',
      shirt:'<path d="m55 32 25 9 25-9 30 30-18 22-17-11 5 63H55l5-63-17 11-18-22Z" fill="#5ed1b8" stroke="#283664" stroke-width="5" stroke-linejoin="round"/><path d="M65 38q15 26 30 0" fill="none" stroke="#c7ffe1" stroke-width="7"/><path d="m80 70 6 12 14 2-10 10 2 14-12-7-12 7 2-14-10-10 14-2Z" fill="#fff0b2"/>',
      controller:'<path d="M55 55h50q19 0 26 22l10 37q-3 22-22 11l-18-18H59l-18 18q-19 11-22-11l10-37q7-22 26-22Z" fill="#7464d6" stroke="#283664" stroke-width="5"/><path d="M44 71v24m-12-12h24" stroke="#e3eaff" stroke-width="7" stroke-linecap="round"/><circle cx="112" cy="77" r="6" fill="#ffda89"/><circle cx="124" cy="90" r="6" fill="#9ef0d2"/><circle cx="73" cy="98" r="5" fill="#283664"/><circle cx="88" cy="98" r="5" fill="#283664"/>',
      plant:'<path d="M79 88V43m0 23q-39 0-37-33 37 0 37 33Zm1-12q31 2 37-27-34-2-37 27Z" fill="#82d1ac" stroke="#283664" stroke-width="5" stroke-linejoin="round"/><path d="m46 83 9 54h49l10-54Z" fill="#eea287" stroke="#283664" stroke-width="5"/><path d="M42 82h76v15H42Z" fill="#ffcc9b" stroke="#283664" stroke-width="5"/>',
      robot:'<path d="M80 26v-9" stroke="#283664" stroke-width="5"/><circle cx="80" cy="16" r="6" fill="#ffe08a"/><rect x="43" y="31" width="74" height="56" rx="15" fill="#ffd18a" stroke="#283664" stroke-width="5"/><path d="M59 57h8m26 0h8" stroke="#283664" stroke-width="7" stroke-linecap="round"/><path d="M72 72h16" stroke="#b57358" stroke-width="4"/><rect x="51" y="88" width="58" height="42" rx="10" fill="#7edacb" stroke="#283664" stroke-width="5"/><path d="M64 130v10m31-10v10m-44-39-15 13m73-13 15 13" stroke="#283664" stroke-width="9" stroke-linecap="round"/>',
    };
    return drawings[kind] ? base+shadow+drawings[kind]+end : `<span class="g-emoji" aria-hidden="true">${esc(ITEMS[kind]?.[1] || icon)}</span>`;
  }
  function stepArt(step) {
    const types={'🎒':'bag','🥋':'dobok','🎗️':'belt','🚰':'bottle','💧':'bottle','📚':'book','📓':'notebook','✏️':'case'};
    return art(types[step.icon],step.icon);
  }
  function sound() {
    if (preferences().sound !== true) return;
    try {
      const audio=new (window.AudioContext || window.webkitAudioContext)();
      const gain=audio.createGain(); gain.gain.value=.035; gain.connect(audio.destination);
      [523,659,784].forEach((frequency,i)=>{const note=audio.createOscillator();note.type='sine';note.frequency.value=frequency;note.connect(gain);note.start(audio.currentTime+i*.09);note.stop(audio.currentTime+i*.09+.12);});
      setTimeout(()=>audio.close(),600);
    } catch {}
  }
  function stopVoice() { if ('speechSynthesis' in window) speechSynthesis.cancel(); }
  function speak() {
    if (!('speechSynthesis' in window)) {g.message='A voz não está disponível neste aparelho. Você pode ler junto com o responsável.';render();return;}
    stopVoice();
    const s=g.m.steps[g.index], voice=new SpeechSynthesisUtterance(`${s.title}. ${s.instruction}`);
    voice.lang='pt-BR'; voice.rate=.9;
    const pt=speechSynthesis.getVoices().find(v=>v.lang.toLowerCase()==='pt-br');if(pt)voice.voice=pt;
    speechSynthesis.speak(voice);
  }
  function notice(text) {g.message=text; document.getElementById('status').textContent=text;}
  function scene(content, cls='') {
    const kitName=KIT[g.m.id] ? 'Monte a bolsa' : 'Trilha da memória';
    host.layout(`<div class="game-shell ${cls} ${settings.motion?'':'g-still'}">
      <div class="g-toolbar">${button('← Agenda','exit','g-quiet')}<span class="g-brand">✦ BASE DE AVENTURAS</span><div class="g-switches">${button(settings.sound?'♪ Som ligado':'♪ Sem som','sound','g-quiet',`aria-pressed="${settings.sound}"`)}${button(settings.motion?'✧ Movimento':'✧ Sem movimento','motion','g-quiet',`aria-pressed="${settings.motion}"`)}</div></div>
      <div class="g-sky" aria-hidden="true"><i></i><i></i><i></i><span>✦</span><span>✧</span><span>✦</span></div>
      ${content}<div class="g-bottom"><span>SEM PRESSA. DO SEU JEITO.</span><span>${g.screen==='hub' ? esc(kitName) : 'UMA PEQUENA AVENTURA POR VEZ'}</span></div></div>`);
    document.body.classList.add('game-view');
    if(g.message) document.getElementById('status').textContent=g.message;
  }
  function routeDots(index, total) {
    const count=Math.min(total,12);
    return `<div class="g-route" role="img" aria-label="Passo ${index+1} de ${total}">${Array.from({length:count},(_,i)=>`<span class="${i<=Math.floor(index/total*count)?'lit':''}" aria-hidden="true">${i<Math.floor(index/total*count)?'✦':'◆'}</span>`).join('<i aria-hidden="true"></i>')}</div>`;
  }
  const canDo=()=>!g.m.window || g.m.window.state==='open';
  function timingNote(){return g.m.window ? windowLabel(g.m.window) : '';}
  function hub() {
    scene(`<div class="g-intro"><div class="g-intro-copy"><span class="g-eyebrow">SUA MISSÃO ESTÁ PRONTA</span><h1>${esc(g.title)}</h1><p>Um pouco de imaginação.<br>Uma aventura na vida real.</p><span class="g-date">${esc(host.dateLabel)} · ${g.m.confirmed}/${g.m.total} passos realizados</span></div>
      <div class="g-island" aria-hidden="true"><div class="g-orbit"></div><div class="g-planet"></div>${robot()}<span class="g-float-crystal">✦</span><span class="g-scene-label">PIPO · SEU PARCEIRO DE TREINO</span></div></div>
      <div class="g-select-heading"><h2>Como vamos jogar?</h2><span>ESCOLHA SUA PORTA ↓</span></div><div class="g-portals">
      ${button('<span class="g-portal-icon">◉</span><span><small>01 · DESCOBRIR</small><strong>Aprender</strong><em>Veja, ouça e explore os passos.</em></span><b>↗</b>','learn','g-portal g-learn')}
      ${button('<span class="g-portal-icon">⚑</span><span><small>02 · MUNDO REAL</small><strong>Fazer</strong><em>Saia da tela. Faça uma coisa por vez.</em></span><b>↗</b>','do','g-portal g-do',canDo()?'':'disabled')}
      ${button('<span class="g-portal-icon">✧</span><span><small>03 · LABORATÓRIO</small><strong>Lembrar</strong><em>Sequências e uma bolsa de ideias!</em></span><b>↗</b>','remember','g-portal g-remember')}</div>
      <p class="g-footnote">${esc(timingNote())} ${button('Atualizar horário','refresh-time','g-text')}</p><p class="g-footnote">Aprender e Lembrar são treinos. Estrelas só no horário da atividade. Só em Fazer você confirma o que realizou fora da tela.</p>`,'g-hub');
  }
  function runner() {
    const s=g.m.steps[g.index], real=g.mode==='do';
    scene(`<div class="g-level-heading"><div><span class="g-eyebrow">${real?'⚑ MISSÃO NA VIDA REAL':'◉ MODO DESCOBERTA'}</span><h1>${esc(PHASE[s.phase])}</h1></div>${button('Trocar modo','hub','g-quiet')}</div>
      ${routeDots(g.index,g.m.steps.length)}<div class="g-runner"><div class="g-stage"><span class="g-stage-ring"></span><div class="g-object">${stepArt(s)}</div><div class="g-stage-floor"></div><div class="g-sidekick">${robot()}</div><span class="g-stage-number">${String(g.index+1).padStart(2,'0')}</span></div>
      <section class="g-step-copy" aria-labelledby="gameStepTitle"><span class="g-eyebrow">PASSO ${g.index+1} DE ${g.m.steps.length}</span><h2 id="gameStepTitle" tabindex="-1">${esc(s.title)}</h2><p class="g-instruction">${esc(s.instruction)}</p>
      <div class="g-tools">${button('◖ Ouvir','speak','g-chip')}${button('✧ Uma dica','hint','g-chip')}${button('♡ Preciso de ajuda','help','g-chip')}</div>
      ${g.message?`<div class="g-speech" role="status">${esc(g.message)}</div>`:''}
      ${real ? `<p class="g-reality">${s.done?'✦ Este passo já foi confirmado. Você pode rever.':'Faça fora da tela e volte quando estiver pronto.'}</p>${button(s.done?'Já fiz · próximo →':'Fiz de verdade! →','confirm','g-primary',canDo()?'':'disabled')}${s.done?button('Desfazer este passo','undo','g-text',canDo()?'':'disabled'):''}` : button(g.index===g.m.steps.length-1?'Descobri a sequência! ✦':'Entendi! Próximo →','next','g-primary')}
      <div class="g-step-nav">${button('← Voltar','previous','g-quiet',g.index===0?'disabled':'')}${real?button('Ver próximo sem confirmar →','skip','g-quiet'):''}</div></section></div>
      <p class="g-footnote">${real?'Os passos e a conclusão da atividade na agenda continuam separados.':'Explorar a sequência não confirma nenhuma tarefa real.'}</p>`);
  }
  function laboratory() {
    scene(`<div class="g-level-heading"><div><span class="g-eyebrow">✧ LABORATÓRIO DE MEMÓRIA</span><h1>Brinque de lembrar.</h1><p>Aqui, a aventura acontece na imaginação.</p></div>${button('← Modos','hub','g-quiet')}</div>
      <div class="g-lab-grid"><button type="button" class="g-game-poster g-order-poster" data-action="game-order"><span class="g-poster-art" aria-hidden="true"><i>1</i><b>↝</b><i>2</i><b>↝</b><i>3</i></span><span class="g-eyebrow">CONECTE AS IDEIAS</span><strong class="g-poster-title">Trilha da memória</strong><span class="g-poster-description">Encontre a ordem e acenda o caminho.</span><span class="g-play-label">Jogar sequência <b>▶</b></span></button>
      ${KIT[g.m.id]?`<button type="button" class="g-game-poster g-bag-poster" data-action="game-bag"><span class="g-poster-bag" aria-hidden="true">${art('bag')}<i>✦</i></span><span class="g-eyebrow">OBSERVE. GUARDE. ESCOLHA.</span><strong class="g-poster-title">O que vai na bolsa?</strong><span class="g-poster-description">Memorize os itens e prepare a bolsa do jogo.</span><span class="g-play-label">Montar bolsa <b>▶</b></span></button>`:`<div class="g-lab-companion">${robot()}<p>Seu roteiro vira uma trilha diferente a cada rodada!</p></div>`}</div>
      <div class="g-difficulty"><span>Seu tamanho de desafio:</span>${[2,3,4].map(n=>button(`${n} passos`,'size','g-chip',`data-size="${n}" aria-pressed="${g.size===n}"`)).join('')}</div><p class="g-footnote">Acertar aqui é praticar a memória. Sua atividade real continua como estava.</p>`);
  }
  async function newRound(kind, restart=false) {
    stopVoice();g.kind=kind;g.screen=kind;g.message='';g.selected=[];g.reward=null;g.chestOpen=false;
    if(restart || !g.practice) {
      g.server=await host.api('/api/world/practice','POST',{event_id:g.m.event_id,date:g.m.date,mode:kind,size:g.size});
      g.m={...g.server.mission,window:g.m.window};
      g.practice={id:g.server.id,version:1,mode:'remember',challenge:kind,mission_id:g.m.id,revision:g.m.revision,event_id:g.m.event_id,date:g.m.date,rounds:0,hints:0};
    } else g.server=await host.api('/api/world/practice/'+g.server.id);
    g.choices=g.server.choices;
    g.goal=kind==='bag'?g.server.preview:Array(g.server.count).fill(null);
    if(kind==='bag')g.preview=true;
    render();
  }
  function orderGame() {
    const chosen=g.selected.map(id=>g.m.steps.find(s=>s.id===id));
    scene(`${gameHeading('Trilha da memória','Qual é o caminho? Toque nos passos na ordem em que acontecem.')}
      <div class="g-memory-track">${g.goal.map((_,i)=>`<div class="g-memory-stop ${chosen[i]?'filled':''}"><span>${i+1}</span>${chosen[i]?button(`<b>${esc(chosen[i].icon)}</b><small>${esc(chosen[i].title)}</small>`,'unpick','g-placed',`data-index="${i}" aria-label="Retirar ${esc(chosen[i].title)}"`):'<b aria-hidden="true">?</b>'}</div>`).join('<i class="g-track-join" aria-hidden="true">↝</i>')}</div>
      <div class="g-card-deck">${g.choices.map(id=>{const s=g.m.steps.find(s=>s.id===id);return button(`<span class="g-card-art">${stepArt(s)}</span><span>${esc(s.title)}</span>`,'pick','g-memory-card',`data-choice="${esc(id)}" ${g.selected.includes(id)?'disabled':''}`);}).join('')}</div>${gameControls()}`);
  }
  function gameHeading(title,instruction) {
    return `<div class="g-level-heading"><div><span class="g-eyebrow">TREINO ${g.practice.rounds+1} DE 2 · SÓ NO JOGO</span><h1 id="gameTitle" tabindex="-1">${title}</h1><p>${instruction}</p></div>${button('← Jogos','remember','g-quiet')}</div>`;
  }
  function gameControls() {
    return `<div class="g-game-feedback" role="status">${esc(g.message || 'Pode experimentar. Você pode mudar de ideia.')}</div><div class="g-game-controls">${button('✧ Uma pista','game-hint','g-chip')}${button('↺ Recomeçar','restart','g-quiet')}${button(g.kind==='order'?'Acender o caminho ✦':'Conferir minha bolsa ✦','check','g-primary')}</div>`;
  }
  function bagGame() {
    if(g.preview) {
      scene(`${gameHeading('Olhe a lista secreta!','Guarde estes itens na memória. Depois, eles se misturam!')}
        <div class="g-preview-items">${g.goal.map(id=>`<div class="g-secret-item">${art(id)}<strong>${esc(ITEMS[id][0])}</strong></div>`).join('')}</div><div class="g-preview-footer">${robot()}<div><p>Sem correr. Quando estiver pronto, esconda a lista.</p>${button('Já memorizei! →','hide-list','g-primary')}</div></div><p class="g-footnote">Esta é a lista desta rodada. A bolsa de verdade é combinada com seu responsável.</p>`);return;
    }
    scene(`${gameHeading('O que vai na bolsa?','Toque para guardar. Toque de novo para tirar. Você lembra da lista?')}
      <div class="g-packing-layout"><div class="g-pack-area"><div class="g-pack-bag">${art('bag')}<span>${g.selected.length} itens na bolsa</span></div><div class="g-packed-items" role="group" aria-label="Itens na bolsa">${g.selected.map(id=>button(`${art(id)}<small>${esc(ITEMS[id][0])}</small>`,'pick','g-packed',`data-choice="${id}" aria-label="Retirar ${esc(ITEMS[id][0])}"`)).join('') || '<p>Um lugar para cada ideia.</p>'}</div></div>
      <div class="g-item-grid">${g.choices.map(id=>button(`${art(id)}<span>${esc(ITEMS[id][0])}</span>${g.selected.includes(id)?'<i aria-hidden="true">✦</i>':''}`,'pick','g-item',`data-choice="${id}" aria-pressed="${g.selected.includes(id)}"`)).join('')}</div></div>${gameControls()}<p class="g-footnote">Montar esta bolsa virtual não confirma que a bolsa real está pronta.</p>`);
  }
  function celebration(real=false) {
    const completed=real || g.practice?.rounds===2 || g.mode==='learn';
    scene(`<div class="g-celebration"><div class="g-confetti" aria-hidden="true">${Array.from({length:12},()=>'<i>✦</i>').join('')}</div><span class="g-eyebrow">${real?'SEUS PASSOS NA VIDA REAL':completed?'TREINO CONCLUÍDO':'CAMINHO CONECTADO'}</span><div class="g-victory-art">${robot('g-victory')}<span>✦</span><span>✧</span></div><h1 tabindex="-1" id="gameWinTitle">${real?'Um passo faz diferença!':completed?'Memória em ação!':'Boa conexão!'}</h1><p>${real?`${g.m.confirmed} de ${g.m.total} passos realizados. Combine com o responsável o que vem agora.`:g.mode==='learn'?'Você explorou a sequência. Agora ela já é uma ideia conhecida!':completed?'Você observou, experimentou e lembrou. Isso é praticar!':'As ideias se encontraram. Vamos ligar mais um caminho?'}</p>
      ${rewardChest()}<div class="g-win-actions">${!completed?button('Próximo desafio →','next-round','g-primary'):button(real?'Voltar para os modos':'Levar para a vida real ⚑',real?'hub':'do','g-primary')}${button(completed?'Pausa · voltar à agenda':'Pausa · sair do jogo','exit','g-quiet')}${completed&&!real?button('Jogar de novo ↺',g.mode==='learn'?'learn':'replay','g-text'):''}</div><p class="g-footnote">${real?'A conclusão do compromisso continua na agenda.':'Treino de memória não marca nenhuma tarefa real como feita.'}</p></div>`,'g-finale');
  }
  function rewardChest() {
    if(!g.reward)return '';
    if(!g.reward.delta)return `<p class="g-footnote">${esc(g.reward.message)}</p>`;
    return `<div class="g-reward-chest ${g.chestOpen?'opened':''}"><svg viewBox="0 0 110 85" class="g-chest-art" aria-hidden="true"><ellipse cx="55" cy="76" rx="40" ry="7" fill="#172f4d"/><path d="M20 38h70v34H20Z" fill="#bf885a" stroke="#f1cf83" stroke-width="4"/><path d="M35 41v29m40-29v29" stroke="#edc371" stroke-width="7"/><g class="g-chest-lid"><path d="M18 38V22q37-25 74 0v16Z" fill="#d4a16c" stroke="#f4d38b" stroke-width="4"/><path d="M35 15v23m40-23v23" stroke="#f1cf83" stroke-width="7"/></g><path d="M48 36h14v17H48Z" fill="#ffe49b"/>${g.chestOpen?'<path d="m55 8 5 11 12 2-9 8 2 12-10-6-10 6 2-12-9-8 12-2Z" fill="#ffecaa"/>':''}</svg><strong>${g.chestOpen?'+'+g.reward.delta+' estrelas guardadas!':'Seu baú: '+g.reward.delta+' estrelas'}</strong>${!g.chestOpen?button('Abrir meu baú ✦','chest','g-primary'):''}<small>Seu saldo: ${g.reward.stars} estrelas · prêmio já guardado no mundo.</small></div>`;
  }
  function completePractice() {
    const session={...g.practice,reward:g.reward,completed_at:new Date().toISOString()};
    // Contrato de integração da Etapa C: evento de prática, nunca de execução real.
    // O servidor valida cada desafio e concede estrelas; o evento é apenas UX.
    host.onPractice?.(session);
    window.dispatchEvent(new CustomEvent('davi:practice-complete',{detail:session}));
  }
  function render() {
    if(g.screen==='hub')hub();else if(g.screen==='runner')runner();else if(g.screen==='lab')laboratory();
    else if(g.screen==='order')orderGame();else if(g.screen==='bag')bagGame();else celebration(g.screen==='real-end');
  }
  function focusTitle() {
    const heading=document.getElementById('gameStepTitle') || document.getElementById('gameTitle') || document.getElementById('gameWinTitle') || document.querySelector('.game-shell h1');
    if(heading){heading.tabIndex=-1;heading.focus();}
  }
  async function action(a,b) {
    const name=a.replace('game-','');g.message='';stopVoice();
    if(name==='refresh-time'){const data=await host.api(`/api/events/${g.m.event_id}/mission?date=${g.m.date}`);g.m=data.mission;render();return;}
    if(name==='exit') {close();await host.onExit();return;}
    if(name==='sound') {settings.sound=!settings.sound;saveSettings();}
    else if(name==='motion') {settings.motion=!settings.motion;saveSettings();}
    else if(name==='hub') g.screen='hub';
    else if(name==='learn'||name==='do') {
      g.mode=name;g.screen='runner';g.reward=null;g.chestOpen=false;
      if(name==='learn') {
        g.server=await host.api('/api/world/practice','POST',{event_id:g.m.event_id,date:g.m.date,mode:'learn'});
        g.m={...g.server.mission,window:g.m.window};
        g.practice={id:g.server.id,version:1,mode:'learn',challenge:'sequence',mission_id:g.m.id,revision:g.m.revision,event_id:g.m.event_id,date:g.m.date,rounds:0,hints:0};
      } else g.practice=null;
      g.index=name==='do'?Math.max(0,g.m.steps.findIndex(s=>!s.done)):0;
    }
    else if(name==='remember') {g.mode='remember';g.screen='lab';g.practice=null;}
    else if(name==='size')g.size=Number(b.dataset.size);
    else if(name==='hint') {notice(g.m.steps[g.index].hint || 'Olhe o desenho e releia o passo. Você pode fazer junto com o responsável.');if(g.practice)g.practice.hints++;}
    else if(name==='help')notice('Chame seu responsável: “Pode fazer este passo comigo?” Podemos esperar aqui.');
    else if(name==='speak') {speak();return;}
    else if(name==='previous')g.index=Math.max(0,g.index-1);
    else if(name==='next'||name==='skip'||name==='confirm') {
      if(name==='confirm'&&!g.m.steps[g.index].done) {const s=g.m.steps[g.index];g.m=await host.api(`/api/events/${g.m.event_id}/mission/steps/${encodeURIComponent(s.id)}`,'PUT',{date:g.m.date,template_id:g.m.id,revision:g.m.revision,done:true});sound();}
      if(g.mode==='learn') {
        const result=await host.api('/api/world/practice/'+g.server.id+'/advance','POST',{step_id:g.m.steps[g.index].id});
        if(result.reward)g.reward=result.reward;
      }
      if(g.mode==='do'&&g.m.confirmed===g.m.total)g.reward=await host.api('/api/world/real','POST',{event_id:g.m.event_id,date:g.m.date});
      if(g.index<g.m.steps.length-1)g.index++;else {g.screen=g.mode==='do'?'real-end':'win';if(g.mode==='learn')completePractice();sound();}
    } else if(name==='undo') {const s=g.m.steps[g.index];g.m=await host.api(`/api/events/${g.m.event_id}/mission/steps/${encodeURIComponent(s.id)}`,'PUT',{date:g.m.date,template_id:g.m.id,revision:g.m.revision,done:false});notice('Este passo voltou a ficar pendente. Tudo bem rever o combinado.');}
    else if(name==='order'||name==='bag') {await newRound(name,true);focusTitle();return;}
    else if(name==='restart'||name==='replay') {await newRound(g.kind,true);focusTitle();return;}
    else if(name==='hide-list')g.preview=false;
    else if(name==='pick') {
      const id=b.dataset.choice;
      if(g.kind==='bag') g.selected=g.selected.includes(id)?g.selected.filter(item=>item!==id):[...g.selected,id];
      else if(!g.selected.includes(id)&&g.selected.length<g.goal.length)g.selected.push(id);
    } else if(name==='unpick')g.selected.splice(Number(b.dataset.index),1);
    else if(name==='chest') {g.chestOpen=true;sound();}
    else if(name==='game-hint') {
      g.practice.hints++;
      const result=await host.api('/api/world/practice/'+g.server.id+'/hint','POST',{selected:g.selected});
      notice(result.message);
    }
    else if(name==='check') {
      const result=await host.api('/api/world/practice/'+g.server.id+'/answer','POST',{round:g.server.cursor,selected:g.selected});
      if(result.correct) {g.practice.rounds=result.cursor;g.reward=result.reward;g.screen='win';if(result.completed)completePractice();sound();}
      else notice(g.kind==='order'?'As ideias ainda estão procurando o caminho. Retire um passo ou recomece. Uma pista pode ajudar!':'Esta bolsa está diferente da lista do jogo. Você pode tirar, trocar ou pedir uma pista!');
    } else if(name==='next-round') {await newRound(g.kind);focusTitle();return;}
    render();
    if(name==='pick'&&g.kind==='order') document.querySelector('.g-memory-card:not(:disabled), [data-action="game-check"]')?.focus({preventScroll:true});
    if(['learn','do','next','skip','confirm','previous','check','next-round','hub','remember'].includes(name))focusTitle();
  }
  function close() {stopVoice();document.body.classList.remove('game-view');}
  function open(options) {
    close();host=options;const prefs=preferences();
    settings={sound:prefs.sound===true,motion:prefs.motion ?? !window.matchMedia('(prefers-reduced-motion: reduce)').matches};
    g={m:options.mission,title:options.title,screen:'hub',size:3,index:0,message:''};render();
  }
  return {open,action,close,robot,art,sound,preferences};
})();
