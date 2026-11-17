/* Optional browser validation. Uses only a temporary SQLite database. */
const { chromium, request } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const data = fs.mkdtempSync(path.join(os.tmpdir(), "davi-v03-synthetic-"));
const base = "http://127.0.0.1:18876";
const marker = "Synthetic-" + require("node:crypto").randomUUID().slice(0, 8);
const bootstrap =
  "import server; server.initialize(); server.set_setting('name', " +
  JSON.stringify(marker) +
  "); server.main()";
const server = spawn(
  process.env.PYTHON || "py",
  process.env.PYTHON ? ["-c", bootstrap] : ["-3", "-c", bootstrap],
  {
    cwd: root,
    env: { ...process.env, DAVI_DATA_DIR: data, DAVI_PORT: "18876" },
    stdio: "ignore",
    windowsHide: true,
  },
);
const report = { widths: [], checks: [], accessibility: [], errors: [] };
let browser;
const evidence = path.join(root, "docs", "evidencias-v03");
fs.mkdirSync(evidence, { recursive: true });
async function main() {
  const api = await request.newContext({ baseURL: base });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const response = await api.get("/api/me");
      if (
        response.ok() &&
        (await response.json()).name === marker &&
        server.exitCode === null
      ) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert(ready, "Temporary server started");
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1366, height: 1000 },
    reducedMotion: "reduce",
    locale: "pt-BR",
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date("2026-11-17T13:00:00Z"));
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("401 (Unauthorized)"))
      report.errors.push(m.text());
  });
  page.on("dialog", (d) => d.accept());
  const idle = () =>
    page.waitForFunction(
      () =>
        document.querySelector("#content") &&
        !document.querySelector("#content").hasAttribute("aria-busy"),
    );
  async function click(sel) {
    await page.locator(sel).first().click();
    await idle();
  }
  async function submit(sel) {
    await page.locator(sel).evaluate((f) => f.requestSubmit());
    await idle();
  }
  async function capture(area, width) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator("#content").focus();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(evidence, `${area}-${width}.png`),
      fullPage: true,
    });
    const geometry = await page.evaluate(() => {
      const overflow = [
        ...document.querySelectorAll(
          "main button,main input,main select,main textarea",
        ),
      ]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.left < 0 || r.right > innerWidth + 1);
        })
        .map((el) => el.id || el.textContent);
      return {
        overlaps: (() => {
          const controls = [
            ...document.querySelectorAll(
              "main button,main input,main select,main textarea",
            ),
          ]
            .map((el) => ({
              name: el.id || el.textContent,
              r: el.getBoundingClientRect(),
            }))
            .filter((x) => x.r.width > 0 && x.r.height > 0);
          const collisions = [];
          for (let i = 0; i < controls.length; i++)
            for (let j = i + 1; j < controls.length; j++) {
              const a = controls[i],
                b = controls[j];
              if (
                Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) >
                  1 &&
                Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) >
                  1
              )
                collisions.push([a.name, b.name]);
            }
          return collisions;
        })(),
        viewport: innerWidth,
        scroll: document.documentElement.scrollWidth,
        overflow,
      };
    });
    assert(
      geometry.scroll <= width,
      `${area} ${width}: no horizontal overflow`,
    );
    assert.equal(geometry.overflow.length, 0, JSON.stringify(geometry));
    assert.equal(
      geometry.overlaps.length,
      0,
      JSON.stringify(geometry.overlaps),
    );
    report.widths.push({ area, width, ...geometry });
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    report.accessibility.push({
      area,
      width,
      violations: audit.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    });
  }
  await page.goto(base);
  await idle();
  assert.equal(await page.locator("progress").getAttribute("value"), "0");
  await click("#parentTab");
  assert.equal(await page.locator("#setupForm").count(), 1);
  await page.locator("#password").fill("SyntheticOnly!2026");
  await page.locator("#repeat").fill("SyntheticOnly!2026");
  await submit("#setupForm");
  assert.equal(await page.locator("#loginForm").count(), 1);
  await page.locator("#password").fill("SyntheticOnly!2026");
  await submit("#loginForm");
  assert.equal(await page.locator(".month").count(), 1);
  report.checks.push("First-access setup and login");
  const me = await (await context.request.get(base + "/api/me")).json();
  const today = me.today;
  // Fixed future range for repeatability; all activity text is synthetic.
  const day = "2026-11-17";
  const fixtures = [
    ["Escovar os dentes", "🪥", "07:00"],
    ["Escola de exploradores", "📚", "08:00"],
    ["Almoço de exemplo", "🍎", "12:00"],
    ["Consulta de exemplo", "🩺", "14:00"],
    ["Futebol no parque", "⚽", "16:00"],
    ["Medicação de exemplo", "💊", "18:00"],
    ["Hora de dormir", "💤", "21:00"],
    ["Construir uma cidade de blocos", "⭐", "17:00"],
  ];
  for (const [title, icon, time] of fixtures) {
    const res = await context.request.post(base + "/api/events", {
      data: {
        title,
        icon,
        time,
        duration: 30,
        notes:
          "Combine os detalhes com seu responsável. Uma etapa de cada vez.",
        start_date: day,
        recurrence: "daily",
        weekdays: [],
        skip_holidays: false,
        skip_weekends: false,
      },
    });
    assert(res.ok());
  }
  await click('[data-action="settings"]');
  await page.locator("#name").fill("Explorador de Mundos");
  await submit("#settingsForm");
  // UI create, weekly recurrence, edit and deletion.
  await click('[data-action="new"]');
  await page.locator("#title").fill("Oficina sintética");
  await page.locator("#start_date").fill(day);
  await page.locator("#recurrence").selectOption("weekly");
  await page.locator('input[name="weekday"][value="1"]').check();
  await page.locator('input[name="weekday"][value="3"]').check();
  await page.locator("#skip_holidays").check();
  await submit("#eventForm");
  let row = page.locator(".task").filter({
    has: page.getByRole("heading", {
      name: "Oficina sintética",
      exact: true,
    }),
  });
  assert.equal(await row.count(), 1);
  let events = (await (await context.request.get(base + "/api/events")).json())
    .events;
  const eid = events.find((e) => e.title === "Oficina sintética").id;
  const range = async () =>
    (
      await (
        await context.request.get(
          base + "/api/calendar?start=2026-11-17&end=2026-11-24",
        )
      ).json()
    ).events.filter((e) => e.id === eid);
  assert.deepEqual(
    (await range()).map((e) => e.date),
    ["2026-11-17", "2026-11-19", "2026-11-24"],
  );
  await row.locator('[data-action="edit"]').click();
  await idle();
  assert.equal(await page.locator("#recurrence").inputValue(), "weekly");
  assert(await page.locator('input[name="weekday"][value="3"]').isChecked());
  await page.locator("#title").fill("Oficina sintética editada");
  await submit("#eventForm");
  row = page.locator(".task").filter({
    has: page.getByRole("heading", {
      name: "Oficina sintética editada",
      exact: true,
    }),
  });
  await row.locator('[data-action="skip"]').click();
  await idle();
  assert.deepEqual(
    (await range()).map((e) => e.date),
    ["2026-11-19", "2026-11-24"],
  );
  await click('[data-action="selectday"][data-date="2026-11-19"]');
  row = page.locator(".task").filter({
    has: page.getByRole("heading", {
      name: "Oficina sintética editada",
      exact: true,
    }),
  });
  await row.locator('[data-action="delete"]').click();
  await idle();
  assert.equal((await range()).length, 0);
  report.checks.push(
    "UI create, edit weekly series, delete occurrence and delete series",
  );
  await click('[data-action="selectday"][data-date="2026-11-20"]');
  assert(
    (await page.locator(".tag.holiday").textContent()).includes(
      "Consciência Negra",
    ),
  );
  report.checks.push("Holiday labels and selected date");
  await click('[data-action="monthnext"]');
  await click('[data-action="monthprev"]');
  await click('[data-action="selectday"][data-date="' + day + '"]');
  for (const width of [360, 390, 768, 1366, 1920])
    await capture("responsavel", width);
  await page.setViewportSize({ width: 1366, height: 1000 });
  await click("#childTab");
  await page.locator("#childDate").fill(day);
  await page.locator("#childDate").dispatchEvent("change");
  await idle();
  assert.equal(
    await page.locator(".mission h2").textContent(),
    "Almoço de exemplo",
  );
  assert.equal(await page.locator(".task.done").count(), 0);
  assert(
    (await page.locator(".earlier-notice").textContent()).includes(
      "2 atividades de horários anteriores",
    ),
  );
  assert.equal(
    await page.locator(".task").filter({ hasText: "Horário anterior" }).count(),
    2,
  );
  const times = await page.locator(".task .time").allTextContents();
  assert.deepEqual(times, [...times].sort());
  await page.locator(".mission button").focus();
  await page.keyboard.press("Enter");
  await idle();
  assert.equal(await page.locator("progress").getAttribute("value"), "1");
  assert.equal(
    await page.locator(".mission h2").textContent(),
    "Consulta de exemplo",
  );
  assert.equal(await page.locator(".task.cat-medicine.done").count(), 0);
  assert(await page.evaluate(() => document.activeElement !== document.body));
  await click(".task.done button");
  assert.equal(await page.locator("progress").getAttribute("value"), "0");
  report.checks.push(
    "Next scheduled activity, visible earlier pendencies, explicit completion, undo and keyboard focus; medication remains pending",
  );
  for (const width of [360, 390, 768, 1366, 1920])
    await capture("crianca", width);
  await page.clock.setFixedTime(new Date("2026-11-17T15:01:00Z"));
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  assert.equal(
    await page.locator(".mission h2").textContent(),
    "Consulta de exemplo",
  );
  assert(
    (await page.locator(".earlier-notice").textContent()).includes(
      "3 atividades de horários anteriores",
    ),
  );
  assert.equal(await page.locator("progress").getAttribute("value"), "0");
  await page.locator("#earlierLink").focus();
  await page.keyboard.press("Enter");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "dailyAgenda",
  );
  await page.clock.setFixedTime(new Date("2026-11-17T13:00:00Z"));
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await click('[data-action="childnext"]');
  assert.equal(await page.locator("#childDate").inputValue(), "2026-11-18");
  await click('[data-action="childprev"]');
  await click('[data-action="childtoday"]');
  assert.equal(await page.locator("#childDate").inputValue(), today);
  // Test long content, including an unbroken string, at every requested width.
  await click("#parentTab");
  await click('[data-action="settings"]');
  await page.locator("#name").fill("ExploradorABCDEFGHIJKLMNOPQRSTUVWXYZ");
  await submit("#settingsForm");
  const long = (await (await context.request.get(base + "/api/events")).json())
    .events[0];
  const longUpdate = await context.request.put(
    base + "/api/events/" + long.id,
    {
      data: {
        ...long,
        title: "A".repeat(100),
        notes: "Detalhes de demonstração. ".repeat(32),
      },
    },
  );
  assert(longUpdate.ok());
  const savedLong = (
    await (await context.request.get(base + "/api/events")).json()
  ).events.find((e) => e.id === long.id);
  assert.equal(savedLong.title.length, 100);
  assert.equal(savedLong.notes.length, 800);
  assert.equal(
    (await (await context.request.get(base + "/api/me")).json()).name.length,
    35,
  );
  for (const width of [360, 390, 768, 1366, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await click('[data-action="new"]');
    assert(await page.locator("#eventForm").isVisible());
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await click('[data-action="calendar"]');
    await click("#childTab");
    await page.locator("#childDate").fill(day);
    await page.locator("#childDate").dispatchEvent("change");
    await idle();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await click("#parentTab");
  }
  report.checks.push(
    "Long name (35), title (100), description (800), forms and child layouts at all five widths",
  );
  // Empty and all-done states, without publishing test data outside temp DB.
  await click("#childTab");
  await page.locator("#childDate").fill("2020-01-01");
  await page.locator("#childDate").dispatchEvent("change");
  await idle();
  assert.equal(await page.locator("progress").getAttribute("value"), "0");
  assert.equal(await page.locator(".mission button").count(), 0);
  await page.locator("#childDate").fill(day);
  await page.locator("#childDate").dispatchEvent("change");
  await idle();
  while (await page.locator(".mission button").count())
    await click(".mission button");
  assert(
    (await page.locator(".mission h2").textContent()).includes(
      "rever o combinado",
    ),
  );
  assert.equal(
    await page.locator(".task").filter({ hasText: "Horário anterior" }).count(),
    2,
  );
  assert.equal(await page.locator("progress").getAttribute("value"), "6");
  while (await page.locator(".task:not(.done) button").count())
    await click(".task:not(.done) button");
  assert(
    (await page.locator(".mission h2").textContent()).includes("cada etapa"),
  );
  assert.equal(await page.locator("progress").getAttribute("value"), "8");
  await click("#parentTab");
  await click('[data-action="logout"]');
  assert.equal(await page.locator("#loginForm").count(), 1);
  assert.equal((await context.request.get(base + "/api/events")).status(), 403);
  await page.locator("#password").fill("IncorrectSyntheticPassword");
  await submit("#loginForm");
  assert(
    (await page.locator("#alert").textContent()).includes("Senha incorreta"),
  );
  report.checks.push(
    "Empty day, all completed, date navigation, logout denies parent API and invalid login",
  );
  await page.reload();
  await idle();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.className),
    "skip-link",
  );
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement.id), "content");
  assert.equal(
    await page.evaluate(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    true,
  );
  report.checks.push("Skip link and reduced-motion browser preference");
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
  assert.equal(
    report.accessibility.flatMap((x) => x.violations).length,
    0,
    "Axe WCAG A/AA checks",
  );
  await api.dispose();
}
main()
  .then(() => {
    report.result = "passed";
    console.log(
      "Browser validation passed: " +
        report.checks.length +
        " flow groups, " +
        report.widths.length +
        " captures, " +
        report.accessibility.length +
        " accessibility scans.",
    );
  })
  .catch((e) => {
    report.result = "failed";
    report.failure = e.stack;
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    fs.writeFileSync(
      path.join(evidence, "validation.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    if (browser) await browser.close();
    if (server.exitCode === null) {
      const stopped = new Promise((r) => server.once("exit", r));
      server.kill();
      await stopped;
    }
    fs.rmSync(data, { recursive: true, force: true });
  });
