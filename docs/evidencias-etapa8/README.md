# Etapa 8 · Soleira, Bosque e tronco oco

O acabamento visual posterior, com quadros do protótipo e vídeos em 360 e 390 px, está no [relatório da Etapa 8A.1](../evidencias-etapa8a1/README.md).

A direção Cartoon Chibi foi integrada à Floresta Encantada jogável da Etapa 7C. Davi usa óculos azuis, mochila laranja e roupa personalizável. Pipo flutua sobre a rota do companheiro com corpo branco, visor turquesa e broto. A câmera livre se aproxima na Soleira e no Bosque. Contornos roxos, sombras suaves, cores toon e Fredoka local aproximam a cena do [HTML cinematográfico](../direcao-arte/chibi-video/referencia-cinematografica.html).

O navegador renderizou a sequência canônica de 0 a 20 segundos. O painel mostra a abertura de frente, a calha e o barco, a travessia e o encontro no tronco. [Painel da referência](referencia-cinematografica.jpg).

## Jogabilidade

O vídeo de 26 segundos começa na Soleira. Davi anda com WASD, solta o barco por toque, segue pelo Bosque, vira a folha com E e vê o besouro trocar de abrigo. Agora abre a missão sintética Mochila de teste. O modo Aprender concede uma estrela pela API e o saldo aparece quando o jogador volta ao tronco. O filme registra o navegador enquanto o Playwright usa os controles do jogo. [Vídeo MP4](jogabilidade.mp4) · [Registro de posição e saldo](jogabilidade.json).

- A água corre na calha e a roda gira durante a passagem do barco. Em modo reduzido, o barco indica partida e chegada. [Calha em uso](barquinho.webp).
- As pedras respondem ao passo sobre a trilha das lajes. As duas rotas originais levam às regiões existentes. O besouro persistente recebe o tratamento expressivo da referência do ouriço. [Folha e besouro](besouro.webp).
- O saldo usa a carteira do servidor. Soltar o barco e virar a folha conservam o saldo. A estrela sobe e o contador pulsa após o crédito real da missão. [Retorno com estrela](estrelas.webp).

## Etapa 7C e Etapa 8 lado a lado

A Etapa 7C em `e035424` ocupa a esquerda de cada imagem. A Etapa 8 ocupa a direita. O ensaio usou a mesma posição, lente, inclinação e rotação nas duas versões. Somente esta comparação fixa a câmera pelo Playwright. A coluna Jogo mostra o enquadramento padrão com a câmera de produção.

| Largura e perfil | Soleira (28, 13,35) | Bosque (30,68, 6,50) | Tronco (19, 1,40) | Jogo |
|---|---|---|---|---|
| 360 px · Econômico | [Comparar](comparacao-360-low-soleira.webp) | [Comparar](comparacao-360-low-bosque.webp) | [Comparar](comparacao-360-low-tronco.webp) | [Abrir](jogo-360-low.webp) |
| 360 px · Detalhado | [Comparar](comparacao-360-high-soleira.webp) | [Comparar](comparacao-360-high-bosque.webp) | [Comparar](comparacao-360-high-tronco.webp) | [Abrir](jogo-360-high.webp) |
| 390 px · Econômico | [Comparar](comparacao-390-low-soleira.webp) | [Comparar](comparacao-390-low-bosque.webp) | [Comparar](comparacao-390-low-tronco.webp) | [Abrir](jogo-390-low.webp) |
| 390 px · Detalhado | [Comparar](comparacao-390-high-soleira.webp) | [Comparar](comparacao-390-high-bosque.webp) | [Comparar](comparacao-390-high-tronco.webp) | [Abrir](jogo-390-high.webp) |
| 1366 px · Econômico | [Comparar](comparacao-1366-low-soleira.webp) | [Comparar](comparacao-1366-low-bosque.webp) | [Comparar](comparacao-1366-low-tronco.webp) | [Abrir](jogo-1366-low.webp) |
| 1366 px · Detalhado | [Comparar](comparacao-1366-high-soleira.webp) | [Comparar](comparacao-1366-high-bosque.webp) | [Comparar](comparacao-1366-high-tronco.webp) | [Abrir](jogo-1366-high.webp) |

## Medições

Chromium em Windows com ANGLE/D3D11 e RTX 2060 SUPER, DPR de 0,83 no Econômico e 1 no Detalhado. Em cada ponto, foram colhidos 45 quadros depois dos quadros iniciais. Ambos os builds ficaram em aproximadamente 60 FPS, com p95 entre 16,7 e 16,8 ms. Os arquivos incluem também os tempos de abertura, buffers de geometria, estimativas de texturas e heap JavaScript exposto pelo navegador. O heap variou entre sessões e a estimativa de texturas não representa a VRAM total. [Etapa 7C](medicoes-etapa7c.json) · [Etapa 8](medicoes-etapa8.json).

| 1366 px | Soleira | Bosque | Tronco |
|---|---|---|---|
| Econômico · chamadas de desenho | 81 → 90 | 82 → 87 | 89 → 94 |
| Econômico · triângulos | 123.050 → 136.886 | 144.076 → 157.148 | 120.884 → 134.044 |
| Detalhado · chamadas de desenho | 149 → 153 | 152 → 152 | 155 → 155 |
| Detalhado · triângulos | 260.090 → 273.996 | 290.256 → 303.398 | 253.892 → 267.122 |

O maior aumento medido de geometria na comparação foi de 13.906 triângulos na Soleira. As texturas estimadas passaram de 3,76 MB para 2,28 MB. O Detalhado continua acima da meta indicativa de 150 mil triângulos. Fire HD 8 2022, Redmi 8 e LG All-in-One ainda aguardam avaliação física, inclusive de fluidez e toque.

## Testes e reprodução

- Passaram 64 testes Python, incluindo TLS em loopback, e 13 testes Node. As suítes cobrem agenda, horários, SQLite, missões, economia, compra, revogação, personalização, autorização e navegação.
- No Chromium, o teste da Etapa 8 abrange seis combinações de largura e qualidade, auditoria axe, alvos de 48 px, teclado, toque, giro por arrasto e acesso somente à origem local. A trilha das lajes confirma a reação da pedra e a chegada por toque.
- A regressão do jogo percorreu o mapa no mesmo canvas, visitou os dez destinos, confirmou colisões e apoio, exercitou a oficina e o vestuário, e conferiu Agora com tarefas com e sem roteiro. [Circuito](regioes-1366-high.json) · [Agora](agora.json).
- Trinta alternâncias preservaram posição e controles nos dois modos. O teste de perda do contexto confirmou retorno pelo fallback WebGL. [Alternâncias](alternancias.json) · [Fallback](fallback.json).
- O teste de movimento confirmou flutuação, corrente em movimento, água estática em modo reduzido e chegada visível do barco nos dois modos. [Registro de movimento](movimento-390.json).
- Os GLBs de Davi, Pipo e Bosque foram exportados com Blender 4.5.9 LTS. O validador glTF registrou zero erros e manteve os avisos de exportação para revisão. [Fontes e comandos](../../assets/forest/README.md) · [Validação](../../assets/forest/validation.json).

Os testes usam loopback e bancos sintéticos descartáveis. Com Playwright, Chromium, axe e FFmpeg disponíveis e `FOREST_EVIDENCE_DIR` apontando para um diretório temporário, rode `node tests/browser_forest_chibi.cjs` para gravar o percurso ou acrescente `native` para refazer as capturas e a auditoria. Para medidas comparativas, rode `node tests/browser_forest_chibi.cjs compare <checkout> <nome>` em cada revisão. Esta entrega cobre Soleira, Bosque e tronco oco. A expansão artística das demais regiões fica para depois da avaliação visual.
