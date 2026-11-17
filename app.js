"use strict";
const $=id=>document.getElementById(id);
const state={me:null,view:"child",date:"",month:"",events:[],holidays:{},selected:null,editing:null};
const DAYS=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const WD=["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
const REC={none:"Não repetir",daily:"Todos os dias",weekdays:"Segunda a sexta",weekly:"Dias da semana",monthly:"Mensal (mesmo dia)"};
const icons=["📚","🏫","🍎","🪥","🚽","🚿","🎮","⚽","🎒","💤","🧩","🩺","🎵","🏊","⭐","🧸"];
function esc(x){return String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function dateObj(s){const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}
function iso(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")}
function add(s,n){const d=dateObj(s);d.setDate(d.getDate()+n);return iso(d)}
function fmt(s,opts={weekday:"long",day:"numeric",month:"long"}){return dateObj(s).toLocaleDateString("pt-BR",opts)}
function alertMsg(msg){$("alert").textContent=msg;$("alert").hidden=!msg;if(msg)scrollTo({top:0,behavior:"smooth"})}
async function api(path,method="GET",body){
  const r=await fetch(path,{method,credentials:"same-origin",headers:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
  let j;try{j=await r.json()}catch(e){throw Error("Resposta inválida do servidor")}
  if(!r.ok)throw Error(j.error||"Não foi possível completar a ação");return j;
}
async function safe(fn){try{alertMsg("");await fn()}catch(e){alertMsg(e.message)}}
function nav(){const parent=state.view.startsWith("parent");$("childTab").classList.toggle("active",!parent);$("parentTab").classList.toggle("active",parent)}
function layout(html){$("content").innerHTML=html;nav()}
function dayEvents(date){return state.events.filter(e=>e.date===date)}
async function fetchCalendar(start,end){state.events=(await api("/api/calendar?start="+start+"&end="+end)).events;const years=[...new Set([start.slice(0,4),end.slice(0,4)])];state.holidays={};for(const y of years)Object.assign(state.holidays,(await api("/api/holidays?year="+y)).holidays)}
function holiday(iso){return state.holidays[iso]}
function tagHoliday(iso){const h=holiday(iso);return h?'<span class="tag holiday">🎉 '+esc(h.name)+' · '+esc(h.kind)+'</span>':""}
function eventHtml(e,admin=false){
 const controls=admin?'<div class="row"><button data-action="edit" data-id="'+e.id+'">Editar série</button><button data-action="skip" data-id="'+e.id+'" data-date="'+e.date+'">Excluir este dia</button><button class="danger" data-action="delete" data-id="'+e.id+'">Excluir série</button></div>':
 '<button class="'+(e.done?"":"primary")+'" data-action="done" data-id="'+e.id+'" data-date="'+e.date+'" data-done="'+e.done+'">'+(e.done?"↩ Desfazer":"✓ Consegui!")+'</button>';
 return '<article class="task '+(e.done?"done":"")+'"><span class="symbol">'+esc(e.icon)+'</span><div class="info"><div class="time">'+esc(e.time)+'</div><h3>'+esc(e.title)+'</h3>'+(e.notes?'<p class="sub small">'+esc(e.notes)+'</p>':"")+'<div class="row"><span class="tag">'+e.duration+' min</span>'+(e.done?'<span class="tag">Concluído ⭐</span>':"")+'</div></div>'+controls+'</article>';
}
async function child(){
 state.view="child";state.date=state.date||state.me.today;
 await fetchCalendar(state.date,state.date);
 const es=dayEvents(state.date),done=es.filter(e=>e.done).length;
 layout('<div class="hero"><div class="eyebrow">Meu painel de aventuras</div><h1>Bom dia, '+esc(state.me.name)+'! 👋</h1><p>Veja o que vai acontecer hoje. Uma coisa de cada vez!</p><div class="row"><span class="tag">📍 Florianópolis</span><span class="tag">🗓️ '+esc(fmt(state.date))+'</span>'+tagHoliday(state.date)+'</div></div>'+
 '<div class="grid" style="margin-top:17px"><div class="stat"><div class="sub">Atividades de hoje</div><strong>'+es.length+'</strong></div><div class="stat"><div class="sub">Missões feitas</div><strong>'+done+' / '+es.length+'</strong></div><div class="stat"><div class="sub">Próxima atividade</div><strong style="font-size:1.1rem">'+esc(es.find(e=>!e.done)?.title||"Tudo concluído! 🌟")+'</strong></div></div>'+
 '<section class="panel"><div class="row between"><h2>Minha agenda</h2><div class="row"><button data-action="childprev">←</button><input id="childDate" type="date" aria-label="Escolher dia" style="width:165px" value="'+state.date+'"><button data-action="childnext">→</button><button data-action="childtoday">Hoje</button></div></div>'+
 (es.length?es.map(e=>eventHtml(e)).join(""):'<div class="empty"><div class="symbol">🌈</div><h3>Nenhuma atividade cadastrada</h3><p class="sub">Um dia livre também pode ser uma ótima aventura!</p></div>')+'</section>'+
 '<p class="sub small">Você pode marcar uma etapa como feita. Se precisar de ajuda ou mudar o combinado, converse com seu responsável.</p>');
}
async function parentEntry(){
 const info=await api("/api/me");state.me=info;
 if(!info.configured){state.view="parent-login";layout('<div class="panel"><div class="eyebrow">Primeiro acesso</div><h1>Configurar responsável</h1><p>Crie uma senha de pelo menos 10 caracteres. A senha protege a edição da agenda neste computador.</p><form id="setupForm"><label for="password">Nova senha</label><input id="password" type="password" minlength="10" autocomplete="new-password" required><label for="repeat">Repetir senha</label><input id="repeat" type="password" minlength="10" autocomplete="new-password" required><div class="actions"><button type="submit" class="primary">Criar acesso</button></div></form><p class="sub small">Sem recuperação por e-mail nesta fase. Guarde a senha. Banco somente no computador local.</p></div>');return}
 if(!info.parent){state.view="parent-login";layout('<div class="panel"><div class="eyebrow">Acesso protegido</div><h1>Área do responsável 🔒</h1><form id="loginForm"><label for="password">Senha</label><input id="password" type="password" autocomplete="current-password" required><button type="submit" class="primary">Entrar</button></form></div>');return}
 await parentMonth();
}
async function parentMonth(){
 state.view="parent";state.month=state.month||state.me.today.slice(0,7);
 state.selected=state.selected||state.me.today;
 const first=state.month+"-01",start=add(first,-dateObj(first).getDay()),next=iso(new Date(dateObj(first).getFullYear(),dateObj(first).getMonth()+1,1));
 const end=add(next,6-dateObj(next).getDay());
 await fetchCalendar(start,end);
 const weeks=Array.from({length:7},(_,i)=>'<div class="day-head">'+DAYS[i]+'</div>').join("");
 let dates="";for(let d=start;d<=end;d=add(d,1)){
  const events=dayEvents(d),h=holiday(d);
  dates+='<button class="day '+(d.slice(0,7)!==state.month?"outside ":"")+(d===state.selected?"selected ":"")+(d===state.me.today?"today ":"")+'" data-action="selectday" data-date="'+d+'" aria-label="'+esc(fmt(d))+' — '+events.length+' atividades"><span class="num">'+Number(d.slice(8))+'</span>'+(h?'<span class="holiday-name">🎉 '+esc(h.name)+'</span>':"")+events.slice(0,3).map(e=>'<span class="dot '+(e.done?"done":"")+'">'+esc(e.time)+" "+esc(e.icon)+" "+esc(e.title)+'</span>').join("")+(events.length>3?'<span class="dot">+'+(events.length-3)+' mais</span>':"")+'</button>';
 }
 const selected=dayEvents(state.selected);
 layout('<div class="row between"><div><div class="eyebrow">Painel do responsável</div><h1>Calendário do Davi</h1></div><div class="actions"><button data-action="settings">⚙ Preferências</button><button data-action="logout">Sair 🔒</button></div></div>'+
 '<div class="panel"><div class="row between"><h2>'+esc(fmt(first,{month:"long",year:"numeric"}))+'</h2><div class="row"><button data-action="monthprev">← Mês anterior</button><button data-action="monthtoday">Hoje</button><button data-action="monthnext">Próximo mês →</button></div></div><div class="month">'+weeks+dates+'</div><p class="sub small">Feriados oficiais nacionais e municipais de Florianópolis aparecem destacados. Pontos facultativos não cancelam atividades automaticamente.</p></div>'+
 '<div class="panel"><div class="row between"><h2>'+esc(fmt(state.selected))+'</h2><button class="primary" data-action="new">＋ Cadastrar atividade</button></div>'+tagHoliday(state.selected)+(selected.length?selected.map(e=>eventHtml(e,true)).join(""):'<p class="sub">Nenhuma atividade neste dia.</p>')+'</div>');
}
async function edit(id){
 state.view="parent-edit";state.editing=id===null?null:(await api("/api/events")).events.find(e=>e.id===id);
 if(id!==null&&!state.editing)throw Error("Atividade não encontrada.");
 const e=state.editing||{title:"",time:"08:00",duration:30,icon:"⭐",notes:"",start_date:state.selected,end_date:"",recurrence:"none",weekdays:[],skip_weekends:false,skip_holidays:false};
 layout('<div class="row between"><h1>'+(id===null?"Cadastrar atividade":"Editar atividade")+'</h1><button data-action="calendar">← Calendário</button></div><form id="eventForm" class="panel"><div class="form-grid"><div><label for="title">Nome da atividade *</label><input id="title" required maxlength="100" value="'+esc(e.title)+'" placeholder="Ex.: Escola, futebol, escovar os dentes"></div><div><label for="icon">Ícone</label><select id="icon">'+[...new Set([e.icon,...icons])].map(x=>'<option value="'+esc(x)+'" '+(x===e.icon?"selected":"")+'>'+esc(x)+'</option>').join("")+'</select></div><div><label for="time">Horário *</label><input id="time" type="time" required value="'+esc(e.time)+'"></div><div><label for="duration">Duração estimada (min)</label><input id="duration" type="number" min="1" max="480" value="'+e.duration+'"></div><div><label for="start_date">Data inicial *</label><input id="start_date" type="date" required value="'+esc(e.start_date)+'"></div><div><label for="end_date">Repetir até (opcional)</label><input id="end_date" type="date" value="'+esc(e.end_date||"")+'"></div><div><label for="recurrence">Recorrência</label><select id="recurrence">'+Object.entries(REC).map(([k,v])=>'<option value="'+k+'" '+(k===e.recurrence?"selected":"")+'>'+v+'</option>').join("")+'</select></div></div><fieldset id="weeklyBox"><legend>Quais dias da semana?</legend><div class="weekdays">'+WD.map((d,i)=>'<label><input type="checkbox" name="weekday" value="'+i+'" '+(e.weekdays.includes(i)?"checked":"")+'>'+d+'</label>').join("")+'</div></fieldset><fieldset><legend>Regras da agenda</legend><label><input type="checkbox" id="skip_weekends" '+(e.skip_weekends?"checked":"")+'>Não ocorrer aos sábados e domingos</label><label><input type="checkbox" id="skip_holidays" '+(e.skip_holidays?"checked":"")+'>Não ocorrer em feriados nacionais ou municipais de Florianópolis</label><p class="sub small">A opção de feriados não inclui automaticamente Carnaval e pontos facultativos. Uma atividade semanal em sábado continua possível se a opção de pular fins de semana estiver desligada.</p></fieldset><label for="notes">Detalhes e orientação para Davi</label><textarea id="notes" maxlength="800" placeholder="Ex.: Separar mochila e ir com o responsável">'+esc(e.notes)+'</textarea><div class="actions"><button type="submit" class="primary">💾 Salvar atividade</button><button type="button" data-action="calendar">Cancelar</button></div></form>');
 toggleWeekly();
}
function toggleWeekly(){$("weeklyBox").hidden=$("recurrence").value!=="weekly"}
async function saveEvent(){
 const body={};for(const field of ["title","icon","time","duration","start_date","end_date","recurrence","notes"])body[field]=$(field).value;
 body.weekdays=[...document.querySelectorAll('input[name="weekday"]:checked')].map(x=>Number(x.value));
 body.skip_weekends=$("skip_weekends").checked;body.skip_holidays=$("skip_holidays").checked;
 if(state.editing){if(!confirm("Salvar mudanças para toda a série? As marcações e exclusões anteriores da série serão reiniciadas."))return;await api("/api/events/"+state.editing.id,"PUT",body)}
 else await api("/api/events","POST",body);
 state.month=body.start_date.slice(0,7);state.selected=body.start_date;await parentMonth();
}
async function settings(){
 state.view="parent-settings";layout('<div class="row between"><h1>Preferências</h1><button data-action="calendar">Voltar</button></div><form class="panel" id="settingsForm"><label for="name">Nome do jogador</label><input id="name" maxlength="35" required value="'+esc(state.me.name)+'"><button type="submit" class="primary">Salvar</button></form><div class="panel"><h2>Armazenamento local</h2><p>O banco está na pasta <code>dados/agenda.sqlite3</code> junto da aplicação. Para backup, feche o servidor e copie esse arquivo para um lugar seguro.</p><p class="sub">O acesso da criança está liberado somente neste computador; o modo responsável exige senha. Não exponha a porta na rede.</p></div>');
}
async function action(e){
 const b=e.target.closest("[data-action]");if(!b)return;
 const a=b.dataset.action,id=Number(b.dataset.id),day=b.dataset.date;
 await safe(async()=>{
 if(a==="childprev"){state.date=add(state.date,-1);await child()}
 else if(a==="childnext"){state.date=add(state.date,1);await child()}
 else if(a==="childtoday"){state.date=state.me.today;await child()}
 else if(a==="done"){if(b.dataset.done==="true")await api("/api/events/"+id+"/done?date="+day,"DELETE");else await api("/api/events/"+id+"/done","POST",{date:day});await child()}
 else if(a==="monthprev"||a==="monthnext"){const d=dateObj(state.month+"-01");d.setMonth(d.getMonth()+(a==="monthprev"?-1:1));state.month=iso(d).slice(0,7);state.selected=state.month+"-01";await parentMonth()}
 else if(a==="monthtoday"){state.selected=state.me.today;state.month=state.me.today.slice(0,7);await parentMonth()}
 else if(a==="selectday"){state.selected=day;state.month=day.slice(0,7);await parentMonth()}
 else if(a==="new")await edit(null);
 else if(a==="edit")await edit(id);
 else if(a==="calendar")await parentMonth();
 else if(a==="settings")await settings();
 else if(a==="logout"){await api("/api/logout","POST",{});await parentEntry()}
 else if(a==="delete"){if(confirm("Excluir esta atividade e TODAS as próximas repetições?")){await api("/api/events/"+id,"DELETE");await parentMonth()}}
 else if(a==="skip"){if(confirm("Remover apenas esta ocorrência de "+fmt(day)+"?")){await api("/api/events/"+id+"/skip","POST",{date:day});await parentMonth()}}
 });
}
document.addEventListener("click",action);
document.addEventListener("change",e=>{if(e.target.id==="recurrence")toggleWeekly();if(e.target.id==="childDate")safe(async()=>{state.date=e.target.value;await child()})});
document.addEventListener("submit",e=>{e.preventDefault();safe(async()=>{
 if(e.target.id==="eventForm")await saveEvent();
 else if(e.target.id==="setupForm"){const pw=$("password").value;if(pw!==$("repeat").value)throw Error("As senhas não coincidem.");await api("/api/setup","POST",{password:pw});await parentEntry()}
 else if(e.target.id==="loginForm"){await api("/api/login","POST",{password:$("password").value});await parentEntry()}
 else if(e.target.id==="settingsForm"){await api("/api/settings","PUT",{name:$("name").value});state.me=await api("/api/me");await parentMonth()}
})});
$("childTab").addEventListener("click",()=>safe(child));
$("parentTab").addEventListener("click",()=>safe(parentEntry));
$("brand").addEventListener("click",e=>{e.preventDefault();safe(child)});
safe(async()=>{state.me=await api("/api/me");state.date=state.me.today;state.month=state.me.today.slice(0,7);state.selected=state.date;await child()});
