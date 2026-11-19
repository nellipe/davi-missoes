# Etapa 8D.0 · Ouriço do tronco e besouro da folha

[Ajuste final do recanto com comparativos em 360 e 1366 px e vídeo](ajuste-final/README.md).

O quadro de 19,5 s do HTML cinematográfico mostra o ouriço já à frente da boca do tronco, com focinho, olhos e espinhos legíveis. A folha ocupa um plano separado, ao nível do chão. A correção traz as duas descobertas para a Floresta jogável. [Sequência do HTML entre 18 e 20 s](sequencia-html-18-a-20.webp) · [Referência à esquerda e jogo real à direita](referencia-19-5-e-jogo.webp) · [Solicitação na PR #19](https://github.com/nellipe/davi-missoes/pull/19#issuecomment-7017576971).

O ouriço sai ao notar Davi, olha para o jogador e permanece à frente da abertura durante a descoberta. O modelo toon tem olhos com brilho, focinho, bochechas, patas, orelhas e espinhos. As peças são agrupadas em três malhas, com contorno seletivo. O tronco foi recolocado e girado para mostrar a saída, e seu colisor foi regenerado a partir da malha e da nova posição.

A folha está mais baixa e à frente, com dois abrigos em chão livre. Virá-la ainda redireciona a goteira e faz o besouro carregar a folha pequena até o abrigo alternativo. A preferência persistida continua sendo o mesmo estado da folha. Os animais podem dar um passo curto para o lado quando Davi ou Pipo encobre a linha de visão, desde que o desvio esteja em chão caminhável. Pipo segue pelo planejador, assume uma posição lateral quando há espaço e olha para a câmera ao parar no recanto. A câmera acompanha os pontos da descoberta durante a chegada e continua girável.

## Jogabilidade real

Os vídeos usam dados sintéticos e o HUD normal. A posição inicial fica na trilha antes da zona de descoberta. No desktop a aproximação usa WASD e clique no chão, seguida de `E` na folha. Nas larguras móveis a aproximação e a folha usam toque. Os vídeos também mostram o giro, a volta de uma missão e a alternância com a vista 2D.

| Captura | 360 px · Econômico | 390 px · Econômico | 1366 px · Detalhado |
|---|---|---|---|
| Chegada | [360](recanto-360-chegada.webp) | [390](recanto-390-chegada.webp) | [1366](recanto-1366-chegada.webp) |
| Ouriço saindo do tronco | [360](recanto-360-saida.webp) | [390](recanto-390-saida.webp) | [1366](recanto-1366-saida.webp) |
| Encontro antes de tocar na folha | [360](recanto-360-encontro.webp) | [390](recanto-390-encontro.webp) | [1366](recanto-1366-encontro.webp) |
| Besouro carregando a folha | [360](recanto-360-besouro-em-movimento.webp) | [390](recanto-390-besouro-em-movimento.webp) | [1366](recanto-1366-besouro-em-movimento.webp) |
| Folha virada, os dois animais à vista | [360](recanto-360-apos-interacao.webp) | [390](recanto-390-apos-interacao.webp) | [1366](recanto-1366-apos-interacao.webp) |
| Giro à esquerda | [360](recanto-360-esquerda.webp) | [390](recanto-390-esquerda.webp) | [1366](recanto-1366-esquerda.webp) |
| Giro à direita | [360](recanto-360-direita.webp) | [390](recanto-390-direita.webp) | [1366](recanto-1366-direita.webp) |
| Retorno com a folha persistida | [360](recanto-360-retorno.webp) | [390](recanto-390-retorno.webp) | [1366](recanto-1366-retorno.webp) |
| Outro abrigo após virar de volta | [360](recanto-360-outro-abrigo.webp) | [390](recanto-390-outro-abrigo.webp) | [1366](recanto-1366-outro-abrigo.webp) |
| Vídeo e diagnóstico | [Vídeo](recanto-360.mp4) · [JSON](recanto-360.json) | [Vídeo](recanto-390.mp4) · [JSON](recanto-390.json) | [Vídeo](recanto-1366.mp4) · [JSON](recanto-1366.json) |

## Verificação

As linhas de visão foram medidas no navegador entre a câmera e três pontos de cada animal, com Davi, Pipo, tronco e terreno considerados para detectar oclusões. Nas três larguras, os três pontos de ambos ficaram livres na captura da saída e na cena após virar a folha. Nas capturas laterais, ao menos dois pontos de cada animal ficaram livres e dentro do quadro. Também foi verificado que o local de saída do ouriço e os dois abrigos estão em chão caminhável, com o interior do tronco sólido.

O teste gravado confirma os dois abrigos e a posição após recarregar, voltar da missão e alternar entre 2D e 3D. O saldo sintético permanece o mesmo. O manifesto de colisões conserva 216 sólidos. As três gravações usam Chromium em um computador com RTX 2060 SUPER. Os números de quadro nos JSONs são dessas execuções, sem equivalência com medições físicas nos dispositivos da família.

Para reproduzir, use Node.js com Playwright, Chromium e FFmpeg disponíveis. Defina `FOREST_RECORD=1` e `FOREST_EVIDENCE_DIR` para uma pasta de saída, e execute `node tests/browser_recanto.cjs` com cada largura, `360`, `390` e `1366`. O comparativo usa o quadro de 19,5 s do HTML canônico renderizado via `renderAt(19.5)` e a captura de 1366 px após a interação.

A PR permanece em rascunho para avaliação visual do responsável.
