# PROMPT EXECUTIVO DO CODEX — Etapa 10

**Projeto:** `nellipe/davi-missoes`
**Workspace obrigatório:** `D:\davi-missoes`
**Branch de desenvolvimento:** `feat/etapa10-unificar-ilha-placas`
**Base:** merge da PR #19, `cd526377009e5f6a4b1634c7e47f0f034c428364`

## Tarefa mandatória

Implementar duas mudanças concretas **no jogo existente**: (1) a Ilha 2D deixa de ser um mundo separado; a Floresta passa a ter Vista 3D e Vista 2D do mesmo mapa com todas as funções antigas; (2) distribuir as placas de atividades pelo terreno inteiro e seguro **dos quatro mundos**, em vez de agrupá-las junto ao spawn.

**Leia na íntegra** `docs/etapa10-unificacao-ilha-placas.md`, que contém diagnóstico do código, regras e testes de aceitação. Também leia os arquivos `app.js`, `forest.js`, `world.js`, `world_maps.py`, `world.py`, `assets/forest/navigation.mjs` e `assets/worlds/layouts.json` antes de editar.

## Regras prioritárias

1. Trabalhe exclusivamente no checkout Windows `D:\davi-missoes`. Não faça clone, worktree, segundo repositório, novo servidor LAN ou duplicação da aplicação. Faça `git status` e `git fetch` antes de entrar nesta branch, sem sobrescrever arquivos locais.
2. A PR #19 foi **merged**, e sua branch original não deve receber commits novos. Com o código atual preservado, faça os commits da Etapa 10 apenas na nova branch/PR indicada.
3. Remova a **Ilha 2D como quinto mundo visível**; ofereça Floresta 3D/2D como **mesmo destino**, mantendo Agora, agenda, oficina, guarda-roupa, compras, ponte, casa, portal, Pipo, missões e controles do responsável.
4. Trate preferências antigas e `selected_world='island'` como compatibilidade, sem apagar `world_state`, SQLite ou inventário. Não converter coordenadas da antiga Ilha em coordenadas da Floresta por regra de três; são mapas distintos.
5. Troque os slots fixos de `forest.js:createFeatures()` por distribuição determinística de atividades em setores acessíveis de cada mundo, sem duplicação por módulo, sem placas sobre objetos ou áreas bloqueadas, com distância mínima e acesso via Caminhos.
6. Não substituir a navegação livre pelas antigas faixas, não dar estrelas por caminhar, não driblar horários e não comprometer as oito microaventuras da Etapa 9.2.
7. Teste com SQLite sintético temporário na mesma base de código, com browser em 360/390/1366; valide distribuição com 12–20 eventos, retomada, ponte e economia, alternância 2D/3D e Pipo, além de comparações visuais.
8. Como o DaviApp usa este checkout diretamente, concentre a implementação e reinicie o backend uma vez **apenas quando estiver consistente e testado**. Não executar instalação/publicação completa nem mexer em Caddy, DNS ou certificados.
9. Mantenha a nova PR **em rascunho**, sem merge automático. Entregue código, testes, capturas e SHA; não apenas um plano.

**Resultado exigido:** quatro mundos no seletor, duas vistas sincronizadas para cada mundo e placas de compromissos realmente espalhadas por seus cenários. Sem perda das funcionalidades históricas da Ilha.