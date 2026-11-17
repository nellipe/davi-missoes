const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const fullSource = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
// Omit only startup networking; exercise the production functions in a DOM stub.
const source = fullSource.slice(0, fullSource.lastIndexOf("\nsafe("));
function app(events = []) {
  const nodes = {};
  const writes = [];
  const get = (id) =>
    (nodes[id] ??= {
      innerHTML: "",
      textContent: "",
      hidden: false,
      classList: { toggle() {} },
      setAttribute() {},
      removeAttribute() {},
      addEventListener() {},
      contains() {
        return false;
      },
      focus() {},
    });
  const context = vm.createContext({
    document: {
      getElementById: get,
      addEventListener() {},
      body: { classList: { toggle() {} } },
    },
    fetch: async (url, options) => {
      if (options.method !== "GET") writes.push(url);
      return {
        ok: true,
        json: async () =>
          url.includes("/calendar")
            ? { events }
            : url.includes("/holidays")
              ? { holidays: {} }
              : {},
      };
    },
  });
  vm.runInContext(source, context);
  vm.runInContext(
    'calendarClock = () => ({date:"2026-11-17",time:"10:00"})',
    context,
  );
  return { run: (code) => vm.runInContext(code, context), nodes, writes };
}
test("visual categories: all groups, accents, title priority and safe fallback", () => {
  const a = app();
  for (const [title, icon, expected] of [
    ["Escola", "⭐", "school"],
    ["Terapia", "⭐", "health"],
    ["Natação", "⭐", "sport"],
    ["Almoço", "⭐", "food"],
    ["Escovar dentes", "⭐", "hygiene"],
    ["Sono", "⭐", "sleep"],
    ["Medicação", "📚", "medicine"],
    ["Atividade livre", "🏫", "school"],
    ["Desconhecida", "🛸", "other"],
    ["", "", "other"],
  ]) {
    assert.equal(
      a.run(`category(${JSON.stringify({ title, icon })})`),
      expected,
    );
  }
});
test("user text is escaped in featured card and its accessible control", () => {
  const a = app();
  const html = a.run(
    `nextMission({id:1,date:'2026-11-17',title:'<img src=x>',notes:'<script>alert(1)</script>',icon:'⭐',time:'08:00',duration:30,done:false},true)`,
  );
  assert(!html.includes("<img"));
  assert(!html.includes("<script>"));
  assert(html.includes("&lt;img"));
});
test("featured description stays short while the full agenda keeps original text", () => {
  const a = app();
  a.run(
    `state.testEvent={id:1,title:'Teste',notes:'a'.repeat(800),icon:'⭐',time:'08:00',duration:30,date:'2026-11-17',done:false}`,
  );
  assert(!a.run("nextMission(state.testEvent,true)").includes("a".repeat(161)));
  assert(a.run("eventHtml(state.testEvent)").includes("a".repeat(800)));
});
test("earlier pendencies remain visible without replacing the next scheduled activity", async () => {
  const events = [
    {
      id: 1,
      date: "2026-11-17",
      time: "07:00",
      title: "Medicação de exemplo",
      done: false,
    },
    {
      id: 2,
      date: "2026-11-17",
      time: "12:00",
      title: "Oficina de exemplo",
      done: false,
    },
    {
      id: 3,
      date: "2026-11-17",
      time: "08:00",
      title: "Leitura de exemplo",
      done: true,
    },
  ];
  const a = app(events);
  a.run(`state.me={name:'Explorador',today:'2026-11-17'}`);
  await a.run("child()");
  const html = a.nodes.content.innerHTML;
  assert(html.includes('id="nextTitle">Oficina de exemplo'));
  assert(html.includes("1 atividade de horário anterior"));
  assert(html.includes("Pendente · Horário anterior"));
  assert(html.includes("Pendente · Programada para depois"));
  assert(html.includes("Medicação de exemplo"));
  assert(html.includes('value="1" max="3"'));
  assert.equal(a.writes.length, 0);
  assert.equal(events[0].done, false);
});
test("when only earlier pendencies remain, show review guidance rather than all-completed", async () => {
  const a = app([
    {
      id: 1,
      date: "2026-11-17",
      time: "07:00",
      title: "Atividade de exemplo",
      done: false,
    },
  ]);
  a.run(`state.me={name:'Explorador',today:'2026-11-17'}`);
  await a.run("child()");
  assert(!a.nodes.content.innerHTML.includes("Você fez cada etapa"));
  assert(a.nodes.content.innerHTML.includes("Vamos rever o combinado?"));
  assert(a.nodes.content.innerHTML.includes('data-action="done"'));
  assert.equal(a.writes.length, 0);
});
test("day planning covers past/future dates, equal times, completed events and preserves input", () => {
  const a = app();
  a.run(
    `state.testEvents=[{id:1,date:'2026-11-17',time:'09:59',done:false},{id:2,date:'2026-11-17',time:'10:00',done:true},{id:3,date:'2026-11-17',time:'10:00',done:false},{id:4,date:'2026-11-17',time:'10:01',done:false}];`,
  );
  assert.equal(a.run("dayPlan(state.testEvents).next.id"), 3);
  assert.equal(a.run("dayPlan(state.testEvents).earlier.length"), 1);
  assert.equal(
    a.run(`dayPlan(state.testEvents,{date:'2026-11-18',time:'00:00'}).next`),
    undefined,
  );
  assert.equal(
    a.run(
      `dayPlan(state.testEvents,{date:'2026-11-16',time:'23:59'}).earlier.length`,
    ),
    0,
  );
  assert.equal(a.run("state.testEvents.filter(e=>e.done).length"), 1);
  assert.equal(
    a.run(`pendingLabel(state.testEvents[2],calendarClock())`),
    "○ Pendente · Neste horário",
  );
});
test("calendar clock uses Sao Paulo at local midnight regardless of the machine timezone", () => {
  const a = app();
  // Read the original clock function instead of the deterministic test override.
  a.run(
    source.slice(
      source.indexOf("function calendarClock("),
      source.indexOf("function eventPeriod("),
    ),
  );
  assert.equal(
    a.run(`JSON.stringify(calendarClock(new Date('2026-11-18T02:59:00Z')))`),
    '{"date":"2026-11-17","time":"23:59"}',
  );
  assert.equal(
    a.run(`JSON.stringify(calendarClock(new Date('2026-11-18T03:00:00Z')))`),
    '{"date":"2026-11-18","time":"00:00"}',
  );
});
test("empty and all-completed days have accurate progress and no featured action", async () => {
  for (const events of [
    [],
    [{ id: 1, date: "2026-11-17", time: "08:00", title: "Teste", done: true }],
  ]) {
    const a = app(events);
    a.run(`state.me={name:'Explorador',today:'2026-11-17'}`);
    await a.run("child()");
    assert(!a.nodes.content.innerHTML.includes('id="nextTitle"'));
    assert(
      a.nodes.content.innerHTML.includes(`value="${events.length}" max="1"`),
    );
  }
});

test("review categories recognize synthetic variants and departure titles", () => {
  const a = app();
  for (const [title, expected] of [
    ["Taekwondo de exemplo", "sport"],
    ["Saída para Taekwondo", "sport"],
    ["Futsal de exemplo", "sport"],
    ["SAÍDA PARA FÚTSAL", "sport"],
    ["Psicopedagoga de exemplo", "health"],
    ["Sessão com psicopedagogo", "health"],
    ["Saída para Psicopedagoga", "health"],
    ["Sessão de Psicopedagogia", "health"],
    ["Ferro gotas de exemplo", "medicine"],
    ["FERRO EM GOTAS — exemplo", "medicine"],
    ["Oficina de ferro", "other"],
  ]) {
    assert.equal(
      a.run(`category(${JSON.stringify({ title, icon: "⭐" })})`),
      expected,
      title,
    );
  }
});
