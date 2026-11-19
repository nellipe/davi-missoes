# Etapa 8C · Exploração livre na Floresta Cartoon Chibi

A [revisão da PR #19](https://github.com/nellipe/davi-missoes/pull/19#issuecomment-7012733305) registrou problemas de movimento, colisão e acompanhamento. A revisão de partida foi `5abdf765ecdeaa93b8eb6cd8b7b71d1649bc4dfe`, confirmada pelo HTTPS da instalação familiar antes da correção. Os ensaios usaram SQLite sintético em servidores temporários.

## Reprodução e correção

| Defeito | Reprodução na base | Correção |
|---|---|---|
| Limite invisível | O validador bloqueava `(28, 10)`, na grama livre da Soleira | As trilhas continuam desenhadas sobre uma área navegável definida pela altura do terreno, pela água e pelos sólidos |
| Pipo parado | O avanço direto de `(29; 12)` até `(24; 3,1)` ficava a 9,54 unidades do alvo após 600 iterações | O seguidor planeja desvios, monitora progresso e retoma ao lado de Davi quando a rota falha. Se estiver visível, encolhe antes de reaparecer |
| Rocha atravessável | Dois grandes afloramentos de `Região:Ardosia` entre a Garganta e o Pátio tinham centros caminháveis perto de `(30,08; −8,44)` e `(32,76; −8,78)`. As escalas `(x, y, z)` eram `(1,20; 1,01; 0,91)` e `(1,45; 1,54; 1,00)` | As duas ardósias passaram para a lateral da rota e receberam colisores derivados das malhas. A terceira ardósia da composição também tem colisão. O trajeto continua após a bancada até a Copa da Nascente |

O [manifesto de terreno e obstáculos](../../assets/forest/obstacles.json) contém 216 contornos simplificados e uma grade de solo de 0,25 unidade. O gerador usa as posições e escalas que o jogo aplica às malhas. O raio de Davi entra na verificação dos sólidos. A ponte continua necessária para atingir a outra margem na Clareira. O mapa 2D desenha os mesmos pisos e obstáculos e usa a mesma movimentação do 3D. Um checkpoint antigo dentro de um sólido é apresentado em chão seguro próximo, sem gravar uma posição nova até Davi se mover.

O afloramento a leste da bancada, perto de `(47,74; −9,81)` e `(48,10; −7,95)`, ficou na lateral da subida para a Copa. Os dois centros são recusados pelo servidor e a subida continua acessível pela rota sinalizada.

## Jogabilidade gravada

Cada vídeo começa com Davi próximo da ardósia. O direcional ou WASD encontra a rocha. Um toque ou clique na pedra não desloca Davi, e tocar ou clicar do outro lado inicia o desvio. A segunda parte mostra a saída da bancada com Pipo, exploração fora da trilha, recarga, volta de uma missão e alternância entre 2D e 3D. Os checkpoints da ardósia, da bancada e da Soleira são preparados com a API do servidor sintético. Todo o movimento entre eles usa os controles do jogo.

| Largura | Perfil | Jogabilidade | Diagnóstico |
|---|---|---|---|
| 360 px | Econômico | [Vídeo](exploracao-360-low.mp4) | [JSON](exploracao-360-low.json) |
| 390 px | Econômico | [Vídeo](exploracao-390-low.mp4) | [JSON](exploracao-390-low.json) |
| 1366 px | Detalhado | [Vídeo](exploracao-1366-high.mp4) | [JSON](exploracao-1366-high.json) |

Em cada gravação, Pipo recalculou a rota depois da bancada. A recuperação quando uma barreira separa os dois foi ensaiada também com um mapa sintético desconectado. JavaScript e Python coincidiram em 25.632 verificações de coordenadas com e sem ponte e casa. A volta contínua percorreu as duas rotas, do Riacho até a Copa e de volta à Clareira.

## Métricas no computador de teste

| Largura | FPS nos checkpoints 3D | Maior p95 | Maior número de chamadas / triângulos | Primeira abertura |
|---|---:|---:|---:|---:|
| 360 px | 50,0–60,0 | 16,8 ms | 67 / 173.574 | 994 ms |
| 390 px | 52,9–60,0 | 16,8 ms | 68 / 173.718 | 927 ms |
| 1366 px | 60,0 | 16,8 ms | 125 / 313.832 | 1.609 ms |

O maior afastamento medido nos checkpoints 3D foi 0,96 unidade. Em 200 buscas de rota alternadas entre a volta da ardósia e o percurso da Soleira à Copa, o planejador local registrou 1,20 ms de mediana e 2,36 ms de p95. As medições representam a máquina de teste. O desempenho nos dispositivos da família segue pendente.

## Reprodução dos ensaios

Use Node.js 24 para gerar o manifesto a partir dos GLBs e do cenário procedural. Repita a geração após mover um sólido ou alterar o terreno. O executável do jogo usa os arquivos versionados.

```powershell
node tools/forest/build_collision.mjs
node tools/forest/build_collision.mjs --check
node --test tests/test_forest_navigation.mjs
python -B -m unittest discover -s tests -q
```

A captura usa Chromium via Playwright e FFmpeg em loopback, com `FOREST_RECORD=1` e `FOREST_EVIDENCE_DIR` apontando para uma pasta de saída. Execute `node tests/browser_forest_free_roam.cjs <largura>` para cada largura da tabela. Os quadros de vídeo são codificados a 20 FPS. Os dados de FPS e p95 do jogo vêm dos 30 quadros de renderização mais recentes de cada checkpoint. As larguras móveis foram testadas com entradas de toque em um computador com RTX 2060 SUPER.

Também passaram os ensaios de volta contínua, retorno ao abrigo do besouro, fallback, personagens chibi, marcadores coincidentes, Agora, horários, editor e execução de missões, minijogos, economia, construções, vestuário e retomada em outro navegador.
