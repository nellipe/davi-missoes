# Etapa 11 — Aventura fora da tela

A campanha parte da Floresta Encantada. Para abrir Praia, Vale e Cidade, o servidor exige a descoberta principal do capítulo anterior e a meta cumulativa definida pelo responsável. A primeira descoberta é virar a folha do besouro no Recanto. Os outros capítulos usam a pérola, o esqueleto e o autômato.

Em **Responsável → Aventura e pausas**, é possível escolher atividades opcionais, mudar as metas, imprimir a semana e aprovar ocorrências já realizadas. A aprovação usa a ocorrência da agenda e mantém um histórico. Medicação, higiene essencial, alimentação e terapias ficam fora da campanha. As metas sugeridas são 3, 6 e 9 conquistas cumulativas.

O padrão de tempo é 15 minutos por sessão, 30 minutos por dia e pausa de 5 minutos. O responsável também pode configurar uma faixa no fuso de São Paulo. Uma única sessão de jogo com limites ativos ocupa a autorização do servidor por vez. Sair da tela de jogo libera a aba ou o aparelho, e o tempo já usado continua registrado. A agenda e o painel do responsável permanecem disponíveis durante a pausa.

O modo de validação é temporário e vinculado à sessão autenticada do responsável. Ele abre os quatro mapas nessa aba e guarda os checkpoints, desafios e descobertas de teste em registros separados. Reiniciar a campanha reabre seus capítulos a partir da Floresta e preserva aprovações, agenda, missões, estrelas, inventário, posições e descobertas dos mapas.

## Navegador e impressão

As evidências foram produzidas em Chromium, em loopback e com SQLite sintético. O relógio do servidor de teste foi avançado de forma controlada para exercitar a pausa.

| Comportamento | Evidência |
| --- | --- |
| Metas editáveis e cuidados essenciais excluídos | [Painel de metas](metas-responsavel.jpg) |
| Quadro com ícones e espaço para marcação física | [Prévia de impressão](quadro-semanal-impressao.jpg) |
| Aprovação de uma atividade do dia anterior | [Ocorrência aprovada](aprovacao-fora-da-tela.jpg) |
| Meta atingida com descoberta ainda pendente | [Seletor de capítulos](capitulos-bloqueados.jpg) · [Portal da Floresta](portal-da-floresta.jpg) · [Portal em 3D](portal-na-floresta-3d.jpg) |
| Descoberta no Recanto, abertura da Praia e encerramento da sessão | [Percurso em vídeo](descoberta-e-pausa.mp4) · [Seletor após a descoberta](praia-desbloqueada.jpg) · [Praia jogável](praia-jogavel.jpg) |
| Limites por sessão, dia, pausa e faixa | [Painel de tempo](limites-responsavel.jpg) |
| Aviso sem contagem regressiva e pausa com agenda acessível | [Aviso durante a partida](aviso-de-pausa.jpg) · [Fim da sessão](fim-da-sessao.jpg) |
| Outra sessão impedida de jogar ao mesmo tempo | [Agenda no celular emulado de 390 px](agenda-em-outro-aparelho.jpg) |
| Prévia do responsável com um capítulo ainda bloqueado para a criança | [Validação na Cidade](validacao-responsavel.jpg) |

O percurso usa Caminhos para chegar ao portal e ao Recanto com Pipo. O toque na agenda foi exercitado em um segundo contexto autenticado, com a sessão principal em jogo. Após o limite, o navegador abriu a agenda e o teste conferiu no SQLite a última posição salva na Praia.

## Regressão automatizada

Os 81 testes Python incluem a campanha completa, as oito microaventuras, a compatibilidade com dados antigos, validação isolada, duplicação de aprovações, faixa noturna, virada do dia, expiração, pausa, retomada e limites compartilhados por abas e aparelhos. Os 30 testes Node verificam navegação, colisões, Pipo, agenda e distribuição de placas.

```powershell
$env:DAVI_TEST_CADDY = 'D:\davi-missoes\publicacao\bin\caddy.exe'
python -m unittest discover -s tests
node --test tests/test_activity_placement.mjs tests/test_visual.cjs tests/test_forest_navigation.mjs tests/test_world_map_navigation.mjs
python tools/forest/record_stage11.py --video --chromium "$env:LOCALAPPDATA\ms-playwright\chromium_headless_shell-1255\chrome-headless-shell-win64\chrome-headless-shell.exe"
python tools/forest/record_stage11.py --portal-3d --chromium "$env:LOCALAPPDATA\ms-playwright\chromium_headless_shell-1255\chrome-headless-shell-win64\chrome-headless-shell.exe"
```

O gravador usa Playwright e Chromium já disponíveis no ambiente de desenvolvimento e FFmpeg para exportar vídeo. O DaviApp instalado continua na revisão que estava em execução antes da Etapa 11.
