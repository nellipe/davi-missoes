# Etapa 10 — Unificação da Ilha 2D com a Floresta + placas distribuídas

**Decisão do responsável em 19/11/2026.** PR #19 foi aprovada e integrada em `main`, merge commit `cd526377009e5f6a4b1634c7e47f0f034c428364`, abrangendo a Etapa 9.2 (`44b05012538f7a4fa12c7fbc94c1cf7cdc3c46fb`).

Esta etapa reúne duas solicitações **novas**, que ainda NÃO foram implementadas: retirar a Ilha das Ideias como mundo independente e distribuir as placas de atividades/eventos por todos os mundos. Esta branch é uma continuação no **mesmo repositório**, não um clone nem uma publicação.

## 1. Diagnóstico técnico verificado

- `world.js` mantém uma **Ilha das Ideias 2D legada**, com coordenadas SVG 1100×650, prédios de oficina, calendário, guarda-roupa, ponte/portal e seu próprio movimento em `world_state`.
- `forest.js` contém a **Floresta Encantada 3D**, com fallback 2D do **mesmo mapa da Floresta**, inventário/economia compartilhados e checkpoints em coordenadas de mundo distintos da Ilha.
- `world_maps.py` inclui tanto `forest` quanto `island` no seletor. `app.js` decide entre `DaviWorld.open()` (Ilha) e `forest.open()` (quatro mundos 3D/2D). Portanto a Ilha não é uma renderização equivalente da Floresta; há estados/rotas diferentes.
- As placas de eventos são criadas em `forest.js:createFeatures()`: seis coordenadas fixas perto do início para novos mundos, seis na Clareira para a Floresta e outros slots só na faixa `x=-11..11, z=2..9`. `slots[i % slots.length]` pode repetir lugares quando há mais atividades do que slots. Assim elas ficam amontoadas e não se distribuem pelos cenários.

## 2. Resultado desejado — quatro mundos, duas vistas

1. O seletor **Mundos** deve oferecer exatamente quatro aventuras: Floresta Encantada, Praia dos Tesouros, Vale dos Dinossauros e Cidade dos Inventores. Ilha das Ideias não deve aparecer como quinta aventura.
2. Todo mundo tem uma única identidade de mapa, mas pode ser exibido em **Vista 3D ou Vista 2D** a partir do mesmo estado e posição, sem teleportar Davi ou Pipo ao alternar.
3. A **Floresta 2D** substitui visualmente a Ilha 2D como alternativa da Floresta 3D. Manter no novo fluxo as funcionalidades que estavam na Ilha: Agora, calendário/atividades, oficina de estrelas, compras da ponte/casa/portal, guarda-roupa e personalização do Pipo, acesso do responsável, inventário e progresso. Verificar especialmente a experiência de customização em telas pequenas.
4. Preservar `world.py`, `/api/world`, `world_ledger`, `world_inventory`, `world_state`, `forest_position`, `trail_position`, estado do besouro, estrelas de teste, roupas, horários e todos os oito microdesafios. **Não apagar tabelas ou remover serviços**.
5. Compatibilidade: clientes antigos podem ter `selected_world='island'` no SQLite e `davi-forest-mode='island'` no armazenamento do navegador. Interpretar ambos como **Floresta na vista 2D**, de modo idempotente e sem perda de dados. Não tentar mapear por escala as coordenadas SVG da Ilha para o terreno 3D: os mapas não são geometrias equivalentes. Usar o checkpoint salvo da Floresta ou spawn seguro; manter os dados antigos em disco.
6. Se WebGL falhar, oferecer **a vista 2D do mesmo mundo**, não trocar silenciosamente para uma ilha diferente. A agenda deve continuar utilizável mesmo se o renderizador falhar.

## 3. Placas de eventos espalhadas pelos quatro mundos

1. Substituir o posicionamento fixo de `createFeatures()` por distribuição **determinística por mundo e atividade**, suficientemente espalhada por todas as regiões caminháveis (os mapas novos têm bounds `[-17,50,-14,17]`, extensão 67×31; a Floresta também). Evitar seis placas próximas do spawn.
2. Cada atividade do dia deve existir como **um único destino visível no mundo**, com coordenada estável durante a data e entre recarga/2D/3D. Não reciclar pontos via módulo `slots[i % slots.length]`. Reposicionar/remapear quando o total de compromissos exceder o conjunto inicial.
3. Respeitar o mesmo validador de terreno/obstáculos do movimento, sem placas dentro de água profunda, troncos, rochas, construções, precipícios ou áreas além das fronteiras; checar rota alcançável a partir do spawn com a economia/inventário atual. Não colocar atividades diárias atrás de ponte ou compra ainda não obtida.
4. Impor distância mínima razoável entre placas (alvo inicial ≥4 unidades, adaptável à densidade real) e separação de lugares narrativos, personagens, objetos de desafio, saídas e botões de cena. Distribuir em pelo menos três setores para dias com várias atividades.
5. A UX deve continuar intuitiva: placa indicativa de horário/estado, toque/teclado para caminhar, ao chegar abrir atividade/roteiro ou agenda conforme existente. A lista de **Caminhos/Lugares** continua permitindo localizar qualquer compromisso sem caminhada longa obrigatória. A contagem/visibilidade deve evitar poluição de rótulos no mobile.
6. Quando a data mudar, reconstruir o posicionamento de forma estável sem concluir, duplicar ou deslocar atividades salvas. Não creditar estrelas por viajar; cumprir horário real no servidor. Preservar a economia, a Oficina e o progresso infantil.
7. Preferir extrair um posicionador puro e testável para `assets/forest/activity-placement.mjs` ou equivalente. Compartilhar lógica 3D/2D. Testes de paridade visual e clique; **não gravar coordenadas desnecessárias no SQLite** se posição determinística e identificador bastarem.

## 4. Testes obrigatórios de aceite

- Seleção em quatro mundos (sem quinta Ilha), alternância 3D↔2D 30 vezes com mesma posição, controles e Pipo.
- Compatibilidade com preferências antigas `selected_world='island'` e localStorage legado; sem apagar SQLite e sem desativar `world.js` antes de substituir suas funcionalidades.
- Ponte comprada com 10.000 estrelas definidas pelo responsável; compras/personalização/itens continuam acessíveis em vistas 3D/2D.
- Com **12–20 eventos sintéticos** num dia: cada evento tem uma placa única, sem sobreposição de coordenadas, espalhadas pelas regiões de cada um dos quatro mundos, passáveis por toque/WASD e selecionáveis pelo menu Caminhos. Testar sem ponte e com ponte.
- Testar 360/390/1366px, mobile/toque, acessibilidade por teclado e leitura de estado; fallback 2D de todos os mundos; posições/placas não saltam ao recarregar e alternar vista.
- Regressão de Agora, agenda/horários, 10.000 estrelas e redefinição, missões, oito microaventuras, inventário, besouro/ouriço, Pipo autônomo, colisões e retomada.
- Evidências de antes/depois dos agrupamentos de placas na Floresta, Praia, Vale e Cidade, capturas 3D e 2D e breve vídeo real. Não apenas screenshot de locais preparados.

## 5. Regra operacional: mesmo checkout Windows

- Usar **somente `D:\davi-missoes`**, com `git status` e `git fetch` (não usar `git clone`, `git worktree add`, novas instalações ou pastas duplicadas). Esta branch parte do merge em `main`; o checkout Windows pode ainda apontar para a antiga branch da PR #19. Trocar para esta branch preservando alterações locais e arquivos ignorados, sem `git reset --hard` e sem `git clean`.
- Como o DaviApp serve recursos diretamente deste checkout, não misturar a leitura do usuário com arquivos pela metade: consolidar alterações, executar testes em processo de loopback com **SQLite sintético e temporário**, e só reiniciar DaviApp uma vez após o conjunto estar consistente; não é preciso reimplantar Caddy/DNS/certificados.
- Não exigir backups novos por rotina para esta entrega; preservar os bancos e dados já existentes e não rodar migrações destrutivas. Nunca usar a agenda real em testes automatizados.
- Não fazer merge desta nova PR automaticamente. O responsável autorizou o merge da PR #19, não uma fusão futura sem revisão. Fazer commit e evidenciar o resultado nesta mesma branch/PR nova.

**Critério decisivo:** o jogador vê quatro mundos e escolhe Vista 3D ou Vista 2D do mesmo mundo; as placas dos eventos estão espalhadas por terreno seguro e os recursos antigos da Ilha continuam disponíveis dentro do fluxo unificado.