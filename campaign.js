/* Campanha e relógio de jogo. A autorização e o tempo vêm do servidor. */
(() => {
  const tab = Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2,'0')).join('');
  const categories = {learning:'Aprendizado',play:'Brincadeira',sport:'Esporte recreativo',project:'Projeto criativo',help:'Colaboração'};
  const connectionPause = 'A conexão com a aventura fez uma pausa.';
  const manualPause = 'Hora de uma pausa.';
  let validator, request, onPause, playing=false, grant=false, serial=Promise.resolve();
  let leaseUntil=0, warning=false, pulseTimer, deadlineTimer, warningTimer, generation=0;

  function send(action,world) {
    const api=request;
    const execute=()=>api('/api/adventure/play','POST',{tab,action,world},{keepalive:action==='leave'});
    const call=serial.then(execute);
    serial=call.catch(()=>{});
    return call;
  }
  function clearTimers() {
    clearTimeout(pulseTimer);
    clearTimeout(deadlineTimer);
    clearTimeout(warningTimer);
  }
  function showWarning() {
    warning=true;
    const status=document.getElementById('playNotice');
    if(status)status.textContent='Daqui a pouco, vamos guardar a aventura e fazer uma pausa.';
  }
  function apply(reply) {
    clearTimers();
    grant=true;
    leaseUntil=reply.lease==null?Infinity:performance.now()+reply.lease*1000;
    if(reply.remaining!=null&&reply.remaining<=60)showWarning();
    else {
      warning=false;
      const status=document.getElementById('playNotice');
      if(status)status.textContent='';
      if(reply.remaining!=null)warningTimer=setTimeout(showWarning,(reply.remaining-60)*1000);
    }
    if(reply.lease!=null) {
      const token=generation;
      deadlineTimer=setTimeout(()=>{if(token===generation)finish(connectionPause);},reply.lease*1000+200);
      pulseTimer=setTimeout(refresh,Math.min(5000,Math.max(350,reply.lease*500)));
    }
  }
  async function refresh() {
    if(!playing||document.hidden)return;
    const token=generation;
    try {
      const reply=await send('start',document.querySelector('.trail-shell')?.dataset.world);
      if(token!==generation)return;
      if(reply.allowed)apply(reply);
      else finish(reply.message);
    }catch {
      if(token===generation && performance.now()>=leaseUntil)finish(connectionPause);
      else if(token===generation)pulseTimer=setTimeout(refresh,700);
    }
  }
  function stop() {
    const wasPlaying=playing;
    generation++;
    playing=false;
    grant=false;
    warning=false;
    clearTimers();
    if(wasPlaying)send('leave').catch(()=>{});
  }
  async function finish(message) {
    if(!playing)return;
    // A tela congela antes do salvamento. A concessão curta permite entregar o último ponto.
    grant=false;
    clearTimers();
    await onPause(message||connectionPause);
  }
  async function enter(api, pause) {
    request=api;
    onPause=pause;
    if(playing&&permit())return true;
    const token=++generation;
    if(document.hidden){await pause(connectionPause);return false;}
    let reply;
    try {reply=await send('start');}
    catch {await pause(connectionPause);return false;}
    if(token!==generation)return false;
    if(!reply.allowed){await pause(reply.message);return false;}
    playing=true;
    warning=false;
    apply(reply);
    return true;
  }
  function permit() {
    return grant&&!document.hidden&&performance.now()<leaseUntil;
  }
  async function takeBreak() {
    if(!playing)return;
    generation++;
    grant=false;
    clearTimers();
    const reply=await send('pause').catch(()=>null);
    await finish(reply?.message||manualPause);
  }
  function visibility() {
    if(!playing)return;
    generation++;
    grant=false;
    clearTimers();
    if(document.hidden)send('leave').catch(()=>{});
    else refresh();
  }
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',event=>{if(event.persisted&&request&&document.getElementById('playBar'))enter(request,onPause);});

  function headers(includeValidation=true) {
    return {'X-Davi-Play':tab,...(validator&&includeValidation?{'X-Davi-Validation':validator}:{})};
  }
  function decorate(view, content) {
    if(view!=='child-world'&&view!=='child-game'){stop();return;}
    const bar=document.createElement('aside');
    bar.id='playBar';
    bar.innerHTML='<p id="playNotice" role="status"></p><button type="button" data-action="campaign-pause">Fazer uma pausa</button>';
    content.prepend(bar);
    if(warning)showWarning();
  }
  function paused(message, esc) {
    return '<section class="panel campaign-pause" aria-labelledby="campaignPauseTitle"><h1 id="campaignPauseTitle" tabindex="-1">Sua aventura fica guardada</h1><p>'+
      esc(message)+'</p><p>Se quiser, experimente desenhar um mapa no papel ou brincar longe da tela.</p>'+
      '<button type="button" data-action="child-now-calendar">Ver agenda</button></section>';
  }
  function summary(chapter, previous, progress, esc) {
    if(chapter.unlocked) {
      const state=chapter.discovered?'Descoberta guardada':'Capítulo aberto';
      return '<small>'+state+'</small>';
    }
    const achieved=Math.min(progress.count,chapter.required);
    return '<small>Capítulo bloqueado</small><progress aria-label="Conquistas aprovadas" value="'+
      achieved+'" max="'+chapter.required+'"></progress><small>'+
      achieved+' de '+chapter.required+(chapter.required===1?' conquista aprovada':' conquistas aprovadas')+'</small><small>'+
      (previous.discovered?'Descoberta anterior guardada':esc(previous.discovery))+'</small>';
  }
  function chapters(progress, selected, esc) {
    return '<p class="campaign-intro">'+(progress.validation?'Modo de validação nesta aba.':
      'As conquistas aprovadas pelo responsável contam juntas. Avance no seu ritmo.')+'</p>'+
      '<div class="world-picker-grid">'+progress.chapters.map((chapter,i)=>
        '<div class="campaign-chapter"><button class="f-button world-choice" type="button" data-action="world-select" data-world="'+esc(chapter.id)+
        '" aria-current="'+(chapter.id===selected)+'" '+(chapter.unlocked?'':'disabled')+'>'+
        '<span aria-hidden="true">'+esc(chapter.icon)+'</span><strong>'+esc(chapter.title)+'</strong></button>'+
        summary(chapter,progress.chapters[i-1],progress,esc)+'</div>').join('')+'</div>';
  }
  function portalDetail(progress, world, esc) {
    const i=progress.chapters.findIndex(chapter=>chapter.id===world), next=progress.chapters[i+1];
    if(!next)return '<p>Você chegou ao último capítulo.</p>';
    return '<h3>'+esc(next.title)+'</h3><div class="campaign-chapter">'+summary(next,progress.chapters[i],progress,esc)+'</div>';
  }
  function admin(data, esc) {
    const time=data.screen;
    const header='<div class="row between"><h1>Aventura e pausas</h1><button data-action="calendar">← Calendário</button></div>';
    const values=data.chapters.slice(1).map((w,i)=>
      '<label>'+esc(w.title)+'<input name="target" type="number" min="1" max="999" step="1" required value="'+data.targets[i]+'"></label>').join('');
    const choices=data.events.map(event=>{
      const select='<select name="eligible-'+event.id+'" '+(event.allowed?'':'disabled')+'><option value="">'+
        (event.allowed?'Fora da campanha':'Cuidado essencial')+'</option>'+Object.entries(categories).map(([id,text])=>
          '<option value="'+id+'" '+(event.category===id&&event.allowed?'selected':'')+'>'+esc(text)+'</option>').join('')+'</select>';
      return '<label>'+esc(event.icon)+' '+esc(event.title)+select+'</label>';
    }).join('');
    const number=(name,label,max)=>'<label>'+label+'<input name="'+name+'" type="number" min="1" max="'+max+'" required value="'+time[name]+'"></label>';
    const clock=(key,label)=>'<label>'+label+'<input name="'+key+'" type="time" required value="'+esc(time[key])+'"></label>';
    return header+'<section class="panel"><h2>Conquistas fora da tela</h2><p>Abra uma semana para imprimir o quadro ou registrar uma atividade que Davi já fez.</p>'+
      '<button data-action="campaign-week">Abrir quadro semanal</button></section>'+
      '<form id="campaignPolicy" class="panel"><h2>Metas dos capítulos</h2><p>As metas são cumulativas. Escolha apenas atividades opcionais. Cuidados essenciais ficam fora da campanha.</p>'+
      '<div class="campaign-fields">'+values+'</div><fieldset><legend>Atividades elegíveis</legend><div class="campaign-fields">'+(choices||'<p>A agenda ainda está vazia.</p>')+
      '</div></fieldset><button type="submit" class="primary">Salvar metas</button></form>'+
      '<form id="screenPolicy" class="panel"><h2>Tempo de jogo</h2><p>Hoje foram '+data.usage.played_minutes+' min de jogo com limites ativos.'+
      (data.usage.resting?' A pausa está em andamento.':'')+'</p><label><input type="checkbox" name="enabled" '+(time.enabled?'checked':'')+'> Aplicar limites</label>'+
      '<div class="campaign-fields">'+number('session','Minutos por sessão',180)+number('daily','Minutos por dia',720)+number('pause','Minutos de pausa',120)+
      clock('opens','Início do horário de jogo')+clock('closes','Fim do horário de jogo')+
      '</div><p>Horários iguais permitem jogar durante todo o dia. A faixa usa o horário de São Paulo.</p><button type="submit" class="primary">Salvar tempo de jogo</button></form>'+
      '<section class="panel"><h2>Progresso e validação</h2><p>'+data.count+' conquistas aprovadas nesta campanha.</p>'+
      '<p>O modo de validação abre todos os mundos nesta aba por até uma hora. Posições e descobertas de teste ficam na prévia. Compras e confirmações reais ficam disponíveis após encerrar a validação.</p>'+
      '<div class="actions"><button data-action="campaign-validation" data-enabled="'+!validator+'">'+(validator?'Encerrar validação':'Ativar validação')+'</button>'+
      (validator?'<button data-action="world-home">Explorar em validação</button>':'')+'</div></section>'+
      '<section class="panel"><h2>Recomeçar</h2><div class="campaign-fields campaign-restarts">'+
      '<div><p>Volte ao primeiro capítulo e mantenha estrelas, inventário, posições e descobertas.</p>'+
      '<button data-action="campaign-reset">Reiniciar somente campanha</button></div>'+
      (Number.isInteger(data.game_generation)?'<div><p>Recomece com o jogo zerado. A agenda e os registros reais continuam guardados.</p>'+
      '<button data-action="campaign-new-game" '+(validator?'disabled':'')+'>Começar aventura do zero</button>'+
      (validator?'<small>Encerre a validação para iniciar uma nova partida.</small>':'')+'</div>':'')+
      '</div></section>'+
      '<section class="panel"><h2>Histórico de aprovações</h2>'+(data.history.length?'<ul>'+data.history.map(item=>
        '<li>'+esc(item.date)+' · '+esc(item.icon)+' '+esc(item.title)+' · '+esc(categories[item.category]||item.category)+
        ' · campanha '+item.generation+' · '+esc(new Date(item.approved_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))+'</li>').join('')+'</ul>':'<p>Nenhuma atividade aprovada.</p>')+'</section>';
  }
  function confirmNewGame(generation,trigger) {
    if(validator||!Number.isInteger(generation))return;
    const dialog=document.createElement('dialog');
    dialog.className='new-game-dialog';
    dialog.setAttribute('aria-labelledby','newGameTitle');
    dialog.innerHTML='<h2 id="newGameTitle">Começar aventura do zero?</h2>'+
      '<p>A nova partida começa na Floresta com Davi e Pipo na aparência inicial. Serão reiniciados o saldo de estrelas, o inventário, as construções, as posições, as descobertas, os minijogos, a campanha ativa e o tempo utilizado. As sessões de jogo e de validação serão encerradas.</p>'+
      '<p>A agenda, os roteiros, as atividades reais confirmadas, o histórico de aprovações, os aparelhos autorizados e as configurações do responsável serão preservados.</p>'+
      '<form id="newGameForm" data-generation="'+generation+'"><label for="newGameConfirmation">Digite <strong>RECOMEÇAR</strong> para confirmar</label>'+
      '<input id="newGameConfirmation" name="confirmation" autocomplete="off" spellcheck="false" pattern="RECOMEÇAR" required>'+
      '<p role="alert"></p><button type="submit" disabled>Confirmar nova partida</button></form>'+
      '<form method="dialog"><button>Cancelar</button></form>';
    const input=dialog.querySelector('input'), submit=dialog.querySelector('[type=submit]');
    input.addEventListener('input',()=>{submit.disabled=input.value!=='RECOMEÇAR';});
    dialog.addEventListener('close',()=>{dialog.remove();if(trigger.isConnected)trigger.focus();},{once:true});
    document.body.append(dialog);
    dialog.showModal();
    input.focus();
  }
  function week(data, esc, add, fmt) {
    const days=Array.from({length:7},(_,i)=>add(data.start,i));
    return '<div class="campaign-week"><div class="row between"><h1>Quadro semanal fora da tela</h1><div class="actions no-print">'+
      '<button data-action="campaign-admin">← Aventura e pausas</button><button data-action="campaign-print">Imprimir</button></div></div>'+
      '<div class="campaign-week-nav no-print"><button data-action="campaign-week" data-date="'+add(data.start,-7)+'">Semana anterior</button>'+
      '<button data-action="campaign-week" data-date="'+add(data.start,7)+'">Próxima semana</button></div>'+
      '<p>'+esc(fmt(data.start))+' a '+esc(fmt(data.end))+'</p><p>Use o espaço de confirmação para marcar no papel as atividades já feitas.</p>'+
      '<div class="campaign-week-grid">'+days.map(day=>'<section class="panel campaign-day"><h2>'+esc(fmt(day))+'</h2>'+
        (data.events.filter(event=>event.date===day).map(event=>'<div class="campaign-task"><span aria-hidden="true">'+esc(event.icon)+'</span><strong>'+
          esc(event.title)+'</strong><span class="campaign-mark" aria-label="Espaço para confirmar no papel"></span>'+
          (event.approved?'<span class="no-print">Aprovada</span>':event.can_approve?
            '<button class="no-print" data-action="campaign-approve" data-id="'+event.id+'" data-date="'+event.date+'">Registrar e aprovar</button>':'')+'</div>').join('')||
          '<p>Dia livre</p>')+'</section>').join('')+'</div></div>';
  }
  function policyForm(form) {
    const data=new FormData(form);
    const eligible=Object.fromEntries([...data].filter(([key,value])=>key.startsWith('eligible-')&&value).map(([key,value])=>[key.slice(9),value]));
    return {targets:data.getAll('target').map(Number),eligible};
  }
  function screenForm(form) {
    const data=new FormData(form);
    return {enabled:data.has('enabled'),session:Number(data.get('session')),daily:Number(data.get('daily')),
      pause:Number(data.get('pause')),opens:data.get('opens'),closes:data.get('closes')};
  }
  window.DaviCampaign={enter,permit,decorate,headers,takeBreak,paused,chapters,portalDetail,admin,week,policyForm,screenForm,confirmNewGame,
    validation(token){validator=token;}};
})();
