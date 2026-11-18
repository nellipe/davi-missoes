# Etapa 3 · A volta dos barquinhos

**Decisão para o responsável.** Diante do varal, dá para escolher um caminho pelo que se vê, encontrar o outro na garganta e reconhecer a roda na volta? Esta versão oferece três regiões para jogar. O Pátio dos Remendos e a Copa da Nascente continuam no desenho das visitas futuras. [Mapa e ritmo revisados](../game-design/visao-aventuras-davi.md)

**Para entrar**, abrir a Floresta Encantada e escolher **Seguir os barquinhos**. **Voltar ao bosque do riacho** dá acesso à clareira com as construções, a oficina, as atividades e os demais destinos da Etapa 2. A preferência de lugar fica no aparelho. A posição da trilha fica no SQLite em uma chave própria da tabela de configurações existente. A ilha e a clareira conservam suas coordenadas compartilhadas anteriores.

## Percurso filmado

O vídeo tem **56 segundos contínuos**, em 1366 × 820, a 24 quadros por segundo. Começa no jogo existente, entra na trilha e usa cliques reais no chão para caminhar. Davi faz a ida pela casca e a volta pelas lajes. O ensaio em retrato fez a ida pelas lajes desde a primeira visita. Os dois começaram com **zero estrelas e inventário vazio**. [Assistir ou baixar o MP4](volta-dos-barquinhos.mp4)

| Trecho aproximado do vídeo | O que observar |
|---|---|
| 0–9 s · Soleira e varal | A roda baixa, a calha e um barco cabem no primeiro olhar. O chão contorna a sebe e a pedra. O mirante está fora de vista. Quando o varal aparece, o caminho escuro com travessas de casca se separa das lajes claras que sobem à direita. [Entrada](soleira-1366.png) · [escolha](bifurcacao-1366.png) |
| 10–22 s · Rota baixa | Davi pede uma pista a Pipo e escolhe a casca. Ao lado do tronco oco há uma saída curta. Virar a folha revela sua face prateada. A mesma ação devolve o lado verde. Quem passar direto ainda pode chegar à garganta. [Trilha](casca-1366.png) · [descoberta](tronco-1366.png) |
| 23–37 s · Garganta | O corredor da casca contorna o maciço central e encontra o fim das lajes. Uma curva de pedra e uma rampa livre levam à janela. A queda passa a ser visível entre as paredes. A origem dos barcos continua sendo um mistério. [Mirante](garganta-1366.png) |
| 38–53 s · Rota alta e volta | As lajes sobem pelo outro lado do maciço. Bater na pedra produz uma resposta visível e, com som habilitado, audível. No retorno, Davi reencontra o mesmo pano e a mesma roda por outro piso. Pipo acompanha e reage ao que a criança escolhe. [Pedra do eco](lajes-1366.png) |
| 54–56 s · Agora | Um toque em **Agora** abre a missão da mochila. Ao sair, a dupla reaparece na posição da interrupção. [Missão aberta](agora-1366.png) |

Em retrato, conferir se a criança consegue ver os **dois pisos** e reconhecer o pano sem pedir instruções. A ajuda de Pipo fica dentro da área de jogo. A câmera pode ser girada e recentralizada pela criança. [360 px](bifurcacao-360.png) · [390 px](bifurcacao-390.png) · [1366 px](bifurcacao-1366.png) · [chegada pela rota alta em 360 px](garganta-360.png)

## O que foi verificado

- **Exploração livre.** Teclado, clique e toque emulado usaram o motor da Etapa 2. As rotas têm chão caminhável distinto e reencontro comum. Colinas, troncos e rochas limitam o que se vê e o que um toque pode selecionar. O teste de entrada conferiu a visibilidade do ponto do mirante. No percurso filmado, a distância horizontal máxima de Pipo foi 1,07 unidade e o maior desvio entre o pé e o terreno amostrado foi 0,016 unidade. [Registro do circuito](resultado-1366.json)
- **Continuidade.** Em retrato, o teste recarregou no bosque, abriu a ilha 2D, entrou na tarefa a partir do 2D, retornou à trilha e chegou à garganta pela rota alta. Conferiu posição, animação, motor 2D inativo durante o 3D e a posição da interrupção ao sair de Agora. O servidor validou trilhas, clareiras e áreas bloqueadas, preservou saldo e coordenadas do mundo original e permitiu a leitura do ponto salvo por outra sessão autorizada. [Registro em retrato](resultado-390.json) · [teste no servidor](../../tests/test_forest.py)
- **Rotina.** Agora consulta a data e as janelas devolvidas pelo servidor. Foram exercitados uma missão aberta, duas atividades simultâneas, atividade aberta sem roteiro, compromisso futuro com confirmação desabilitada e dia livre. A fila da rotina permanece acessível nas duas visões. [Casos de Agora](agora.json)
- **Regressões.** Passaram 61 testes Python, incluindo os horários da PR #14 e TLS em loopback, e 13 testes unitários JavaScript. Repetimos também os 30 ciclos completos da Etapa 2, o percurso dos dez destinos antigos, contatos com árvore, rocha e ponte, recuperação de WebGL e fallback. Todos os ensaios desta entrega usaram servidores temporários em loopback e dados sintéticos.

## Custo e limites

O blockout usa sólidos de baixa complexidade e instâncias de vegetação, pedra e piso. A trilha carrega seu módulo sob demanda e reutiliza os modelos e as animações de Davi e Pipo. Movimento, câmera, cálculo de rotas, foco, cancelamento dos controles e descarte do renderizador continuam compartilhados.

| Chromium com RTX 2060 SUPER, D3D11 | Amostras durante caminhada | p95 dos intervalos amostrados | Máximo de chamadas / triângulos por amostra |
|---|---:|---:|---:|
| 1366 px, qualidade detalhada | 249 | 16,7 ms | 110 / 84.764 |
| 390 e 360 px, qualidade econômica | 105 | 16,7 ms | 58 / 55.044 |

Cada amostra registra o último intervalo do renderizador observado durante o deslocamento. A gravação tem sua própria taxa de quadros. As medições físicas de fluidez, memória e aquecimento no Fire HD 8 (2022), Redmi 8 e LG All in One continuam pendentes. A sessão filmada é uma volta dirigida. O tempo que uma criança vai querer passar investigando, a leitura dos caminhos sem ajuda e o interesse em voltar dependem da observação da família.

## Repetir o percurso de teste

Na branch da PR, com Python, Node, Playwright/Chromium e FFmpeg disponíveis, os comandos abaixo criam novas bases sintéticas. Na máquina de revisão o Playwright está instalado na pasta temporária indicada.

```powershell
$env:NODE_PATH = Join-Path $env:TEMP 'davi-redesign-tools/node_modules'
$env:FOREST_EVIDENCE_DIR = Join-Path $env:TEMP ('davi-trilha-' + [guid]::NewGuid().ToString('N'))
node tests/browser_trail.cjs
node tests/browser_trail.cjs --mobile
node tests/browser_trail_now.cjs
```

A aprovação pedida nesta rodada é a do mapa, das bifurcações e do ritmo de descoberta. O acabamento artístico e a Etapa 4 dependem de outra decisão do responsável.
