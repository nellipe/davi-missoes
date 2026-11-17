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
test("next pending ignores elapsed time and completion requires explicit action", async () => {
  const a = app([
    {
      id: 1,
      date: "2026-11-17",
      time: "00:01",
      title: "Medicação de exemplo",
      done: false,
    },
    { id: 2, date: "2026-11-17", time: "00:02", title: "Escola", done: true },
  ]);
  a.run(`state.me={name:'Explorador',today:'2026-11-17'}`);
  await a.run("child()");
  assert(
    a.nodes.content.innerHTML.includes('id="nextTitle">Medicação de exemplo'),
  );
  assert(a.nodes.content.innerHTML.includes('value="1" max="2"'));
  assert.equal(a.writes.length, 0);
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
