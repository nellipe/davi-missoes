# Etapa 10 — Floresta unificada e placas de eventos

Capturas da mesma instalação e do mesmo checkout, com um SQLite sintético e 18 compromissos no dia principal de teste. O antes foi registrado na revisão `a5e7452`, base inicial desta PR. A coluna 3D mostra a câmera normal de entrada no mundo em 1366 × 820, com o perfil Econômico. A coluna 2D enquadra o mapa inteiro para comparar as posições. O relógio fixo nas capturas de depois permite mostrar vários estados de horário. Os percursos gravados usam a câmera do jogo e controles reais do Chromium.

| Mundo | Vista 3D | Vista 2D |
| --- | --- | --- |
| Floresta Encantada | [Antes](forest-antes-3d.jpg) · [Depois](forest-depois-3d.jpg) | [Antes](forest-antes-2d.jpg) · [Depois](forest-depois-2d.jpg) |
| Praia dos Tesouros | [Antes](praia-antes-3d.jpg) · [Depois](praia-depois-3d.jpg) | [Antes](praia-antes-2d.jpg) · [Depois](praia-depois-2d.jpg) |
| Vale dos Dinossauros | [Antes](dinossauros-antes-3d.jpg) · [Depois](dinossauros-depois-3d.jpg) | [Antes](dinossauros-antes-2d.jpg) · [Depois](dinossauros-depois-2d.jpg) |
| Cidade dos Inventores | [Antes](inventores-antes-3d.jpg) · [Depois](inventores-depois-3d.jpg) | [Antes](inventores-antes-2d.jpg) · [Depois](inventores-depois-2d.jpg) |

## Percursos gravados

- **Desktop** — andar com WASD, girar a câmera, usar Caminhos para chegar à placa com Pipo, pressionar **E**, abrir o compromisso na agenda e voltar à Floresta na vista 2D. [Vídeo MP4](percurso-desktop.mp4)
- **Celular emulado, 390 px** — escolher Praia, Vale e Cidade, tocar em Caminhos e na placa de cada mundo, abrir o compromisso correspondente na agenda e voltar à Floresta. [Vídeo MP4](percurso-toque-390.mp4) · [Captura da Praia](praia-390-vista-2d.jpg)
- **Celular emulado, 360 px** — comprar construções e acessórios com o saldo de teste, trocar a roupa e equipar os itens de Davi e Pipo. [Captura do guarda-roupa](forest-360-personagem.jpg)

## Distribuição das placas

| Mundo | Setores com placas | Distância mínima antes | Distância mínima depois |
| --- | ---: | ---: | ---: |
| Floresta Encantada | 6 | 1,00 | 4,33 |
| Praia dos Tesouros | 4 | 1,00 | 7,83 |
| Vale dos Dinossauros | 4 | 1,00 | 8,84 |
| Cidade dos Inventores | 4 | 1,00 | 9,50 |

Cada mundo manteve 18 destinos únicos e alcançáveis com o validador de movimento antes e depois da compra de todas as construções. O teste em Chromium fez 30 alternâncias, verificou a posição de Davi e Pipo e a orientação da câmera ao voltar ao 3D. Também verificou os destinos após recarga e troca da data da agenda. Na Floresta, Davi e Pipo atravessaram a ponte comprada e permaneceram na outra margem após a troca para 2D.

Os testes de integração usam contas sintéticas para validar as preferências antigas, o inventário, os horários, as rotas da agenda e a reabertura de uma missão com roteiro. Com WebGL desabilitado, cada mundo abre sua própria vista 2D. Com o módulo do mundo indisponível, a agenda permanece utilizável.

## Reproduzir

Execute a partir da raiz do checkout com as dependências já disponíveis. O gravador usa Playwright para Python, Chromium e FFmpeg.

```powershell
$env:DAVI_TEST_CADDY = 'D:\davi-missoes\publicacao\bin\caddy.exe'
python -m unittest discover -s tests
node --test tests/test_activity_placement.mjs tests/test_visual.cjs tests/test_forest_navigation.mjs tests/test_world_map_navigation.mjs
python tools/forest/record_stage10.py --chromium "$env:LOCALAPPDATA\ms-playwright\chromium_headless_shell-1255\chrome-headless-shell-win64\chrome-headless-shell.exe"
```

Os 30 testes Node incluem a distribuição de 12 e 20 compromissos nos quatro mapas e a adaptação da distância com uma grade sintética lotada. Os 74 testes Python incluem as oito microaventuras, as janelas reais de confirmação, a troca de saldo e a compatibilidade dos dados antigos.
