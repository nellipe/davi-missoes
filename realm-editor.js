/* Editor de modelos visuais, atividades e desafios; apenas responsável. */
window.DaviRealmEditor = (() => {
  let host, data, events, draft;
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const places = [
    [4, -4, "Mirante"],
    [-4, -2, "Jardim das ideias"],
    [3, 3, "Praça do Pipo"],
    [-6, 4, "Cantinho de leitura"],
    [-2, -5, "Caminho do portal"],
  ];
  const button = (label, action, attrs = "") =>
    `<button type="button" data-action="realm-${action}" ${attrs}>${label}</button>`;
  async function open(options) {
    host = options;
    data = await host.api("/api/realms/config");
    events = (await host.api("/api/events")).events;
    library();
  }
  function library() {
    host.layout(
      `<div class="row between"><div><div class="eyebrow">PAINEL DO RESPONSÁVEL</div><h1>Mundos e desafios</h1></div><button data-action="calendar">← Calendário</button></div><p>Crie um mundo a partir de um modelo pronto. Vincular uma atividade não muda sua agenda nem suas estrelas.</p>${button("Criar mundo", "new")}<div class="realm-edit-list">${data.worlds.map((w) => `<article><h2>${esc(w.name)}</h2><p>${esc(data.presets[w.preset].label)} · ${w.available ? "Disponível" : "Oculto"} · ${w.event_ids.length} atividade(s) · ${w.challenges.filter((c) => c.available).length} desafio(s)</p><p>${esc(w.description)}</p>${button("Editar mundo", "edit", `data-id="${esc(w.id)}"`)}</article>`).join("")}</div>`,
    );
  }
  function read() {
    draft.name = document.getElementById("realmName").value;
    draft.preset = document.getElementById("realmPreset").value;
    draft.color = document.getElementById("realmColor").value;
    draft.description = document.getElementById("realmDescription").value;
    draft.available = document.getElementById("realmAvailable").checked;
    draft.unlock_item = document.getElementById("realmUnlock").value || null;
    draft.event_ids = [
      ...document.querySelectorAll('[name="realmEvent"]:checked'),
    ].map((i) => Number(i.value));
    draft.challenges = draft.challenges.map((ch, i) => {
      const choices = document
          .getElementById("rc-options-" + i)
          .value.split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        kind = document.getElementById("rc-kind-" + i).value,
        place = document
          .getElementById("rc-place-" + i)
          .value.split(",")
          .map(Number);
      return {
        ...ch,
        title: document.getElementById("rc-title-" + i).value,
        prompt: document.getElementById("rc-prompt-" + i).value,
        kind,
        choices: kind === "explore" ? [] : choices,
        answer:
          kind === "sequence"
            ? choices
            : kind === "logic"
              ? [
                  choices[
                    Number(document.getElementById("rc-answer-" + i).value) - 1
                  ],
                ]
              : [],
        x: place[0],
        z: place[1],
      };
    });
  }
  function render() {
    host.layout(
      `<div class="row between"><h1>${draft.id ? "Editar mundo" : "Criar mundo"}</h1>${button("← Mundos", "cancel")}</div><form class="panel" id="realmForm"><div class="form-grid"><div><label for="realmName">Nome do mundo</label><input id="realmName" required maxlength="80" value="${esc(draft.name)}"></div><div><label for="realmPreset">Modelo visual</label><select id="realmPreset">${Object.entries(
        data.presets,
      )
        .map(
          ([id, p]) =>
            `<option value="${id}" ${id === draft.preset ? "selected" : ""}>${esc(p.label)}</option>`,
        )
        .join(
          "",
        )}</select></div><div><label for="realmColor">Cor dos portais e descobertas</label><input id="realmColor" type="color" value="${esc(draft.color)}"></div><div><label for="realmUnlock">Liberação</label><select id="realmUnlock"><option value="">Livre, sem compra necessária</option>${data.economy.catalog.map((i) => `<option value="${i.id}" ${draft.unlock_item === i.id ? "selected" : ""}>Após adquirir: ${esc(i.name)}</option>`).join("")}</select></div></div><label for="realmDescription">Descrição curta</label><textarea id="realmDescription" maxlength="400">${esc(draft.description)}</textarea><label><input type="checkbox" id="realmAvailable" ${draft.available ? "checked" : ""}>Disponível nos portais</label><p>Os modelos já trazem terreno, caminhos, cenário e pontos de entrada. Mudar o modelo reposiciona o personagem na entrada; as descobertas permanecem.</p><fieldset><legend>Atividades neste mundo</legend><p>Escolha séries da agenda. Elas continuam acessíveis de qualquer mundo, nas datas cadastradas.</p>${events.map((e) => `<label><input type="checkbox" name="realmEvent" value="${e.id}" ${draft.event_ids.includes(e.id) ? "checked" : ""}>${esc(e.title)} · ${esc(e.time)}</label>`).join("") || "<p>Cadastre atividades no calendário para vinculá-las aqui.</p>"}</fieldset><h2>Desafios e pontos de interesse</h2><p>Descobertas guardam progresso neste mundo; estrelas vêm das atividades. Um desafio de sequência usa as opções na ordem cadastrada; o Pipo mostra a sequência antes de responder.</p>${draft.challenges.map((ch, i) => `<fieldset class="realm-challenge"><legend>Desafio ${i + 1}</legend><label for="rc-title-${i}">Nome</label><input id="rc-title-${i}" required maxlength="80" value="${esc(ch.title)}"><label for="rc-prompt-${i}">Orientação ou pergunta</label><textarea id="rc-prompt-${i}" required maxlength="400">${esc(ch.prompt)}</textarea><div class="form-grid"><div><label for="rc-kind-${i}">Tipo</label><select id="rc-kind-${i}"><option value="explore" ${ch.kind === "explore" ? "selected" : ""}>Explorar: visitar o ponto</option><option value="sequence" ${ch.kind === "sequence" ? "selected" : ""}>Memória: repetir sequência</option><option value="logic" ${ch.kind === "logic" ? "selected" : ""}>Lógica: escolher resposta</option></select></div><div><label for="rc-place-${i}">Ponto no mapa</label><select id="rc-place-${i}">${places.map(([x, z, label]) => `<option value="${x},${z}" ${ch.x === x && ch.z === z ? "selected" : ""}>${label}</option>`).join("")}${places.some(([x, z]) => ch.x === x && ch.z === z) ? "" : `<option value="${ch.x},${ch.z}" selected>Ponto atual</option>`}</select></div></div><label for="rc-options-${i}">Opções (uma por linha, até seis; ignore em Explorar)</label><textarea id="rc-options-${i}">${ch.choices.map(esc).join("\n")}</textarea><label for="rc-answer-${i}">Número da opção correta (somente Lógica)</label><input id="rc-answer-${i}" type="number" min="1" max="6" value="${Math.max(1, ch.choices.indexOf(ch.answer[0]) + 1)}">${button("Remover este desafio", "remove", `data-index="${i}"`)}</fieldset>`).join("")}<div class="actions">${button("Adicionar desafio", "add", draft.challenges.length >= 20 ? "disabled" : "")}<button type="submit" class="primary">Salvar mundo</button>${button("Cancelar", "cancel")}</div></form>`,
    );
  }
  async function action(a, b) {
    if (a === "realm-new") {
      draft = {
        name: "",
        preset: "forest",
        color: "#e5bc79",
        description: "",
        available: true,
        unlock_item: null,
        event_ids: [],
        challenges: [],
      };
      render();
    } else if (a === "realm-edit") {
      draft = structuredClone(data.worlds.find((w) => w.id === b.dataset.id));
      draft.challenges = draft.challenges.filter((c) => c.available);
      render();
    } else if (a === "realm-cancel") library();
    else if (a === "realm-add") {
      read();
      draft.challenges.push({
        title: "",
        prompt: "",
        kind: "explore",
        choices: [],
        answer: [],
        x: 4,
        z: -4,
      });
      render();
    } else if (a === "realm-remove") {
      read();
      draft.challenges.splice(Number(b.dataset.index), 1);
      render();
    }
  }
  async function save() {
    read();
    await host.api("/api/realms/config", "PUT", draft);
    await open(host);
    document.getElementById("status").textContent =
      "Mundo salvo. Os portais já mostram o combinado.";
  }
  return { open, action, save };
})();
