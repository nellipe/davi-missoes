const shells={
  'shell-rose':{name:'Rosa',pitch:'Grave',height:1,note:392},
  'shell-gold':{name:'Dourada',pitch:'Médio',height:2,note:523},
  'shell-blue':{name:'Azul',pitch:'Agudo',height:3,note:659},
};
const pieces={head:'Crânio',ribs:'Costelas',tail:'Cauda'};
const commands={power:['Ligar energia','⏻'],steps:['Preparar passos','↔'],dance:['Dançar','♫']};
const labels={
  melody:['Toque nas conchas do som mais grave ao mais agudo. As alturas também estão desenhadas.','Tocar melodia'],
  dig:['Escove as três áreas de terra para encontrar a peça.',''],
  skeleton:['Escolha uma peça e depois o espaço do mesmo formato.',''],
  valve:['Gire a válvula até o ponteiro entrar na faixa verde. Depois, teste a pressão.','Testar pressão'],
  coil:['Gire os dois conectores até unir a pilha, a bobina e a lâmpada.','Testar conexão'],
  commands:['Monte três comandos para o autômato e depois teste a ordem.','Testar comandos'],
};
const hints={
  melody:['A altura das bolinhas acompanha a altura dos sons.','Comece pela concha com a bolinha mais baixa.','A sequência é rosa, dourada e azul.'],
  dig:['Cada botão escova uma parte da terra.','Escolha uma área que ainda está marrom.','Todos os espaços precisam ficar claros para revelar a peça.'],
  skeleton:['Compare o formato da peça com os contornos no painel.','O crânio é arredondado, as costelas têm arcos e a cauda é comprida.','O próximo espaço do painel está destacado.'],
  valve:['A faixa verde fica entre 3 e 4.','Se o ponteiro estiver abaixo de 3, use Aumentar. Se passar de 4, use Reduzir.','Coloque o ponteiro no 3 e toque em Testar pressão.'],
  coil:['A energia sai da pilha à esquerda. Siga a linha até a lâmpada.','Uma linha deitada liga os lados esquerdo e direito de um conector.','Deixe os dois conectores deitados e toque em Testar conexão.'],
  commands:['Imagine o que o robô precisa fazer antes de dançar.','Primeiro vem a energia. Depois ele pode preparar os passos.','A ordem é Ligar energia, Preparar passos e Dançar.'],
};
const boneShapes={
  head:'M22 43c-9-1-15-7-15-15C7 14 19 8 36 8c17 0 31 7 31 20 0 9-4 13-11 16v8H27v-7zm6-19a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm19 0a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  ribs:'M7 26Q25 13 63 17 M17 22Q19 37 28 43 M27 19Q30 40 40 46 M38 17Q41 39 51 42 M49 17Q52 33 62 36',
  tail:'M8 19l12-4 6 8-9 9-10-4z M24 29l10-5 7 8-7 9-11-4z M39 39l10-3 8 6-9 7-9-4z M55 47l8-2 6 4-8 4-6-2z',
};

const pieceIds=Object.keys(pieces);
const iconOrder=['shell-blue','shell-rose','shell-gold'];
const commandOrder=['dance','power','steps'];

function shellArt(id){
  return `<svg class="qa-symbol qa-shell" viewBox="0 0 70 62" aria-hidden="true" data-shell="${id}"><path d="M35 57C24 57 9 47 6 32c-3-10 5-16 13-14 0-7 8-13 16-11 8-2 16 4 16 11 8-2 16 4 13 14-3 15-18 25-29 25z"/><path d="M15 26q5 14 20 25M24 15q1 20 11 36m11-36q-1 20-11 36m20-25q-5 14-20 25" class="qa-shell-ridges"/></svg>`;
}

function pitch(id){
  const {pitch,height}=shells[id];
  return `<span class="qa-pitch"><span class="qa-staff" data-height="${height}" aria-hidden="true"><i></i></span><span>${pitch}</span></span>`;
}

function bone(id, buried=false){
  return `<svg class="qa-symbol qa-bone" viewBox="0 0 76 60" ${buried?'preserveAspectRatio="none"':''} aria-hidden="true"><path class="qa-bone-${id}" d="${boneShapes[id]}"/></svg>`;
}

function toggle(label,action,active){
  return `<button class="f-button qa-toggle" type="button" data-action="forest-puzzle-${action}" aria-pressed="${active}">${label}<small>${active?'Ligado':'Desligado'}</small></button>`;
}

function control(label,action,choice,attributes='',style=''){
  const value=choice===undefined?'':` data-choice="${choice}"`;
  return `<button class="f-button ${style}" type="button" data-action="forest-puzzle-${action}"${value} ${attributes}>${label}</button>`;
}

export function isShell(id){return Object.hasOwn(shells,id);}
export function note(id){return shells[id]?.note;}
export const melodyNotes=Object.values(shells).map(s=>s.note);

export function renderShell(id,sound){
  const shell=shells[id];
  return `<div class="qa-shell-clue">${shellArt(id)}<div><strong>Nota da concha ${shell.name.toLowerCase()}</strong>${pitch(id)}</div></div><div class="qa-toolbar">${toggle('Som do desafio','sound',sound)}${control('Ouvir esta nota','listen',id,sound?'':'disabled')}</div>`;
}

function order(kind,values,sound){
  const music=kind==='melody';
  const ids=music?iconOrder:commandOrder;
  const art=id=>music?shellArt(id):`<span class="qa-command-icon" aria-hidden="true">${commands[id][1]}</span>`;
  const name=id=>music?shells[id].name:commands[id][0];
  const choices=ids.map(id=>control(`${art(id)}<strong>${name(id)}</strong>${music?pitch(id):''}`,'step',id,
    values.includes(id)?'disabled':'','qa-card')).join('');
  const slots=Array.from({length:3},(_,i)=>values[i]
    ?`<li class="qa-filled" aria-label="${i+1}. ${name(values[i])}">${art(values[i])}<strong>${name(values[i])}</strong></li>`
    :`<li aria-label="${i+1}. Espaço vazio"><span>${i+1}</span></li>`).join('');
  const listen=music?control('Ouvir as notas','listen','melody',sound?'':'disabled'):'';
  return `<div class="qa-rack" role="group" aria-label="${music?'Conchas':'Comandos'}">${choices}</div><ol class="qa-sequence" aria-label="Ordem escolhida">${slots}</ol><div class="qa-toolbar">${control('Desfazer último','undo',undefined,values.length?'':'disabled')}${listen}${control(labels[kind][1],'check',undefined,values.length===3?'':'disabled','f-primary')}</div>`;
}

function excavation(id,values){
  const piece=id.slice('fossil-'.length);
  const tiles=[0,1,2].map(i=>control(values.includes(i)?'✓':`Escovar<br>${i+1}`,'step',i,
    `aria-label="${values.includes(i)?'Área limpa':'Escovar área'} ${i+1}" ${values.includes(i)?'disabled data-clear="true"':''}`,'qa-soil')).join('');
  return `<div class="qa-dig" role="group" aria-label="Escavação de ${pieces[piece].toLowerCase()}">${bone(piece,true)}<div class="qa-dig-grid">${tiles}</div></div><p class="qa-progress">${values.length} de 3 áreas limpas</p>`;
}

function skeleton(values,selected,hint){
  const suggested=selected??pieceIds.find(id=>!values.includes(id));
  const cards=pieceIds.map(id=>control(`${bone(id)}<strong>${pieces[id]}</strong>`,'pick',id,
    `aria-pressed="${selected===id}" ${values.includes(id)?'disabled':''}`,'qa-card')).join('');
  const slots=['tail','head','ribs'].map(id=>{
    const fitted=values.includes(id);
    const highlighted=hint===3&&id===suggested;
    return control(`${bone(id)}<strong>${fitted?'✓ ':''}${pieces[id]}</strong>`,'fit',id,
      `aria-label="Espaço ${pieces[id]}${fitted?' preenchido':''}${highlighted?', sugerido pelo Pipo':''}" ${fitted?'disabled data-fitted="true"':''} ${highlighted?'data-suggested="true"':''}`,'qa-slot');
  }).join('');
  return `<div class="qa-rack" role="group" aria-label="Peças">${cards}</div><div class="qa-rack qa-panel" role="group" aria-label="Encaixes">${slots}</div>`;
}

function valve(value){
  const angle=-90+(value-1)*45;
  return `<div class="qa-valve" role="meter" aria-label="Pressão. Faixa verde de 3 a 4" aria-valuemin="1" aria-valuemax="5" aria-valuenow="${value}">
    <svg viewBox="0 0 240 132" aria-hidden="true"><path d="M34 106a86 86 0 0 1 172 0" class="qa-gauge-arc"/><path d="M120 20a86 86 0 0 1 61 25" class="qa-gauge-ok"/>
    <path d="M120 105V44" class="qa-gauge-hand" transform="rotate(${angle} 120 105)"/><circle cx="120" cy="105" r="8" fill="#68436d"/></svg><strong>${value}</strong><span>Faixa verde 3–4</span></div>
    <div class="qa-toolbar qa-valve-buttons">${control('− Reduzir','step',-1,value===1?'disabled':'')}${control('+ Aumentar','step',1,value===5?'disabled':'')}${control(labels.valve[1],'check',undefined,'','f-primary')}</div>`;
}

function coil(values){
  const connected=values.length===2;
  const turn=(side,label)=>{
    const flat=values.includes(side);
    return control(`<span class="qa-wire" data-flat="${flat}" aria-hidden="true"></span><small>${label}</small>`,'step',side,
      `aria-label="Conector ${label.toLowerCase()}, ${flat?'deitado':'em pé'}. Girar"`,'qa-connector');
  };
  return `<div class="qa-circuit" data-left="${values.includes('left')}" data-right="${values.includes('right')}" data-connected="${connected}" role="group" aria-label="Circuito da bobina"><span><b aria-hidden="true">▰</b><small>Pilha</small></span>${turn('left','Esquerdo')}<span><b aria-hidden="true">〰</b><small>Bobina</small></span>${turn('right','Direito')}<span class="qa-bulb"><b aria-hidden="true">☼</b><small>Luz</small></span></div>
  <p class="qa-progress">${connected?'Linha completa':'Linha aberta'}</p><div class="qa-toolbar">${control(labels.coil[1],'check',undefined,'','f-primary')}</div>`;
}

function response(kind,outcome){
  const retry=kind==='skeleton'?'Tente o espaço com o mesmo formato.':'Experimente outro ajuste e teste de novo.';
  return {incorrect:retry,select:'Escolha uma peça primeiro.',changed:'O desafio foi atualizado em outra aba.'}[outcome];
}

function hintText(kind,round,selected){
  if(kind==='skeleton'&&round.hint===3){
    const piece=selected??pieceIds.find(id=>!round.value.includes(id));
    return `Experimente o espaço da peça ${pieces[piece].toLowerCase()}.`;
  }
  return hints[kind][round.hint-1];
}

export function announce(kind,{outcome,round,selected}){
  const status=response(kind,outcome);
  if(status)return status;
  if(outcome==='hint')return 'Pipo: '+hintText(kind,round,selected);
  if(outcome!=='updated')return '';
  if(kind==='valve')return `Pressão ${round.value}.`;
  if(kind==='coil')return round.value.length===2?'Linha completa.':'Linha aberta.';
  if(kind==='dig')return `${round.value.length} de 3 áreas limpas.`;
  return `${round.value.length} de 3 espaços preenchidos.`;
}

export function renderChallenge(place,kind,{round,selected,outcome},prefs){
  const {value,hint,done}=round;
  if(done)return `<p>Descoberta guardada ✓</p><div class="qa-toolbar">${control('Jogar de novo','start')}${control('Voltar ao mundo','return')}</div>`;
  let activity;
  if(kind==='melody'||kind==='commands')activity=order(kind,value,prefs.sound);
  else if(kind==='dig')activity=excavation(place.id,value);
  else if(kind==='skeleton')activity=skeleton(value,selected,hint);
  else if(kind==='valve')activity=valve(value);
  else activity=coil(value);

  const status=response(kind,outcome);
  return `<section class="qa-game"><p class="qa-instructions">${labels[kind][0]}</p>${activity}
    ${status?`<p class="qa-response">${status}</p>`:''}
    ${hint?`<p class="qa-hint"><strong>Pipo</strong> ${hintText(kind,round,selected)}</p>`:''}
    <div class="qa-toolbar qa-help">${control(hint?'Outra pista do Pipo':'Pista do Pipo','hint')}${control('Recomeçar','reset')}</div>
    <div class="qa-toolbar qa-prefs">${toggle('Som do desafio','sound',prefs.sound)}${toggle('Movimento reduzido','motion',prefs.still)}</div></section>`;
}
