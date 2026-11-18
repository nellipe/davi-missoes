# Issue #18 — estabilização da jogabilidade da Floresta Encantada

**Etapa 2 · 18 de novembro de 2026 · PR #17 em rascunho.** Os dez itens da rodada passaram no Chromium desktop com dados sintéticos. A família ainda precisa avaliar a jogabilidade nos aparelhos físicos. A direção artística e o tamanho do mapa ficaram fora desta etapa. [Issue #18](https://github.com/nellipe/davi-missoes/issues/18) · [base 22ece9f](https://github.com/nellipe/davi-missoes/commit/22ece9f) · [correções e testes 1cbc80f](https://github.com/nellipe/davi-missoes/commit/1cbc80f)

## Evidência para revisão

| Gravação contínua do navegador | O que observar |
|---|---|
| [Percurso pelos dez destinos](evidencias-issue18/etapa2/percurso.mp4) | Em cerca de 39 s, Davi abre o calendário, entra na agenda pelo marcador sem roteiro, muda a cor, constrói o portal, equipa Pipo, entra na missão da mochila e retorna. Depois visita o diário, constrói e atravessa a ponte, constrói a casa e abre o baú. |
| [Trinta ciclos 3D → 2D → 3D](evidencias-issue18/etapa2/alternancias.mp4) | O viewport alterna entre 360, 390 e 1366 px. A câmera gira em metade dos ciclos. O toque no chão escolhe o ponto de ida e o clique escolhe o de volta. |
| [Caminhada de dez minutos](evidencias-issue18/etapa2/sessao-10min.mp4) | Uma única abertura em perfil econômico, com idas e voltas por teclado, renderização, acompanhamento de Pipo e salvamentos durante todo o percurso. A gravação H.264 usa 12 quadros/s. A taxa do jogo vem do contador do renderizador. |

Capturas do navegador depois de remontar a floresta. [360 px](evidencias-issue18/etapa2/remontagem-360.png) · [390 px](evidencias-issue18/etapa2/remontagem-390.png) · [1366 px](evidencias-issue18/etapa2/remontagem-1366.png) · [missão](evidencias-issue18/etapa2/missao.png) · [outra margem](evidencias-issue18/etapa2/outra-margem.png)

## Defeitos reproduzidos e causas

| Situação | Antes da correção | Resultado |
|---|---|---|
| Tocar em uma tábua da ponte construída | Em `22ece9f`, Davi permaneceu a 0,95 unidade do alvo. O raio de seleção intersectava apenas o terreno sob o riacho. | Seleção e apoio agora usam um tabuleiro contínuo construído a partir das alturas das 19 tábuas do GLB, incluindo a ligação com as margens. Erro final de 0,016 unidade no mesmo toque. [Base](evidencias-issue18/etapa2/contatos-base.json) · [reteste](evidencias-issue18/etapa2/contatos.json) |
| Atravessar a rocha perto da oficina | O centro renderizado é `(-6, 5)`. O bloqueio anterior estava espelhado no mapa. Davi passou a 0,088 unidade do centro da rocha. | Cliente e servidor usam as coordenadas exportadas. A aproximação por teclado para fora do raio protegido de 1,33. O teste compara as seis rochas de referência com o próprio GLB. [Contatos](evidencias-issue18/etapa2/contatos.json) |
| Abrir outra atividade ao chegar pelo menu Caminhos | Com 50 atividades, duas escolhas diferentes abriram “Atividade sintética 22” na base. A chegada usava exclusivamente a distância ao marcador, inclusive quando vários ficavam no mesmo ponto. | O destino escolhido tem prioridade dentro do alcance de interação. As duas escolhas agora abrem os títulos corretos. Uma nova caminhada manual libera a seleção. [Base](evidencias-issue18/etapa2/agenda-cheia-base.json) · [reteste](evidencias-issue18/etapa2/agenda-cheia.json) |
| Reter cenas antigas mesmo com o motor parado | Na rodada anterior à correção de descarte, os nós de DOM após coleta de lixo cresceram de 648 para 4.163. O heap do Chromium mostrou buffers de geometrias reutilizadas ligados a contextos WebGL e canvases antigos. | O fechamento libera buffers, texturas, esqueletos e sombras antes de descartar o renderizador. O cache mantém os dados de origem para a próxima abertura. No reteste, 528 nós no primeiro e no último ciclo, entre 523 e 533 nas coletas. Foram 68 listeners em cada coleta. [Antes](evidencias-issue18/etapa2/memoria-antes.json) · [depois](evidencias-issue18/etapa2/alternancias.json) |

Os relatos anteriores de saudação durante a caminhada e de dois motores ativos já tinham correções em `22ece9f`. Nesta etapa o smoke voltou a passar. Nos 30 ciclos, Davi andou nas quatro direções, o tempo do clipe de caminhada avançou e a câmera acompanhou o deslocamento. O 2D ficou inativo e sem frame agendado durante o 3D. O teste também enviou eventos aos elementos desmontados e cancelou contatos reais do protocolo de toque no direcional. O maior erro horizontal ficou em 0,026 unidade para toque e 0,015 para clique. O movimento até um destino agora termina na coordenada solicitada, com salvamento ao parar. [Ciclos, coordenadas e recursos](evidencias-issue18/etapa2/alternancias.json)

## Terreno, Pipo e continuidade

- **Colisão e apoio.** A margem bloqueou a aproximação antes da compra. Depois da compra, a passagem pelo centro funcionou e a saída lateral sobre a água permaneceu bloqueada. Davi ficou em `Idle` contra a árvore e a rocha, mesmo com a tecla pressionada. No percurso pelos destinos, a maior diferença entre o ponto mais baixo da malha animada e a superfície de apoio foi 0,024 unidade. Sobre tábuas efetivamente intersectadas, a maior diferença para a geometria do GLB foi 0,035. A compensação usa somente ações de animação em execução. [Contatos](evidencias-issue18/etapa2/contatos.json) · [amostras do percurso](evidencias-issue18/etapa2/percurso.json)
- **Câmera e companheiro.** O centro de Davi permaneceu dentro do volume visível nas amostras. Pipo permaneceu na área caminhável, atingiu distância horizontal máxima de 1,07 unidade no percurso e passou de `Walk` para `Hover` ao parar. Os tempos dos clipes de ambos estão no registro. [Percurso](evidencias-issue18/etapa2/percurso.json)
- **Retorno e estado.** O teste entrou e saiu da missão e da agenda. Comparou a posição antes e depois de cada retorno e após recarregar, com tolerância de 0,025 unidade. A cor, o lenço equipado, as construções e o saldo de 19 das 40 estrelas sintéticas foram conferidos. A escolha de modo e a posição foram verificadas nas remontagens. [Percurso](evidencias-issue18/etapa2/percurso.json) · [trocas](evidencias-issue18/etapa2/alternancias.json)
- **Horários.** O servidor sintético marcava 11h15 em São Paulo. A mochila das 11h tinha roteiro. A história das 15h aparecia na agenda sem roteiro. Uma confirmação direta pela sessão infantil recebeu HTTP 409 e a ocorrência continuou pendente. Os testes da PR #14 também verificaram confirmar e desfazer antes, dentro e depois da janela, além de etapas e créditos. [Resultado do fluxo](evidencias-issue18/etapa2/percurso.json) · [testes de servidor](../tests/test_schedule_window.py)
- **Fallback.** O Chromium recuperou uma perda transitória de WebGL. Na segunda perda, mantida durante o teste, o monitor da homologação local abriu a ilha 2D. O retorno manual ao 3D preservou a posição. Em outra página com criação de WebGL indisponível, a agenda abriu a partir da ilha 2D. [Eventos do navegador](evidencias-issue18/etapa2/fallback.json)

## Medição contínua

No Chromium 159.0.8154.6, com RTX 2060 SUPER via D3D11 e viewport de 1100 × 820, a sessão durou **600,49 s**, com **60,0 FPS médios**. Dos 36.000 intervalos medidos, o p95 foi **16,7 ms**, o p99 foi 16,8 ms e o mais longo foi 49,9 ms. A primeira abertura levou 1,91 s no modo automático. A caminhada começou depois de selecionar o perfil econômico.

Durante a caminhada houve 83–87 chamadas de desenho e 151.997–156.429 triângulos por quadro amostrado. As contagens ficaram em 72 geometrias e 49 texturas. A estimativa da cena foi de 4,90 MB em buffers geométricos e 11,89 MB em texturas. O heap JS após coleta passou de 12,62 MB para 13,01 MB, com um documento e 57 listeners nas duas pontas. Nas 11 coletas, a contagem final de nós foi 256, contra 259 na primeira.

A medição foi feita com gravação ativa. Durante a sessão acrescentamos ao diagnóstico os dois campos de tempo dos clipes. O percurso e as trocas foram repetidos com esses campos. A lógica de movimento e de descarte usada nas três gravações é a mesma. Outros testes de navegador usaram a mesma GPU durante parte do ensaio. O heap após coleta, as contagens do DOM e os recursos do renderizador permitem detectar crescimento no intervalo observado. RAM do processo, VRAM total, bateria, temperatura e comportamento após horas de uso continuam sem medição. [Série temporal, amostras de memória e percentis](evidencias-issue18/etapa2/sessao-10min.json)

## Como repetir

Foram aprovados **60 testes Python**, incluindo TLS com CA temporária em loopback, e **13 testes JavaScript**. Os testes de navegador criam um servidor temporário em `127.0.0.1`, uma porta livre, SQLite novo e senha aleatória para a sessão. O relógio das atividades é sintético. Os dez minutos de renderização usam tempo real. Com Python, Chromium do Playwright, Node e FFmpeg disponíveis, execute na raiz da branch da PR.

```powershell
$env:NODE_PATH = Join-Path $env:TEMP 'davi-redesign-tools/node_modules'
$env:FOREST_EVIDENCE_DIR = Join-Path $env:TEMP ('davi-etapa2-' + [guid]::NewGuid().ToString('N'))
node --test tests/test_forest_navigation.mjs tests/test_visual.cjs
python -m unittest discover -s tests -v
node tests/browser_forest_contacts.cjs
node tests/browser_forest_swaps.cjs
node tests/browser_forest_places.cjs
node tests/browser_forest_shared_place.cjs
node tests/browser_forest_fallback.cjs
node tests/browser_forest_soak.cjs
```

O caso TLS usa `DAVI_TEST_CADDY` apontando para um executável Caddy local. O teste inicia seu próprio processo em loopback com armazenamento temporário e instalação de confiança automática desativada. Uma atualização da homologação LAN depende de autorização específica do responsável.

## Limites para a revisão

Toque e larguras móveis foram exercitados no Chromium de desktop. Os testes físicos no Fire HD 8 (2022), Redmi 8 e LG All in One dependem da disponibilidade da família. A medição dos pés compara o ponto inferior da malha com o apoio debaixo do personagem. O teste não mede contato individual de cada sola em todas as poses. Agendas densas ainda podem ter marcadores sobrepostos visualmente, embora Caminhos permita abrir o destino escolhido. A aprovação artística cabe ao responsável. A rodada usou somente servidores temporários e a branch da PR.

---


## Histórico da rodada parcial em 22ece9f

Rodada encerrada a pedido do responsável. **Não pronta para merge nem homologação final.** A Issue #18 e os quatro comentários de revisão da PR #17 foram lidos integralmente. A avaliação artística anterior foi superada pelo feedback de reprovação da homologação; esta entrega não declara aprovação artística.

## Correções implementadas e evidência

1. **Caminhada substituída por saudação após troca:** `waving` guardava um prazo relativo ao relógio anterior; `open()` zerava `clock`, mas não o prazo. Depois da remontagem, uma saudação antiga podia sobrepor Walk enquanto o avatar se deslocava. O [registro anterior](evidencias-issue18/baseline-bugs.json) mostra `animation: Wave`, `pipoAnimation: Walk` e tecla `right` pressionada. Agora o prazo é reiniciado e deslocamento real tem prioridade sobre Wave. O [smoke atual](evidencias-issue18/smoke-resultado.json) registra Walk depois da mesma troca.
2. **Dois motores ativos:** entrar em 3D não encerrava explicitamente o 2D, pois ambos usavam `state.view=child-world`. Agora a transição aguarda encerramento e salvamento do outro motor. Foram adicionados cancelamento de frame/listeners, limpeza de teclas/alvos, proteção de operações assíncronas por geração e captura/cancelamento de ponteiros. O smoke verifica que o 2D está inativo e sem frame pendente durante o 3D. A hipótese inicial de que o identificador de frame, sozinho, explicava o defeito não se confirmou: `bind()` já zerava esse identificador no 2D; a ausência de encerramento na transição era o problema relevante.
3. **Apoio no terreno e limites:** a fórmula de apoio anterior ignorava o recorte real do riacho. O Blender agora exporta a grade da superfície; o runtime interpola a mesma diagonal dos triângulos renderizados. Uma tabela amostrada da malha animada compensa o deslocamento vertical dos pés. O smoke compara a malha do personagem com um raycast sobre a geometria renderizada na margem, antes de mover. O apoio em movimento ainda precisa de validação extensa em inclinações e ponte; não há promessa de IK completo por pé.
4. **Navegação:** módulo puro de caminhos, segmentos e movimento com colisão, incluindo a restrição da cachoeira que faltava no cliente. Há A* e simplificação de caminho, limite caminhável e deslize em obstáculos. Três testes verificam ponte/água/cachoeira, limites e interpolação da superfície. Câmera e gestos antigos são reiniciados na abertura; a projeção de toque usa matrizes atualizadas.
5. **Recursos:** descarte de materiais e recursos gerados, instancing de geometrias repetidas e remoção de SSAO/bloom. Econômica desliga sombras e limita DPR. Fallback 2D continua no código, mas a suíte completa de fallback/context loss anterior não foi repetida após todas estas alterações.

## Destinos 3D — implementação inicial, validação completa pendente

Foram modelados locais próprios para calendário, oficina, personalização e portal, somados a diário, ponte, casa e baú. Há um marcador 3D reutilizável por atividade, rótulos projetados e caminhos até destinos. “Caminhos” inicia deslocamento até o lugar; não substitui a interação local. Atividades sem roteiro continuam encaminhando à agenda. Os rótulos usam o estado de horário fornecido pelo servidor; confirmar/desfazer permanece nas APIs protegidas da PR #14, sem mudanças nas regras temporais.

**Limitação:** o smoke desta rodada usa agenda sintética vazia para reproduzir a troca e comparar o mesmo enquadramento. Não comprova navegação a todas as estações, colocação de muitos marcadores, todas as atividades ou paridade integral 2D/3D. Essa validação é pendente.

## Antes/depois real

Mesma posição inicial `(0, 0.71)`, sem ponte/casa compradas, mesma aplicação e dados sintéticos. A câmera foi revisada, portanto o enquadramento mudou; não é comparação por pixel nem benchmark equivalente. São capturas reais do navegador, sem composição de imagem gerada.

| Largura | Antes | Prévia atual |
|---|---|---|
| 360 px | [Antes](evidencias-issue18/antes-360.png) | [Depois](evidencias-issue18/depois-360.png) |
| 390 px | [Antes](evidencias-issue18/antes-390.png) | [Depois](evidencias-issue18/depois-390.png) |
| 1366 px | [Antes](evidencias-issue18/antes-1366.png) | [Depois](evidencias-issue18/depois-1366.png) |

Referência consultada: `D:\davi-missoes\docs\modelo.png`; não copiada nem publicada. A referência tem composição concentrada em um desfiladeiro, volumes rochosos ricos, vegetação em camadas, madeira envelhecida e luz suave. A cena anterior tinha copas esparsas, caminho pouco articulado, brilho repetitivo na água e muito custo de pós-processamento. Esta prévia introduz espécies/silhuetas diferentes, copas volumétricas, caminhos ramificados delimitados, bancadas/placas próprias, materiais de madeira menos saturados, margens em tons de rocha e fluxo de água mais discreto.

Ainda há distância perceptível da referência: relevo/rochas simplificados, transições de vegetação, sombra dura e personagens sem uma revisão completa de proporções/rig. A melhoria deve ser julgada pelo responsável; os testes não aprovam o visual. O vídeo antigo do marco visual não demonstra estas alterações. **Vídeo contínuo novo dos destinos ainda não foi produzido.**

## Custo medido e limites

| Item | Base da PR | Prévia atual |
|---|---:|---:|
| Triângulos da floresta exportada | 392.836 | 156.917 |
| Triângulos da ponte exportada | 26.856 | 11.932 |
| Total dos GLBs carregados | 9.183.428 bytes, cinco arquivos | 7.147.168 bytes, seis arquivos, incluindo marcador |

No smoke atual em RTX 2060 SUPER/D3D11: primeira abertura do mundo ~1.581 ms; reabertura ~198 ms. Snapshot detalhado: 175 chamadas, ~333 mil triângulos contando passes, 240 instâncias, ~4,86 MB de buffers de geometria ativos estimados e ~10,49 MB de texels estimados. Esses valores não incluem todos os recursos em cache, driver, buffers internos, framebuffer ou pico de processo. Não são medição completa de VRAM/RAM. Texturas/geometrias e heap quando disponíveis foram expostos em `DaviForest.diagnostics()`.

O número de frames da sessão curta é insuficiente para alegar FPS sustentado. O ensaio longo e as medições de memória/FPS reais em **Fire HD 8 (2022), Redmi 8 (modelo a confirmar) e LG All in One i7 de 3ª geração** estão pendentes. Não havia dispositivos conectados ao ADB, e o responsável informou que só poderá testar depois. Viewport móvel na GPU desktop não equivale a aparelho físico.

## Validação executada nesta rodada

- Python: 60 testes executados, 59 aprovados e TLS real opcional não executado nesta rodada.
- JavaScript: 12 aprovados (nove existentes e três de navegação).
- Playwright smoke: reproduz saudação após troca no código anterior; no atual verifica caminhada, 2D inativo, apoio inicial na geometria renderizada e capturas 360/390/1366. Sem erros JS na sessão curta.
- Validador Khronos: zero erros nos seis GLBs; avisos preservados em `assets/forest/validation.json`.

Para repetir o smoke, com as ferramentas já instaladas fora do projeto:

```powershell
cd D:\davi-issue-16-forest
$env:NODE_PATH = "$env:TEMP/davi-redesign-tools/node_modules"
node tests/browser_issue18_smoke.cjs
node --test tests/test_forest_navigation.mjs tests/test_visual.cjs
python -m unittest discover -s tests -v
```

O smoke cria banco/processo temporários, sem uso da produção. Não executar os scripts de evidência antigos para demonstrar os novos destinos: não os cobrem.

## Próxima rodada

1. Completar E2E de 30 alternâncias com teclas pressionadas, pointer cancel, toque em alvos explícitos, missão/retorno e recarga.
2. Verificar grounding/animação na ponte e inclinações, câmera/frustum e quantidade de recursos após vários ciclos.
3. Navegar a cada estação/atividade; validar agenda sem roteiro, compras/equipamentos, portal, persistência e bloqueios temporais pela UI.
4. Executar dez minutos contínuos e produzir vídeo contínuo novo dos destinos.
5. Reavaliar arte com comparação de ponte/casa construídas e referência; continuar acabamento sem novos efeitos pesados.
6. Atualizar a homologação LAN apenas quando esta revisão estiver suficientemente validada; colher métricas físicas e retorno artístico.

**Isolamento:** main preservada; nenhuma alteração em produção Windows, serviços, certificados, credenciais ou bancos reais. A instância LAN anterior continua na revisão anterior, sem atualização nesta rodada interrompida. Sem merge, deploy de produção ou migração de banco/tecnologia. PR #17 permanece aberta e em rascunho.
