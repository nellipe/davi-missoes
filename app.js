"use strict";
const $ = (id) => document.getElementById(id);
const state = {
  me: null,
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
          el.dataset.date === key.date,
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
    '" aria-label="' +
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
    ? '<div class="row admin-actions"><button data-action="edit" data-id="' +
      e.id +
      '">Editar série</button><button data-action="skip" data-id="' +
      e.id +
      '" data-date="' +
      esc(e.date) +
      '">Excluir este dia</button><button class="danger" data-action="delete" data-id="' +
      e.id +
      '">Excluir série</button></div>'
    : doneButton(e);
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
    categoryTag(e) +
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
    doneButton(e, true) +
    "</div></div></section>"
  );
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
    '<div class="hero"><div class="hero-copy"><div class="eyebrow">Seu dia, uma grande aventura</div><h1>Olá, ' +
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
    '<div class="row between parent-title"><div><div class="eyebrow">Painel do responsável</div><h1>Calendário do Davi</h1></div><div class="actions"><button data-action="settings">⚙ Preferências</button><button data-action="logout">Sair 🔒</button></div></div>' +
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
async function settings() {
  state.view = "parent-settings";
  const devices = state.me.simple_lan
    ? '<p class="sub">Qualquer aparelho da rede doméstica 192.168.2.0/24 pode consultar a agenda e marcar atividades. A área do responsável continua exigindo senha.</p>'
    : '<p class="sub">Cada aparelho infantil precisa de autorização. O código vale por 10 minutos e só pode ser usado uma vez.</p><button data-action="pair-code">Gerar código para aparelho infantil</button><p id="pairResult" role="status"></p><button data-action="revoke-children">Revogar todos os aparelhos infantis</button>';
  layout(
    '<div class="row between"><h1>Preferências</h1><button data-action="calendar">Voltar</button></div><form class="panel" id="settingsForm"><label for="name">Nome do jogador</label><input id="name" maxlength="35" required value="' +
      esc(state.me.name) +
      '"><button type="submit" class="primary">Salvar</button></form><div class="panel"><h2>Armazenamento local</h2><p>O banco está na pasta <code>dados/agenda.sqlite3</code> junto da aplicação. Os backups consistentes são administrados no computador que hospeda a agenda.</p>' + devices + '</div>',
  );
}
async function action(e) {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const a = b.dataset.action,
    id = Number(b.dataset.id),
    day = b.dataset.date;
  await safe(async () => {
    if (a === "pair-code") {
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
      await child();
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
    if (e.target.id === 'pairForm') {
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
