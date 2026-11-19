# Ajuste final do recanto · Etapa 8D.0

Davi chega pelo lado mais largo do recanto. A clareira gramada acomoda Pipo, a folha e os dois abrigos antes da descida do terreno. A folha curva acompanha o chão e inclina para redirecionar a goteira. O besouro atravessa a grama entre os abrigos. O ouriço conserva o modelo, o movimento e a saída pela abertura original do tronco. [Revisão na PR #19](https://github.com/nellipe/davi-missoes/pull/19#issuecomment-7019080598) · [Sequência cinematográfica original, 18 a 20 s](../sequencia-html-18-a-20.webp).

## Capturas e vídeo

Cada imagem usa a captura da base `45d345a` à esquerda e a do ajuste à direita, com HUD e câmera normais. As capturas e a gravação foram feitas no Chromium com dados sintéticos.

| Momento | 360 px · Econômico | 1366 px · Detalhado |
| --- | --- | --- |
| Saída do ouriço | [Antes e depois](360-saida.webp) | [Antes e depois](1366-saida.webp) |
| Encontro com a folha e o besouro | [Antes e depois](360-encontro.webp) | [Antes e depois](1366-encontro.webp) |
| Folha virada e besouro no outro abrigo | [Antes e depois](360-apos-interacao.webp) | [Antes e depois](1366-apos-interacao.webp) |
| Giro lateral pelo controle do jogo | [Antes e depois](360-direita.webp) | [Antes e depois](1366-direita.webp) |

[Vídeo de jogabilidade em 360 px (MP4, 9,55 s)](recanto-360-jogabilidade.mp4). O toque no chão inicia a aproximação. O ouriço sai, o toque na folha alterna a goteira e o besouro chega ao outro abrigo antes dos giros de câmera.

## Verificações dirigidas

- No navegador, Davi chegou à clareira com Pipo por toque em 360 px e por teclado e clique em 1366 px. O besouro ficou em terreno caminhável durante a troca. Os três pontos de visibilidade do rosto de cada animal passaram nas duas larguras no encontro, após a interação e nos dois giros laterais.
- A posição de Davi e o abrigo ativo foram retomados após recarga e volta de missão. A troca 2D/3D manteve a posição e refletiu o estado da folha. A interação alternou os dois abrigos sem consumir estrelas.
- O manifesto regenerado mantém o tronco, a árvore e a rocha como obstáculos e libera o chão dos antigos suportes da folha. Os testes confirmaram passagem até a clareira, circulação ao redor dos abrigos, bloqueio do barranco e do tronco, continuidade das duas rotas e concordância com a validação Python.
