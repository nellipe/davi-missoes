"use strict";
const $ = (id) => document.getElementById(id);
const state = {
  me: null,
  forestMode: null,
  view: "child",
  date: "",
  month: "",
  events: [],
  holidays: {},
  selected: null,
  editing: null,
};
const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WD = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const REC = {
  none: "Não repetir",
  daily: "Todos os dias",
  weekdays: "Segunda a sexta",
  weekly: "Dias da semana",
  monthly: "Mensal (mesmo dia)",
};
const icons = [
  "📚",
  "🏫",
  "🍎",
  "🪥",
  "🚽",
  "🚿",
  "🎮",
  "⚽",
  "🎒",
  "💤",
  "🧩",
  "🩺",
  "🎵",
  "🏊",
  "💊",
  "⭐",
  "🧸",
];
function esc(x) {
  return String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function dateObj(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function iso(d) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
function add(s, n) {
  const d = dateObj(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
function fmt(s, opts = { weekday: "long", day: "numeric", month: "long" }) {
  return dateObj(s).toLocaleDateString("pt-BR", opts);
}
function alertMsg(msg) {
  $("alert").textContent = msg;
  $("alert").hidden = !msg;
  if (msg) $("alert").scrollIntoView({ block: "nearest", behavior: "instant" });
}
async function api(path, method = "GET", body) {
  const r = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(state.me?.csrf ? { "X-CSRF-Token": state.me.csrf } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let j;
  try {
    j = await r.json();
  } catch (e) {
    throw Error("Resposta inválida do servidor");
  }
  if (!r.ok) throw Error(j.error || "Não foi possível completar a ação");
  return j;
}
let busy = false,
  actionFocus = null;
async function safe(fn) {
  if (busy) return;
  busy = true;
  $("content").setAttribute("aria-busy", "true");
  const trigger = document.activeElement;
  actionFocus = trigger;
  if (trigger?.tagName === "BUTTON") trigger.disabled = true;
  try {
    alertMsg("");
    await fn();
  } catch (e) {
    alertMsg(e.message);
  } finally {
    busy = false;
    $("content").removeAttribute("aria-busy");
    if (trigger?.isConnected) {
      trigger.disabled = false;
      if (document.activeElement === document.body)
        trigger.focus({ preventScroll: true });
    }
    actionFocus = null;
  }
}
function nav() {
  if (state.view !== 'child-game' && typeof DaviGame !== 'undefined') DaviGame.close();
  if (state.view !== 'child-world' && typeof DaviForest !== 'undefined') DaviForest.close();
  if (state.view !== 'child-world' && typeof DaviWorld !== 'undefined') DaviWorld.close();
  const parent = state.view.startsWith("parent");
  for (const [id, active] of [
    ["childTab", !parent],
    ["parentTab", parent],
  ]) {
    $(id).classList.toggle("active", active);
    $(id).setAttribute("aria-pressed", String(active));
  }
  document.body.classList.toggle("parent-view", parent);
}
function layout(html) {
  const old = actionFocus || document.activeElement,
    inside = $("content").contains(old);
  const key = inside
    ? {
        id: old.id,
        action: old.dataset.action,
        event: old.dataset.id,
        date: old.dataset.date,
        step: old.dataset.step,
        index: old.dataset.index,
        template: old.dataset.template,
        choice: old.dataset.choice,
      }
    : null;
  $("content").innerHTML = html;
  nav();
  if (inside) {
    const match = [
      ...$("content").querySelectorAll("button,input,select,textarea,a"),
    ].find((el) =>
      key.id
        ? el.id === key.id
        : key.action &&
          el.dataset.action === key.action &&
          el.dataset.id === key.event &&
          el.dataset.date === key.date &&
          el.dataset.step === key.step &&
          el.dataset.index === key.index &&
          el.dataset.template === key.template &&
          el.dataset.choice === key.choice,
    );
    (match || $("content")).focus({ preventScroll: true });
  }
}
function dayEvents(date) {
  return state.events.filter((e) => e.date === date);
}
async function fetchCalendar(start, end) {
  state.events = (
    await api("/api/calendar?start=" + start + "&end=" + end)
  ).events;
  const years = [...new Set([start.slice(0, 4), end.slice(0, 4)])];
  state.holidays = {};
  for (const y of years)
    Object.assign(
      state.holidays,
      (await api("/api/holidays?year=" + y)).holidays,
    );
}
function holiday(iso) {
  return state.holidays[iso];
}
function tagHoliday(iso) {
  const h = holiday(iso);
  return h
    ? '<span class="tag holiday">🎉 ' +
        esc(h.name) +
        " · " +
        esc(h.kind) +
        "</span>"
    : "";
}
// Visual hints only: no changes to API records or completion rules.
const CATEGORIES = {
  school: "Escola",
  health: "Saúde e terapias",
  sport: "Esportes",
  food: "Alimentação",
  hygiene: "Higiene",
  sleep: "Sono",
  medicine: "Medicação",
  other: "Outras",
};
function category(e) {
  const title = String(e.title || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const rules = [
    [
      "medicine",
      /\b(medicacao|medicamento|remedio|vitamina|comprimido|ferro\s+(?:em\s+)?gotas)\b/,
      ["💊"],
    ],
    [
      "health",
      /\b(terapia|terapeuta|psicolog[ao]|psicopedagog(?:[ao]|ia)|fono|fisioterapia|consulta|medic[ao]|dentista)\b/,
      ["🩺", "🧩"],
    ],
    ["sleep", /\b(dormir|sono|descanso|soneca)\b/, ["💤", "🌙", "🛏️"]],
    [
      "hygiene",
      /\b(banho|higiene|escovar|dentes|banheiro|lavar)\b/,
      ["🪥", "🚽", "🚿", "🧼"],
    ],
    [
      "food",
      /\b(cafe|almoco|jantar|lanche|refeicao|comer|alimentacao)\b/,
      ["🍎", "🍽️", "🥗"],
    ],
    [
      "sport",
      /\b(taekwondo|futsal|futebol|natacao|esporte|basquete|volei|corrida|karate|judo)\b/,
      ["⚽", "🏊", "🏀"],
    ],
    [
      "school",
      /\b(escola|aula|estudar|estudo|licao|mochila|leitura)\b/,
      ["📚", "🏫", "🎒"],
    ],
  ];
  // Title takes precedence over icon, which may be shared by different activities.
  return (
    rules.find(([, rx]) => rx.test(title))?.[0] ||
    rules.find(([, , xs]) => xs.includes(e.icon))?.[0] ||
    "other"
  );
}
function categoryTag(e) {
  const c = category(e);
  return (
    '<span class="tag category cat-' + c + '">' + CATEGORIES[c] + "</span>"
  );
}
function windowLabel(w) {
  if (!w) return '';
  const format=value=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
  return (w.state==='upcoming'?'Confirmação abre em ':w.state==='expired'?'Prazo encerrado. Janela: ':'Confirmação disponível: ')+format(w.opens_at)+' até '+format(w.closes_at)+'.';
}
function doneButton(e, featured = false) {
  return (
    '<button class="' +
    (!e.done && featured ? "primary" : "") +
    '" data-action="done" data-id="' +
    e.id +
    '" data-date="' +
    esc(e.date) +
    '" data-done="' +
    Boolean(e.done) +
    '" ' + (e.window && e.window.state!=='open' && !state.view.startsWith('parent')?'disabled ':'') + 'aria-label="' +
    (e.done ? "Desfazer conclusão: " : "Concluir: ") +
    esc(e.title) +
    '">' +
    (e.done ? "↩ Desfazer" : "✓ Consegui!") +
    "</button>"
  );
}
// Compare in the calendar's timezone, independently of the device timezone.
function calendarClock(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: parts.year + "-" + parts.month + "-" + parts.day,
    time: parts.hour + ":" + parts.minute,
  };
}
function eventPeriod(e, clock) {
  if (e.date < clock.date || (e.date === clock.date && e.time < clock.time))
    return "earlier";
  return e.date === clock.date && e.time === clock.time ? "now" : "later";
}
function dayPlan(events, clock = calendarClock()) {
  const pending = events.filter((e) => !e.done);
  return {
    next: pending.find((e) => eventPeriod(e, clock) !== "earlier"),
    earlier: pending.filter((e) => eventPeriod(e, clock) === "earlier"),
  };
}
function pendingLabel(e, clock) {
  return {
    earlier: "○ Pendente · Horário anterior",
    now: "○ Pendente · Neste horário",
    later: "○ Pendente · Programada para depois",
  }[eventPeriod(e, clock)];
}
function earlierNotice(count) {
  return count
    ? '<aside class="earlier-notice" aria-label="Pendências de horários anteriores"><div><strong>' +
        count +
        " " +
        (count === 1
          ? "atividade de horário anterior"
          : "atividades de horários anteriores") +
        '</strong><p>Continuam aqui. Combine com seu responsável o que fazer.</p></div><a id="earlierLink" href="#dailyAgenda">Ver na agenda ↓</a></aside>'
    : "";
}
function eventHtml(e, admin = false, clock = calendarClock()) {
  const controls = admin
    ? '<div class="row admin-actions">' + doneButton(e).replace('✓ Consegui!', 'Confirmar compromisso') + '<button data-action="mission-link" data-id="' + e.id + '" data-date="' + esc(e.date) + '">Roteiro e progresso</button><button data-action="edit" data-id="' +
      e.id +
      '">Editar série</button><button data-action="skip" data-id="' +
      e.id +
      '" data-date="' +
      esc(e.date) +
      '">Excluir este dia</button><button class="danger" data-action="delete" data-id="' +
      e.id +
      '">Excluir série</button></div>'
    : '<div class="task-actions">' + guidedButton(e) + doneButton(e) + '</div>';
  return (
    '<article class="task cat-' +
    category(e) +
    " " +
    (e.done ? "done" : "") +
    '"><div class="task-time"><time class="time">' +
    esc(e.time) +
    '</time><span class="small">' +
    esc(e.duration) +
    ' min</span></div><span class="symbol" aria-hidden="true">' +
    esc(e.icon || "⭐") +
    '</span><div class="info"><span class="state-label">' +
    (e.done ? "✓ Concluída" : admin ? "○ Pendente" : pendingLabel(e, clock)) +
    "</span><h3>" +
    esc(e.title) +
    "</h3>" +
    (e.notes ? '<p class="sub small">' + esc(e.notes) + "</p>" : "") +
    categoryTag(e) + (e.window?'<p class="small">'+esc(windowLabel(e.window))+'</p>':'') +
    "</div>" +
    controls +
    "</article>"
  );
}
function mascot() {
  return '<div class="landscape" aria-hidden="true"><span class="spark">✦</span><div class="block one"></div><div class="block two"></div><div class="block three"></div><div class="mascot"><div class="mascot-feet"></div><div class="mascot-body">✦</div><div class="mascot-head"></div></div></div>';
}
function nextMission(e, hasEvents, earlierCount = 0) {
  if (!e && earlierCount)
    return '<section class="panel mission empty"><span class="symbol" aria-hidden="true">🗓️</span><h2>Vamos rever o combinado?</h2><p>Não há próximos horários nesta data. As pendências de horários anteriores continuam na agenda.</p></section>';
  if (!e)
    return (
      '<section class="panel mission empty"><span class="symbol" aria-hidden="true">' +
      (hasEvents ? "🌟" : "🌤️") +
      "</span><h2>" +
      (hasEvents ? "Você fez cada etapa!" : "Um dia para explorar") +
      "</h2><p>" +
      (hasEvents
        ? "Cada pequeno passo conta. Agora, aproveite seu dia."
        : "Nenhuma atividade cadastrada para este dia. Combine sua aventura com o responsável.") +
      "</p></section>"
    );
  return (
    '<section class="panel mission cat-' +
    category(e) +
    '" aria-labelledby="nextTitle"><div class="mission-top"><span class="eyebrow">⚑ Próxima missão</span>' +
    categoryTag(e) +
    '</div><div class="mission-content"><span class="symbol" aria-hidden="true">' +
    esc(e.icon || "⭐") +
    '</span><div class="mission-detail"><time class="time">' +
    esc(e.time) +
    '</time> <span class="sub small">· ' +
    esc(e.duration) +
    ' min</span><h2 id="nextTitle">' +
    esc(e.title) +
    '</h2><p class="sub mission-description">' +
    esc(
      e.notes
        ? e.notes.length > 160
          ? e.notes.slice(0, 157) + "…"
          : e.notes
        : "Uma etapa de cada vez. Peça ajuda se precisar.",
    ) +
    "</p>" +
    (e.window?'<p>'+esc(windowLabel(e.window))+'</p>':'') + guidedButton(e) + doneButton(e, true) +
    "</div></div></section>"
  );
}
async function childNow() {
  const me=await api('/api/me');
  const {events}=await api('/api/calendar?start='+me.today+'&end='+me.today);
  const pending=events.filter(e=>!e.done);
  const available=pending.filter(e=>e.window?.state==='open');
  state.date=me.today;
  if(available.length===1 && available[0].has_mission){
    await openMission(available[0].id,me.today);
    return;
  }
  const upcoming=pending.find(e=>e.window?.state==='upcoming');
  const choices=available.length?available:upcoming?[upcoming]:[];
  state.view='child-now';
  layout('<button data-action="world-home">← Meu mundo</button><section class="panel"><h1>Agora</h1>'+
    (choices.length?choices.map(e=>eventHtml(e,false,calendarClock())).join(''):'<p>Dia livre. Não há atividade aberta.</p>')+
    '<button data-action="child-now-calendar">Ver agenda</button></section>');
}
async function child() {
  state.me = await api('/api/me');
  if (!state.me.authorized) {
    state.events = [];
    state.view = 'child-locked';
    layout('<section class="panel auth-panel"><h1>Vamos preparar sua aventura?</h1><p>Peça ao responsável para autorizar este aparelho. Ele gera um código nas preferências e ajuda você a digitá-lo aqui.</p><form id="pairForm"><label for="pairCode">Código de autorização</label><input id="pairCode" autocomplete="off" autocapitalize="none" spellcheck="false" required><button class="primary" type="submit">Autorizar aparelho</button></form><p>Ainda não há agenda disponível neste aparelho.</p></section>');
    return;
  }
  state.view = "child";
  state.date = state.date || state.me.today;
  await fetchCalendar(state.date, state.date);
  if (state.childSurface!=='calendar' && typeof DaviWorld!=='undefined') {
    state.view='child-world';
    if(!state.forestMode){try{state.forestMode=localStorage.getItem('davi-forest-mode')||'3d';}catch{state.forestMode='3d';}}
    if(state.forestMode!=='2d'){
      await DaviWorld.close();
      try{const forest=await import('/forest.js');const ready=await forest.open({layout,api,run:safe,missions:dayEvents(state.date),date:state.date,dateLabel:fmt(state.date),onMission:openMission,
        onCalendar:async()=>{state.childSurface='calendar';await child();},
        onFallback:async()=>{state.forestMode='2d';try{localStorage.setItem('davi-forest-mode','2d');}catch{}await child();}});if(ready)return;
      }catch(e){if(typeof DaviForest!=='undefined')await DaviForest.close();console.warn('Ilha 2D disponível:',e.message);}
    }
    if(typeof DaviForest!=='undefined') await DaviForest.close();
    await DaviWorld.open({layout,api,missions:dayEvents(state.date),date:state.date,dateLabel:fmt(state.date),onMission:openMission,
      onCalendar:async()=>{state.childSurface='calendar';await child();}});
    return;
  }
  renderChild();
}
function renderChild() {
  const clock = calendarClock();
  state.childPeriods = periodSignature(clock);
  const es = dayEvents(state.date),
    done = es.filter((e) => e.done).length,
    plan = dayPlan(es, clock),
    pct = es.length ? Math.round((done / es.length) * 100) : 0;
  layout(
    '<button data-action="world-home">← Meu mundo</button><div class="hero"><div class="hero-copy"><div class="eyebrow">Seu dia, uma grande aventura</div><h1>Olá, ' +
      esc(state.me.name) +
      '!</h1><p>Vamos dar um passo de cada vez?</p><div class="date-label">🗓 ' +
      esc(fmt(state.date)) +
      "</div></div>" +
      mascot() +
      "</div>" +
      tagHoliday(state.date) +
      '<div class="dashboard">' +
      nextMission(plan.next, es.length > 0, plan.earlier.length) +
      '<section class="panel progress-card" aria-labelledby="progressTitle"><div class="progress-heading"><h2 id="progressTitle">Suas conquistas</h2><span class="progress-icon" aria-hidden="true">✦</span></div><div class="progress-total">' +
      done +
      " <span>de " +
      es.length +
      ' concluídas</span></div><progress value="' +
      done +
      '" max="' +
      (es.length || 1) +
      '" aria-label="Atividades concluídas no dia: ' +
      done +
      " de " +
      es.length +
      '">' +
      pct +
      '%</progress><p class="progress-note">' +
      (done
        ? "Olha só o que você já fez! Cada passo conta."
        : "No seu ritmo. Cada pequeno passo conta.") +
      "</p></section></div>" +
      earlierNotice(plan.earlier.length) +
      '<section id="dailyAgenda" tabindex="-1" aria-labelledby="agendaTitle"><div class="section-heading"><div><div class="eyebrow">Seu caminho de hoje</div><h2 id="agendaTitle">Minha agenda <span class="tag">' +
      es.length +
      ' atividades</span></h2></div><div class="date-nav"><button data-action="childprev" aria-label="Dia anterior">←</button><input id="childDate" type="date" aria-label="Escolher dia" value="' +
      state.date +
      '"><button data-action="childnext" aria-label="Próximo dia">→</button><button data-action="childtoday">Hoje</button></div></div>' +
      (es.length
        ? '<ol class="task-list">' +
          es
            .map((e) => "<li>" + eventHtml(e, false, clock) + "</li>")
            .join("") +
          "</ol>"
        : '<p class="sub">Quando houver atividades, elas aparecerão aqui em ordem de horário.</p>') +
      '</section><p class="sub small">Se o combinado mudar, converse com seu responsável. Você pode pedir ajuda.</p>' +
      (state.me.simple_lan ? '' : '<button data-action="forget">Sair deste aparelho</button>'),
  );
}
async function parentEntry() {
  const info = await api("/api/me");
  state.me = info;
  if (!info.configured) {
    state.view = "parent-login";
    layout('<section class="panel auth-panel"><h1>Preparação do responsável</h1><p>O responsável precisa concluir a configuração inicial no computador que hospeda a agenda. Consulte o guia de publicação. Depois, atualize esta página.</p></section>');
    return;
  }
  if (!info.parent) {
    state.view = "parent-login";
    layout(
      '<div class="panel auth-panel"><div class="eyebrow">Acesso protegido</div><h1>Área do responsável 🔒</h1><form id="loginForm"><label for="password">Senha</label><input id="password" type="password" autocomplete="current-password" required><button type="submit" class="primary">Entrar</button></form></div>',
    );
    return;
  }
  await parentMonth();
}
async function parentMonth() {
  state.view = "parent";
  state.month = state.month || state.me.today.slice(0, 7);
  state.selected = state.selected || state.me.today;
  const first = state.month + "-01",
    start = add(first, -dateObj(first).getDay()),
    next = iso(
      new Date(dateObj(first).getFullYear(), dateObj(first).getMonth() + 1, 1),
    );
  const end = add(next, 6 - dateObj(next).getDay());
  await fetchCalendar(start, end);
  const weeks = Array.from(
    { length: 7 },
    (_, i) => '<div class="day-head">' + DAYS[i] + "</div>",
  ).join("");
  let dates = "";
  for (let d = start; d <= end; d = add(d, 1)) {
    const events = dayEvents(d),
      h = holiday(d);
    dates +=
      '<button class="day ' +
      (d.slice(0, 7) !== state.month ? "outside " : "") +
      (d === state.selected ? "selected " : "") +
      (d === state.me.today ? "today " : "") +
      (h ? "has-holiday " : "") +
      '" aria-pressed="' +
      (d === state.selected) +
      '" ' +
      (d === state.me.today ? 'aria-current="date" ' : "") +
      'data-action="selectday" data-date="' +
      d +
      '" aria-label="' +
      esc(fmt(d)) +
      " — " +
      events.length +
      " atividades" +
      (h ? " — Feriado: " + esc(h.name) : "") +
      '"><span class="num">' +
      Number(d.slice(8)) +
      "</span>" +
      '<span class="day-count">' +
      (events.length ? events.length + " ativ." : "") +
      "</span>" +
      (h
        ? '<span class="holiday-marker" aria-hidden="true">🎉</span><span class="holiday-name"> 🎉 ' +
          esc(h.name) +
          "</span>"
        : "") +
      events
        .slice(0, 3)
        .map(
          (e) =>
            '<span class="dot ' +
            (e.done ? "done" : "") +
            '">' +
            (e.done ? "✓ " : "") +
            esc(e.time) +
            " " +
            esc(e.icon) +
            " " +
            esc(e.title) +
            "</span>",
        )
        .join("") +
      (events.length > 3
        ? '<span class="dot">+' + (events.length - 3) + " mais</span>"
        : "") +
      "</button>";
  }
  const selected = dayEvents(state.selected);
  layout(
    '<div class="row between parent-title"><div><div class="eyebrow">Painel do responsável · versão ' + esc(state.me.version || 'anterior') + '</div><h1>Calendário do Davi</h1></div><div class="actions"><button data-action="world-settings">Mundo e estrelas</button><button data-action="mission-library">Roteiros de missões</button><button data-action="settings">⚙ Preferências</button><button data-action="logout">Sair 🔒</button></div></div>' +
      '<div class="panel calendar-panel"><div class="row between"><h2>' +
      esc(fmt(first, { month: "long", year: "numeric" })) +
      '</h2><div class="row calendar-controls"><button data-action="monthprev">← Mês anterior</button><button data-action="monthtoday">Hoje</button><button data-action="monthnext">Próximo mês →</button></div></div><div class="month">' +
      weeks +
      dates +
      '</div><div class="calendar-legend"><span>▣ Dia selecionado: borda azul</span><span>🎉 Feriado</span><span>✓ Atividade concluída</span></div><p class="sub small">Feriados oficiais nacionais e municipais de Florianópolis aparecem destacados. Pontos facultativos não cancelam atividades automaticamente.</p></div>' +
      '<div class="panel"><div class="row between"><h2>' +
      esc(fmt(state.selected)) +
      '</h2><button class="primary" data-action="new">＋ Cadastrar atividade</button></div>' +
      tagHoliday(state.selected) +
      (selected.length
        ? selected.map((e) => eventHtml(e, true)).join("")
        : '<p class="sub">Nenhuma atividade neste dia.</p>') +
      "</div>",
  );
}
async function edit(id) {
  state.view = "parent-edit";
  state.editing =
    id === null
      ? null
      : (await api("/api/events")).events.find((e) => e.id === id);
  if (id !== null && !state.editing) throw Error("Atividade não encontrada.");
  const e = state.editing || {
    title: "",
    time: "08:00",
    duration: 30,
    icon: "⭐",
    notes: "",
    start_date: state.selected,
    end_date: "",
    recurrence: "none",
    weekdays: [],
    skip_weekends: false,
    skip_holidays: false,
  };
  layout(
    '<div class="row between"><h1>' +
      (id === null ? "Cadastrar atividade" : "Editar atividade") +
      '</h1><button data-action="calendar">← Calendário</button></div><form id="eventForm" class="panel"><div class="form-grid"><div><label for="title">Nome da atividade *</label><input id="title" required maxlength="100" value="' +
      esc(e.title) +
      '" placeholder="Ex.: Escola, futebol, escovar os dentes"></div><div><label for="icon">Ícone</label><select id="icon">' +
      [...new Set([e.icon, ...icons])]
        .map(
          (x) =>
            '<option value="' +
            esc(x) +
            '" ' +
            (x === e.icon ? "selected" : "") +
            ">" +
            esc(x) +
            "</option>",
        )
        .join("") +
      '</select></div><div><label for="time">Horário *</label><input id="time" type="time" required value="' +
      esc(e.time) +
      '"></div><div><label for="duration">Duração estimada (min)</label><input id="duration" type="number" min="1" max="480" value="' +
      e.duration +
      '"></div><div><label for="start_date">Data inicial *</label><input id="start_date" type="date" required value="' +
      esc(e.start_date) +
      '"></div><div><label for="end_date">Repetir até (opcional)</label><input id="end_date" type="date" value="' +
      esc(e.end_date || "") +
      '"></div><div><label for="recurrence">Recorrência</label><select id="recurrence">' +
      Object.entries(REC)
        .map(
          ([k, v]) =>
            '<option value="' +
            k +
            '" ' +
            (k === e.recurrence ? "selected" : "") +
            ">" +
            v +
            "</option>",
        )
        .join("") +
      '</select></div></div><fieldset id="weeklyBox"><legend>Quais dias da semana?</legend><div class="weekdays">' +
      WD.map(
        (d, i) =>
          '<label><input type="checkbox" name="weekday" value="' +
          i +
          '" ' +
          (e.weekdays.includes(i) ? "checked" : "") +
          ">" +
          d +
          "</label>",
      ).join("") +
      '</div></fieldset><fieldset><legend>Regras da agenda</legend><label><input type="checkbox" id="skip_weekends" ' +
      (e.skip_weekends ? "checked" : "") +
      '>Não ocorrer aos sábados e domingos</label><label><input type="checkbox" id="skip_holidays" ' +
      (e.skip_holidays ? "checked" : "") +
      '>Não ocorrer em feriados nacionais ou municipais de Florianópolis</label><p class="sub small">A opção de feriados não inclui automaticamente Carnaval e pontos facultativos. Uma atividade semanal em sábado continua possível se a opção de pular fins de semana estiver desligada.</p></fieldset><label for="notes">Detalhes e orientação para Davi</label><textarea id="notes" maxlength="800" placeholder="Ex.: Separar mochila e ir com o responsável">' +
      esc(e.notes) +
      '</textarea><div class="actions"><button type="submit" class="primary">💾 Salvar atividade</button><button type="button" data-action="calendar">Cancelar</button></div></form>',
  );
  toggleWeekly();
}
function toggleWeekly() {
  $("weeklyBox").hidden = $("recurrence").value !== "weekly";
}
async function saveEvent() {
  const body = {};
  for (const field of [
    "title",
    "icon",
    "time",
    "duration",
    "start_date",
    "end_date",
    "recurrence",
    "notes",
  ])
    body[field] = $(field).value;
  body.weekdays = [
    ...document.querySelectorAll('input[name="weekday"]:checked'),
  ].map((x) => Number(x.value));
  body.skip_weekends = $("skip_weekends").checked;
  body.skip_holidays = $("skip_holidays").checked;
  if (state.editing) {
    if (
      !confirm(
        "Salvar mudanças para toda a série? As marcações e exclusões anteriores da série serão reiniciadas.",
      )
    )
      return;
    await api("/api/events/" + state.editing.id, "PUT", body);
  } else await api("/api/events", "POST", body);
  state.month = body.start_date.slice(0, 7);
  state.selected = body.start_date;
  await parentMonth();
}
const PHASES = {preparation: 'Preparação', main: 'Durante a atividade', return: 'Depois / retorno'};
function guidedButton(e) {
  return e.has_mission ? '<button class="primary" data-action="mission-open" data-id="' + e.id + '" data-date="' + esc(e.date) + '">▶ Entrar na missão</button>' : '';
}
async function missionLibrary() {
  state.view = 'parent-missions';
  const list = (await api('/api/missions')).templates;
  const history = (await api('/api/missions/history')).history;
  layout('<div class="row between"><h1>Roteiros de missões</h1><button data-action="calendar">← Calendário</button></div>' +
    '<p>Escolha um roteiro para adaptar. Depois, vincule-o a uma atividade no calendário. Nenhum compromisso recebe etapas automaticamente.</p>' +
    '<button class="primary" data-action="mission-new">Criar roteiro</button><div class="mission-library">' + list.map(t =>
      '<article class="panel"><h2>' + esc(t.icon) + ' ' + esc(t.name) + '</h2><p>' + t.step_count + ' etapas · versão ' + t.revision + (t.archived ? ' · Arquivado' : '') +
      '</p><button data-action="mission-edit" data-template="' + esc(t.id) + '">Editar roteiro</button></article>').join('') + '</div>' +
    '<section class="panel"><h2>Progresso por ocorrência</h2><p>Até 200 execuções recentes. Etapas confirmadas são relatos de execução real; não são pontos de jogo nem conclusão do compromisso.</p>' +
    (history.length ? '<ul class="mission-history">' + history.map(h => '<li><details><summary><strong>' + esc(h.mission.name) + '</strong> · ' + esc(fmt(h.date)) +
      ' · atividade #' + h.event_id + ' · versão ' + h.mission.revision + ' · ' + h.confirmed + '/' + h.mission.steps.length + ' etapas confirmadas</summary><ol>' + h.mission.steps.map(s => '<li>' + (s.done?'Confirmada: ':'Pendente: ') + esc(s.title) + ' — ' + esc(s.instruction) + '</li>').join('') + '</ol></details></li>').join('') + '</ul>' : '<p>Nenhuma missão iniciada.</p>') + '</section>');
}
async function missionEdit(id) {
  state.view = 'parent-mission-edit';
  state.missionDraft = id ? await api('/api/missions/' + encodeURIComponent(id)) : {name:'',icon:'⭐',steps:[{title:'',instruction:'',hint:'',icon:'⭐',phase:'main'}]};
  renderMissionEditor();
}
function renderMissionEditor() {
  const t = state.missionDraft;
  layout('<div class="row between"><h1>Editar roteiro</h1><button data-action="mission-library">← Roteiros</button></div>' +
    '<p>Edições valem para ocorrências ainda não iniciadas. Uma sequência já iniciada mantém a versão e o progresso anteriores.</p>' +
    '<form id="missionForm" class="panel"><label for="missionName">Nome do roteiro</label><input id="missionName" required maxlength="100" value="' + esc(t.name) +
    '"><label for="missionIcon">Ícone do roteiro</label><input id="missionIcon" required maxlength="12" value="' + esc(t.icon) + '">' +
    t.steps.map((s,i) => '<fieldset class="mission-step-editor"><legend>Etapa ' + (i+1) + '</legend><div class="form-grid"><div><label for="ms-title-' + i + '">Título</label><input id="ms-title-' + i + '" required maxlength="100" value="' + esc(s.title) +
      '"></div><div><label for="ms-icon-' + i + '">Ícone</label><input id="ms-icon-' + i + '" required maxlength="12" value="' + esc(s.icon) + '"></div></div><label for="ms-instruction-' + i + '">Orientação concreta</label><textarea id="ms-instruction-' + i + '" required maxlength="600">' + esc(s.instruction) +
      '</textarea><label for="ms-hint-' + i + '">Dica opcional</label><textarea id="ms-hint-' + i + '" maxlength="400">' + esc(s.hint) + '</textarea><label for="ms-phase-' + i + '">Fase</label><select id="ms-phase-' + i + '">' + Object.entries(PHASES).map(([k,v]) => '<option value="' + k + '" ' + (s.phase===k?'selected':'') + '>' + v + '</option>').join('') +
      '</select><div class="actions"><button type="button" data-action="mission-up" data-index="' + i + '" ' + (i===0?'disabled':'') + '>Subir etapa ' + (i+1) + '</button><button type="button" data-action="mission-down" data-index="' + i + '" ' + (i===t.steps.length-1?'disabled':'') + '>Descer etapa ' + (i+1) + '</button><button type="button" data-action="mission-remove" data-index="' + i + '" ' + (t.steps.length===1?'disabled':'') + '>Remover etapa ' + (i+1) + '</button></div></fieldset>').join('') +
    '<div class="actions"><button type="button" data-action="mission-add" ' + (t.steps.length>=40?'disabled':'') + '>Adicionar etapa</button><button type="submit" class="primary">Salvar roteiro</button></div></form>' +
    (t.id ? '<button class="danger" data-action="mission-archive">' + (t.archived?'Reativar roteiro':'Arquivar roteiro') + '</button><p class="sub">Arquivar impede novos vínculos e conserva vínculos e histórico existentes.</p>' : ''));
}
function readMissionDraft() {
  const t = state.missionDraft;
  t.name = $('missionName').value;
  t.icon = $('missionIcon').value;
  t.steps = t.steps.map((s,i) => ({...s, ...Object.fromEntries(['title','icon','instruction','hint','phase'].map(k => [k, $('ms-' + k + '-' + i).value]))}));
}
async function missionLink(id, date) {
  state.view = 'parent-mission-link';
  state.missionEvent = {id,date};
  const links = await api('/api/events/' + id + '/mission');
  const list = (await api('/api/missions')).templates;
  const series = links.links.find(l => !l.date)?.template_id;
  const override = links.links.find(l => l.date===date);
  state.missionLinks = {series, override};
  const occurrence = (await api('/api/events/' + id + '/mission?date=' + date)).mission;
  layout('<div class="row between"><h1>Roteiro de ' + esc(links.title) + '</h1><button data-action="calendar">← Calendário</button></div><form id="missionLinkForm" class="panel"><label for="missionScope">Aplicar a</label><select id="missionScope"><option value="">Toda a série</option><option value="' + esc(date) + '">Somente ' + esc(fmt(date)) +
    '</option></select><label for="missionTemplate">Roteiro</label><select id="missionTemplate"><option value="">Sem roteiro</option>' + list.filter(t => !t.archived || t.id===series || t.id===override?.template_id).map(t => '<option value="' + esc(t.id) + '" ' + (t.id===series?'selected':'') + '>' + esc(t.name) + (t.archived?' (arquivado)':'') + '</option>').join('') +
    '</select><p>Roteiro da série: ' + esc(list.find(t=>t.id===series)?.name || 'Nenhum') + '. Exceção deste dia: ' + esc(override ? list.find(t=>t.id===override.template_id)?.name || 'Sem roteiro' : 'Usa a série') +
    '.</p><p>Alterar o vínculo não apaga progresso já iniciado. Sem roteiro mantém a agenda e o botão de conclusão habituais.</p><button type="submit" class="primary">Salvar vínculo</button><button type="button" data-action="mission-inherit">Remover exceção deste dia</button></form>' +
    (occurrence ? '<section class="panel"><h2>Ocorrência de ' + esc(fmt(date)) + '</h2><p>' + esc(occurrence.name) + ' · versão ' + occurrence.revision + ' · ' + occurrence.confirmed + '/' + occurrence.total + ' etapas confirmadas' + (occurrence.started?' · Versão preservada':' · Ainda não iniciada') + '</p><button data-action="mission-open" data-id="' + id + '" data-date="' + date + '">Ver passos e progresso</button></section>' : ''));
}
async function openMission(id,date) {
  const parent = state.view.startsWith('parent');
  const data = await api('/api/events/' + id + '/mission?date=' + date);
  if (!data.mission) throw Error('Esta ocorrência não tem roteiro. Volte à agenda.');
  if (!parent) {
    state.view='child-game';
    DaviGame.open({mission:data.mission,title:data.title,dateLabel:fmt(date),layout,api,
      onPractice:session=>{state.practiceSessions=[...(state.practiceSessions || []),session].slice(-10);},
      onExit:async()=>{state.childSurface='world';await child();}});
    return;
  }
  state.view = parent ? 'parent-mission-progress' : 'child-mission-progress';
  state.activeMission = data.mission;
  renderMissionProgress(data.title);
}
function renderMissionProgress(title) {
  const m=state.activeMission;
  state.missionTitle=title;
  layout('<div class="row between"><div><div class="eyebrow">Passos para a vida real</div><h1>' + esc(title) + '</h1><p>' + esc(fmt(m.date)) + '</p></div><button data-action="' + (state.view.startsWith('parent')?'calendar':'mission-back') + '">← Agenda</button></div>' +
    '<section class="panel"><h2>' + esc(m.icon) + ' ' + esc(m.name) + '</h2><p>' + m.confirmed + ' de ' + m.total + ' etapas confirmadas' + (state.view.startsWith('parent')?' · versão ' + m.revision:'') + '</p><progress value="' + m.confirmed + '" max="' + m.total + '" aria-label="Etapas confirmadas"></progress>' +
    '<p>Veja o combinado e faça fora da tela. Confirme uma etapa apenas depois de realizá-la. Você pode pedir ajuda ao responsável e voltar mais tarde.</p><p class="sub">Confirmar ou desfazer passos não altera estrelas. A conclusão do compromisso é separada e pode ser corrigida na agenda. Para revogar estrelas, use Mundo e estrelas.</p><ol class="guided-steps">' +
    m.steps.map(s => '<li class="guided-step"><span class="tag">' + PHASES[s.phase] + '</span><h3>' + esc(s.icon) + ' ' + esc(s.title) + '</h3><p>' + esc(s.instruction) + '</p>' + (s.hint?'<details><summary>Ver dica</summary><p>' + esc(s.hint) + '</p></details>':'') +
      '<button data-action="mission-confirm" data-step="' + esc(s.id) + '" aria-pressed="' + s.done + '">' + (s.done?'Desfazer confirmação':'Fiz esta etapa') + '</button></li>').join('') + '</ol></section>');
}
async function missionAction(a,b) {
  if (a==='mission-library') await missionLibrary();
  else if (a==='mission-new') await missionEdit(null);
  else if (a==='mission-edit') await missionEdit(b.dataset.template);
  else if (a==='mission-link') await missionLink(Number(b.dataset.id),b.dataset.date);
  else if (a==='mission-open') await openMission(Number(b.dataset.id),b.dataset.date);
  else if (a==='mission-back') await child();
  else if (a==='mission-confirm') {
    const m=state.activeMission, s=m.steps.find(s=>s.id===b.dataset.step);
    state.activeMission=await api('/api/events/' + m.event_id + '/mission/steps/' + encodeURIComponent(s.id),'PUT',{date:m.date,template_id:m.id,revision:m.revision,done:!s.done});
    renderMissionProgress(state.missionTitle);
    $('status').textContent=state.activeMission.correction || (s.done?'Confirmação desfeita.':'Etapa confirmada. Volte à atividade fora da tela.');
  } else if (a==='mission-inherit') {
    const {id,date}=state.missionEvent;
    await api('/api/events/' + id + '/mission?date=' + date,'DELETE');
    await missionLink(id,date);
  } else if (a==='mission-archive') {
    const t=state.missionDraft;
    if (!confirm(t.archived?'Reativar este roteiro?':'Arquivar sem apagar vínculos e progresso?')) return;
    await api('/api/missions/' + t.id + '/archive','PUT',{archived:!t.archived,revision:t.revision});
    await missionLibrary();
  } else {
    readMissionDraft();
    const t=state.missionDraft, i=Number(b.dataset.index);
    if (a==='mission-add' && t.steps.length<40) t.steps.push({title:'',instruction:'',hint:'',icon:'⭐',phase:'main'});
    if (a==='mission-remove' && t.steps.length>1) t.steps.splice(i,1);
    if (a==='mission-up' && i>0) [t.steps[i-1],t.steps[i]]=[t.steps[i],t.steps[i-1]];
    if (a==='mission-down' && i<t.steps.length-1) [t.steps[i+1],t.steps[i]]=[t.steps[i],t.steps[i+1]];
    renderMissionEditor();
  }
}
async function worldSettings() {
  state.view='parent-world-settings';
  state.worldConfig=await api('/api/world/config');
  const config=state.worldConfig;
  layout('<div class="row between"><h1>Mundo e estrelas</h1><button data-action="calendar">← Calendário</button></div><p>Estrelas reconhecem esforço e prática. Cuidados essenciais continuam independentes de recompensas. Saldo atual: '+config.world.stars+' estrelas.</p><details><summary>Ajustar recompensas e preços</summary><form id="worldSettingsForm" class="panel"><div class="form-grid">'+
    [['learn','Aprender (por ocorrência)'],['memory','Cada minigame (por ocorrência)'],['real','Esforço em Fazer (rotinas elegíveis)'],['daily_limit','Máximo de estrelas por dia']].map(([key,label])=>'<div><label for="reward-'+key+'">'+label+'</label><input id="reward-'+key+'" type="number" min="0" max="'+(key==='daily_limit'?100:10)+'" required value="'+config.settings[key]+'"></div>').join('')+
    '</div><p>Zero desativa a concessão. Repetir, editar ou desfazer não gera estrelas extras. Fazer só recompensa roteiros originais de preparação/organização elegíveis; medicação e higiene essencial ficam excluídas.</p>'+config.world.catalog.map(i=>'<fieldset><legend>'+esc(i.name)+'</legend><label><input type="checkbox" id="available-'+i.id+'" '+(i.available?'checked':'')+'>Disponível na oficina</label><label for="price-'+i.id+'">Preço em estrelas</label><input type="number" id="price-'+i.id+'" min="0" max="100" required value="'+i.price+'"><span>'+(i.removed?'Adquirido · removido':i.owned?'Já adquirido':'Ainda não adquirido')+'</span></fieldset>').join('')+
    '<button type="submit" class="primary">Salvar combinados</button></form></details><section class="panel"><h2>Itens adquiridos</h2><p>Remover oculta o item e seus acessórios sem devolver estrelas. Reativar não cobra novamente.</p>'+config.inventory.map(i=>'<p>'+esc(config.world.catalog.find(c=>c.id===i.item_id).name)+' · '+(i.active?'Ativo':'Removido')+' <button data-action="parent-inventory" data-item="'+i.item_id+'" data-active="'+!i.active+'">'+(i.active?'Remover':'Reativar')+'</button></p>').join('')+'</section><section class="panel"><h2>Histórico de estrelas e conquistas</h2><p>Revogar preserva o registro e impede novo crédito pela mesma atividade, data e modalidade. Saldo negativo bloqueia compras até recompor; nenhum item é retirado automaticamente. Passos e conclusão são corrigidos separadamente no calendário.</p>'+ (config.history.length?'<ul>'+config.history.map(h=>'<li><p>'+esc(h.created)+' (UTC) · '+esc(h.label)+' · '+(h.delta>0?'+':'')+h.delta+' estrelas'+(h.context.activity?' · '+esc(h.context.activity)+' · '+esc(h.context.date)+' · '+esc(({learn:'Aprender',order:'Trilha da memória',bag:'O que vai na bolsa?',real:'Fazer'})[h.context.mode] || h.context.mode):'')+(h.context.reason?' · Motivo: '+esc(h.context.reason):'')+' · '+(h.context.item_state || (h.revoked?'Revogada':h.id.startsWith('award:')?'Registrada':'Ajuste registrado'))+'</p>'+(h.id.startsWith('award:')&&h.delta>0&&!h.revoked?'<button data-action="parent-revoke" data-credit="'+esc(h.id)+'">Revogar esta concessão</button>':'')+'</li>').join('')+'</ul>':'<p>Nenhum registro.</p>')+'</section>');
}
async function settings() {
  state.view = "parent-settings";
  const schedule=await api('/api/schedule/config');
  const devices = state.me.simple_lan
    ? '<p class="sub">Qualquer aparelho da rede doméstica 192.168.2.0/24 pode consultar a agenda e marcar atividades. A área do responsável continua exigindo senha.</p>'
    : '<p class="sub">Cada aparelho infantil precisa de autorização. O código vale por 10 minutos e só pode ser usado uma vez.</p><button data-action="pair-code">Gerar código para aparelho infantil</button><p id="pairResult" role="status"></p><button data-action="revoke-children">Revogar todos os aparelhos infantis</button>';
  layout(
    '<div class="row between"><h1>Preferências</h1><button data-action="calendar">Voltar</button></div><form class="panel" id="settingsForm"><label for="name">Nome do jogador</label><input id="name" maxlength="35" required value="' +
      esc(state.me.name) +
      '"><button type="submit" class="primary">Salvar</button></form><form id="scheduleForm" class="panel"><h2>Horário de confirmação</h2><p>A confirmação e o desfazer abrem no horário marcado e fecham após a duração mais a tolerância. O responsável pode corrigir a qualquer hora, sem estrelas automáticas.</p><label for="afterMinutes">Tolerância após a duração (minutos)</label><input id="afterMinutes" type="number" min="0" max="240" required value="'+schedule.after_minutes+'"><button type="submit">Salvar tolerância</button></form><div class="panel"><h2>Armazenamento local</h2><p>O banco está na pasta <code>dados/agenda.sqlite3</code> junto da aplicação. Os backups consistentes são administrados no computador que hospeda a agenda.</p>' + devices + '</div>',
  );
}
async function action(e) {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const a = b.dataset.action,
    id = Number(b.dataset.id),
    day = b.dataset.date;
  await safe(async () => {
    if (a==='child-now') await childNow();
    else if (a==='child-now-calendar'){state.childSurface='calendar';await child();}
    else if (a==='world-home') {state.childSurface='world';await child();}
    else if(a.startsWith('forest-')) await DaviForest.action(a,b);
    else if(a==='world-forest'){state.forestMode='3d';try{localStorage.setItem('davi-forest-mode','3d');}catch{}await child();}
    else if (a==='world-settings') await worldSettings();
    else if (a==='parent-revoke') {
      const h=state.worldConfig.history.find(h=>h.id===b.dataset.credit);
      const reason=prompt('Motivo da revogação (opcional):','');
      if (reason===null || !confirm('Revogar '+h.delta+' estrela(s) de '+(h.context.activity || h.label)+'? O histórico será preservado. Se o saldo ficar negativo, novas compras ficam bloqueadas até recompor.')) return;
      await api('/api/world/revoke','POST',{id:h.id,reason});await worldSettings();
    } else if (a==='parent-inventory') {
      const active=b.dataset.active==='true';
      if (!confirm((active?'Reativar':'Remover')+' este item? Sem estorno e sem nova cobrança. O responsável pode reativar depois.')) return;
      await api('/api/world/inventory','PUT',{item_id:b.dataset.item,active});await worldSettings();
    }
    else if (a.startsWith('world-')) await DaviWorld.action(a,b);
    else if (a.startsWith('game-')) { await DaviGame.action(a,b); }
    else if (a.startsWith('mission-')) { await missionAction(a,b); }
    else if (a === "pair-code") {
      const result = await api('/api/devices/code', 'POST', {});
      $('pairResult').textContent = 'Código: ' + result.code + ' · válido por 10 minutos. Digite no aparelho infantil.';
    } else if (a === "revoke-children") {
      if (confirm('Revogar todos os aparelhos infantis?')) {
        await api('/api/devices/revoke', 'POST', {});
        $('pairResult').textContent = 'Aparelhos revogados.';
      }
    } else if (a === "forget") {
      await api('/api/logout', 'POST', {});
      await child();
    } else if (a === "childprev") {
      state.date = add(state.date, -1);
      await child();
    } else if (a === "childnext") {
      state.date = add(state.date, 1);
      await child();
    } else if (a === "childtoday") {
      state.date = state.me.today;
      await child();
    } else if (a === "done") {
      if (b.dataset.done === "true")
        await api("/api/events/" + id + "/done?date=" + day, "DELETE");
      else await api("/api/events/" + id + "/done", "POST", { date: day });
      if (state.view.startsWith('parent')) await parentMonth(); else await child();
      $("status").textContent =
        b.dataset.done === "true"
          ? "Conclusão desfeita."
          : "Etapa concluída. Cada passo conta!";
    } else if (a === "monthprev" || a === "monthnext") {
      const d = dateObj(state.month + "-01");
      d.setMonth(d.getMonth() + (a === "monthprev" ? -1 : 1));
      state.month = iso(d).slice(0, 7);
      state.selected = state.month + "-01";
      await parentMonth();
    } else if (a === "monthtoday") {
      state.selected = state.me.today;
      state.month = state.me.today.slice(0, 7);
      await parentMonth();
    } else if (a === "selectday") {
      state.selected = day;
      state.month = day.slice(0, 7);
      await parentMonth();
    } else if (a === "new") await edit(null);
    else if (a === "edit") await edit(id);
    else if (a === "calendar") await parentMonth();
    else if (a === "settings") await settings();
    else if (a === "logout") {
      await api("/api/logout", "POST", {});
      state.events = [];
      await parentEntry();
    } else if (a === "delete") {
      if (confirm("Excluir esta atividade e TODAS as próximas repetições?")) {
        await api("/api/events/" + id, "DELETE");
        await parentMonth();
      }
    } else if (a === "skip") {
      if (confirm("Remover apenas esta ocorrência de " + fmt(day) + "?")) {
        await api("/api/events/" + id + "/skip", "POST", { date: day });
        await parentMonth();
      }
    }
  });
}
document.addEventListener("click", action);
document.addEventListener("change", (e) => {
  if (e.target.id === "recurrence") toggleWeekly();
  if (e.target.id === 'missionScope') {
    const {series,override}=state.missionLinks;
    $('missionTemplate').value=(e.target.value ? (override ? override.template_id : series) : series) || '';
  }
  if (e.target.id === "childDate")
    safe(async () => {
      if (e.target.value) {
        state.date = e.target.value;
        await child();
      }
    });
});
document.addEventListener("submit", (e) => {
  e.preventDefault();
  safe(async () => {
    if (e.target.id === 'scheduleForm') {
      await api('/api/schedule/config','PUT',{after_minutes:Number($('afterMinutes').value)});await settings();
    } else if (e.target.id === 'worldSettingsForm') {
      const body=Object.fromEntries(['learn','memory','real','daily_limit'].map(k=>[k,Number($('reward-'+k).value)]));
      body.catalog=state.worldConfig.world.catalog.map(i=>({id:i.id,price:Number($('price-'+i.id).value),available:$('available-'+i.id).checked}));
      await api('/api/world/config','PUT',body);await parentMonth();
    } else if (e.target.id === 'missionForm') {
      readMissionDraft();
      const t=state.missionDraft;
      await api('/api/missions' + (t.id?'/' + t.id:''),t.id?'PUT':'POST',t);
      await missionLibrary();
    } else if (e.target.id === 'missionLinkForm') {
      const {id,date}=state.missionEvent;
      await api('/api/events/' + id + '/mission','PUT',{date:$('missionScope').value,template_id:$('missionTemplate').value || null});
      await missionLink(id,date);
    } else if (e.target.id === 'pairForm') {
      await api('/api/pair', 'POST', {code: $('pairCode').value.trim()});
      await child();
    } else if (e.target.id === "eventForm") await saveEvent();
    else if (e.target.id === "loginForm") {
      await api("/api/login", "POST", { password: $("password").value });
      await parentEntry();
    } else if (e.target.id === "settingsForm") {
      await api("/api/settings", "PUT", { name: $("name").value });
      state.me = await api("/api/me");
      await parentMonth();
    }
  });
});
$("childTab").addEventListener("click", () => safe(child));
$("parentTab").addEventListener("click", () => safe(parentEntry));
$("brand").addEventListener("click", (e) => {
  e.preventDefault();
  safe(child);
});
// Refresh only when an activity changes time group; preserve focus and avoid needless renders.
function periodSignature(clock) {
  return JSON.stringify(
    dayEvents(state.date).map((e) => [
      e.id,
      e.done ? "done" : eventPeriod(e, clock),
    ]),
  );
}
function refreshChildClock() {
  if (
    !document.hidden &&
    state.view === "child" &&
    state.me &&
    !busy &&
    state.childPeriods !== periodSignature(calendarClock())
  )
    renderChild();
}

safe(async () => {
  state.me = await api("/api/me");
  state.date = state.me.today;
  state.month = state.me.today.slice(0, 7);
  state.selected = state.date;
  await child();
});

setInterval(refreshChildClock, 60000);
document.addEventListener("visibilitychange", refreshChildClock);
