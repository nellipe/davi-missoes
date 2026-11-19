# Marco visual — Floresta Encantada

Esta é a proposta visual para avaliação da Issue #16, a partir da main com a PR #14 integrada. A aprovação artística continua pendente. Os outros quatro mundos não foram criados neste ramo.

**[Vídeo de gameplay — MP4](gameplay.mp4)** · **[Comparação lado a lado](comparacao.html)**

O vídeo é uma gravação contínua da aplicação, controlada por teclado: caminhada com Pipo, aproximação e abertura de missão, retorno ao bosque, compra/travessia da ponte e construção/interação com a casa. Não é vídeo gerado a partir de imagens. O banco, os compromissos e o crédito inicial usados na gravação são exclusivamente sintéticos.

| Avaliação | Evidência |
| --- | --- |
| Desktop | [Floresta em 1366 px](floresta-1366.png) |
| Celular | [390 px](floresta-390.png) · [360 px](floresta-360.png) |
| Mudança após construir | [Antes](antes-de-construir-1366.png) · [Casa desbloqueada](casa-desbloqueada-1366.png) |
| Riacho e desníveis | [Vista da queda d’água](cachoeira-1366.png) |
| Personagens | [Davi e Pipo, câmera próxima](davi-pipo-1366.png) |
| Missões existentes | [Entrada na missão](missao-preservada-1366.png) |
| Fallback preservado | [Ilha 2D](fallback-2d-390.png) |
| Padrão anterior não aprovado | [Floresta da PR #15](anterior-pr15-1366.png) |

Comparação explícita: a PR #15 usa uma ilha com formas geométricas simples e objetos espaçados. A nova proposta usa terreno e leito rochoso, mata em camadas, folhas/frondes modeladas, ponte com tábuas/vigas/cordas, madeira texturizada, casa com telhas/varanda/janela, roupas e personagens articulados. A composição busca uma trilha de aventura ao redor do riacho. A referência indicada pelo responsável foi usada para orientar riqueza, atmosfera e câmera, sem copiar o mapa ou os personagens.

A pergunta de aprovação é visual: **“isso parece um jogo que encanta uma criança?”** As capturas não representam aprovação já obtida.

## Medição e limites

Navegador Chromium 159, WebGL2 com **GPU real**, confirmado como ANGLE NVIDIA / D3D11. Máquina Windows: Ryzen 7 5700X, 48 GiB RAM, RTX 2060 SUPER com 8 GiB VRAM, driver 610.88. O relatório registra amostras de intervalos entre frames, mediana e p95; aproximadamente 16,7 ms na execução registrada. O vídeo é codificado a 25 FPS e não deve ser confundido com a taxa de renderização medida.

Os tamanhos 360/390 são viewports com toque na mesma máquina, **não um benchmark de celular físico**. Há qualidade automática/econômica, redução de resolução e pós-processamento, sombras menores e fallback 2D. Validação física em aparelhos medianos permanece necessária. Copas próximas abrem passagem à câmera para manter os personagens visíveis; a casa possui área de colisão para evitar caminhar sob a varanda.

[Resultado dos fluxos e medições](resultado.json). Sem erros JavaScript, requisições externas ou overflow nos cenários verificados; checagens axe WCAG A/AA nas vistas capturadas. Isso complementa, sem substituir, avaliação com leitor de tela e uso real pela família.

## Autoria e reprodução

Assets GLB locais, cena editável Blender e fonte reproduzível: [assets/forest](../../assets/forest/README.md). Validação oficial Khronos: zero erros; avisos do exportador estão preservados em validation.json. Nenhum render estático da referência é usado como cenário.

`python -m unittest discover -s tests -v`

`node --test tests/test_visual.cjs`

`node tests/browser_forest.cjs` com Playwright, axe e FFmpeg nas ferramentas de desenvolvimento; o script cria e remove seu banco temporário e grava novamente estas evidências. O teste exige GPU NVIDIA para não confundir a medição com SwiftShader. Os serviços Windows e a agenda da família não são utilizados.
