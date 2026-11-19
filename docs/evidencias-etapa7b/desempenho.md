# Desempenho · Etapa 7 → Etapa 7B

Chromium via ANGLE/D3D11 em Windows com RTX 2060 SUPER. Base `05d4904` e revisão 7B em checkouts separados, com cenas e bancos sintéticos iguais. São oito pontos por largura e perfil, incluindo a passagem entre as duas margens. O p95 vem da janela dos últimos 30 quadros de cada ponto. As chamadas incluem passes de sombra. Buffers e texturas são valores estimados da cena, sem a memória total do navegador ou do driver.

**390 px em Econômico.** Na passagem, 173.136 → 172.608 triângulos e 78 → 81 chamadas. No recanto, 119.154 → 119.852 triângulos e 85 → 90 chamadas. Na bifurcação, 136.738 → 135.666 triângulos e 73 → 79 chamadas. O perfil continua com DPR interno de 0,83 na máquina medida.

**1366 px em Detalhado.** A passagem subiu de 266 para 302 chamadas e de 468.012 para 475.788 triângulos. É o trecho mais caro desta revisão. As malhas extras de árvore, pedra e vegetação adicionam chamadas, especialmente com sombras. Nos pontos com a trilha carregada, os buffers passaram de aproximadamente 5,39 para 5,66 MiB e as texturas permaneceram em cerca de 3,59 MiB. A abertura oscilou entre os ensaios isolados.

Os resultados de aproximadamente 60 FPS em janelas curtas descrevem o desktop de ensaio. A meta de 25 a 30 FPS sustentáveis no Fire HD 8 e Redmi 8 e a seleção de perfil no LG dependem de medições físicas.

| Largura e perfil | Mediana das aberturas por região (ms) | Mediana dos primeiros GLBs por região (ms) |
|---|---:|---:|
| 360 px · Econômico | 461 → 479 | 179 → 180 |
| 360 px · Detalhado | 476 → 489 | 176 → 175 |
| 390 px · Econômico | 424 → 630 | 167 → 210 |
| 390 px · Detalhado | 819 → 805 | 300 → 288 |
| 1366 px · Econômico | 734 → 649 | 264 → 223 |
| 1366 px · Detalhado | 692 → 591 | 246 → 211 |

Em uma repetição sequencial do perfil Econômico em 390 px, a mediana da abertura ficou em **457 → 453 ms** e a do primeiro lote GLB em **170 → 173 ms**. A variação entre rodadas limita a interpretação dos tempos de abertura. [Repetição da base](abertura-repetida-base-390-low.json) · [Repetição da Etapa 7B](abertura-repetida-390-low.json)

## 360 px · Econômico

[Amostra da Etapa 7](base-360-low.json) · [Amostra da Etapa 7B](regioes-360-low.json)

| Região | Triângulos | Chamadas | FPS | p95 (ms) | Abertura (ms) | Primeiro lote GLB (ms) | Buffers (MiB) | Texturas (MiB) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Clareira | 122.718 → 121.670 | 66 → 69 | 60,0 → 60,0 | 16,7 → 16,7 | 362 → 340 | 97 → 87 | 4,27 → 4,38 | 2,84 → 2,84 |
| Passagem | 173.088 → 172.608 | 77 → 81 | 60,0 → 60,0 | 16,7 → 16,7 | 770 → 710 | 180 → 152 | 5,39 → 5,66 | 3,59 → 3,59 |
| Soleira | 110.432 → 113.330 | 74 → 78 | 60,0 → 60,0 | 16,8 → 16,7 | 497 → 489 | 205 → 192 | 5,39 → 5,66 | 3,59 → 3,59 |
| Bosque | 130.876 → 134.102 | 71 → 77 | 60,0 → 60,0 | 16,7 → 16,7 | 460 → 538 | 180 → 208 | 5,39 → 5,66 | 3,59 → 3,59 |
| Recanto do besouro | 119.154 → 119.660 | 85 → 89 | 60,0 → 60,0 | 16,8 → 16,7 | 504 → 558 | 178 → 194 | 5,39 → 5,66 | 3,59 → 3,59 |
| Garganta | 78.294 → 79.222 | 39 → 42 | 60,0 → 60,0 | 16,8 → 16,7 | 417 → 424 | 178 → 168 | 5,39 → 5,66 | 3,59 → 3,59 |
| Pátio | 96.036 → 96.738 | 58 → 62 | 60,0 → 60,0 | 16,7 → 16,7 | 462 → 469 | 175 → 169 | 5,39 → 5,66 | 3,59 → 3,59 |
| Copa da Nascente | 109.598 → 108.350 | 77 → 81 | 60,0 → 60,0 | 16,7 → 16,7 | 431 → 439 | 193 → 192 | 5,39 → 5,66 | 3,59 → 3,59 |

## 360 px · Detalhado

[Amostra da Etapa 7](base-360-high.json) · [Amostra da Etapa 7B](regioes-360-high.json)

| Região | Triângulos | Chamadas | FPS | p95 (ms) | Abertura (ms) | Primeiro lote GLB (ms) | Buffers (MiB) | Texturas (MiB) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Clareira | 279.771 → 282.531 | 166 → 184 | 60,0 → 60,0 | 16,7 → 16,7 | 1.417 → 1.310 | 90 → 81 | 4,27 → 4,38 | 2,84 → 2,84 |
| Passagem | 453.173 → 458.981 | 211 → 238 | 60,0 → 60,0 | 16,8 → 16,8 | 1.073 → 1.116 | 200 → 194 | 5,39 → 5,66 | 3,59 → 3,59 |
| Soleira | 239.914 → 249.210 | 144 → 155 | 60,0 → 60,0 | 16,7 → 16,8 | 485 → 462 | 184 → 169 | 5,39 → 5,66 | 3,59 → 3,59 |
| Bosque | 264.518 → 276.622 | 142 → 155 | 60,0 → 60,0 | 16,8 → 16,8 | 466 → 465 | 176 → 180 | 5,39 → 5,66 | 3,59 → 3,59 |
| Recanto do besouro | 250.164 → 254.620 | 154 → 165 | 60,0 → 60,0 | 16,8 → 16,7 | 545 → 557 | 180 → 168 | 5,39 → 5,66 | 3,59 → 3,59 |
| Garganta | 121.142 → 125.046 | 71 → 75 | 60,0 → 60,0 | 16,7 → 16,7 | 436 → 495 | 176 → 196 | 5,39 → 5,66 | 3,59 → 3,59 |
| Pátio | 145.052 → 144.234 | 91 → 95 | 60,0 → 60,0 | 16,7 → 16,7 | 440 → 484 | 172 → 189 | 5,39 → 5,66 | 3,59 → 3,59 |
| Copa da Nascente | 160.006 → 160.898 | 110 → 115 | 60,0 → 60,0 | 16,8 → 16,7 | 432 → 453 | 168 → 171 | 5,39 → 5,66 | 3,59 → 3,59 |

## 390 px · Econômico

[Amostra da Etapa 7](base-390-low.json) · [Amostra da Etapa 7B](regioes-390-low.json)

| Região | Triângulos | Chamadas | FPS | p95 (ms) | Abertura (ms) | Primeiro lote GLB (ms) | Buffers (MiB) | Texturas (MiB) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Clareira | 122.718 → 121.670 | 66 → 69 | 60,0 → 58,1 | 16,7 → 16,8 | 316 → 333 | 78 → 100 | 4,27 → 4,38 | 2,84 → 2,84 |
| Passagem | 173.136 → 172.608 | 78 → 81 | 60,0 → 60,0 | 16,8 → 16,8 | 635 → 712 | 142 → 171 | 5,39 → 5,66 | 3,59 → 3,59 |
| Soleira | 110.556 → 113.330 | 75 → 78 | 60,0 → 60,0 | 16,8 → 16,8 | 460 → 644 | 172 → 201 | 5,39 → 5,66 | 3,59 → 3,59 |
| Bosque | 136.738 → 135.666 | 73 → 79 | 60,0 → 60,0 | 16,7 → 16,8 | 422 → 533 | 180 → 206 | 5,39 → 5,66 | 3,59 → 3,59 |
| Recanto do besouro | 119.154 → 119.852 | 85 → 90 | 60,0 → 60,0 | 16,8 → 16,7 | 427 → 889 | 165 → 466 | 5,39 → 5,66 | 3,59 → 3,59 |
| Garganta | 78.294 → 79.222 | 39 → 42 | 60,0 → 60,0 | 16,7 → 16,7 | 396 → 486 | 169 → 214 | 5,39 → 5,66 | 3,59 → 3,59 |
| Pátio | 96.036 → 96.738 | 58 → 62 | 60,0 → 60,0 | 16,8 → 16,8 | 468 → 802 | 182 → 327 | 5,39 → 5,66 | 3,59 → 3,59 |
| Copa da Nascente | 109.742 → 108.494 | 78 → 82 | 60,0 → 60,0 | 16,8 → 16,7 | 407 → 615 | 165 → 253 | 5,39 → 5,66 | 3,59 → 3,59 |

## 390 px · Detalhado

[Amostra da Etapa 7](base-390-high.json) · [Amostra da Etapa 7B](regioes-390-high.json)

| Região | Triângulos | Chamadas | FPS | p95 (ms) | Abertura (ms) | Primeiro lote GLB (ms) | Buffers (MiB) | Texturas (MiB) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Clareira | 279.771 → 282.531 | 166 → 184 | 60,0 → 60,0 | 16,8 → 16,8 | 2.224 → 2.310 | 182 → 206 | 4,27 → 4,38 | 2,84 → 2,84 |
| Passagem | 453.221 → 458.981 | 212 → 238 | 58,1 → 60,0 | 16,8 → 16,7 | 1.531 → 1.890 | 288 → 386 | 5,39 → 5,66 | 3,59 → 3,59 |
| Soleira | 240.038 → 249.210 | 145 → 155 | 60,0 → 60,0 | 16,7 → 16,7 | 813 → 766 | 269 → 266 | 5,39 → 5,66 | 3,59 → 3,59 |
| Bosque | 270.380 → 278.186 | 144 → 157 | 60,0 → 60,0 | 16,8 → 16,8 | 791 → 845 | 312 → 404 | 5,39 → 5,66 | 3,59 → 3,59 |
| Recanto do besouro | 250.164 → 254.812 | 154 → 166 | 60,0 → 60,0 | 16,7 → 16,7 | 825 → 950 | 347 → 407 | 5,39 → 5,66 | 3,59 → 3,59 |
| Garganta | 121.142 → 125.046 | 71 → 75 | 60,0 → 60,0 | 16,7 → 16,8 | 748 → 680 | 320 → 244 | 5,39 → 5,66 | 3,59 → 3,59 |
| Pátio | 145.052 → 144.234 | 91 → 95 | 60,0 → 60,0 | 16,8 → 16,8 | 865 → 751 | 388 → 311 | 5,39 → 5,66 | 3,59 → 3,59 |
| Copa da Nascente | 160.150 → 161.042 | 111 → 116 | 60,0 → 60,0 | 16,8 → 16,7 | 689 → 596 | 276 → 240 | 5,39 → 5,66 | 3,59 → 3,59 |

## 1366 px · Econômico

[Amostra da Etapa 7](base-1366-low.json) · [Amostra da Etapa 7B](regioes-1366-low.json)

| Região | Triângulos | Chamadas | FPS | p95 (ms) | Abertura (ms) | Primeiro lote GLB (ms) | Buffers (MiB) | Texturas (MiB) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Clareira | 131.853 → 131.241 | 78 → 87 | 60,0 → 60,0 | 16,7 → 16,7 | 1.602 → 1.482 | 151 → 114 | 4,27 → 4,38 | 2,84 → 2,84 |
| Passagem | 183.041 → 184.337 | 125 → 137 | 60,0 → 60,0 | 16,8 → 16,7 | 1.202 → 1.035 | 306 → 243 | 5,39 → 5,66 | 3,59 → 3,59 |
| Soleira | 140.674 → 144.764 | 88 → 96 | 58,1 → 60,0 | 16,8 → 16,8 | 1.041 → 715 | 344 → 234 | 5,39 → 5,66 | 3,59 → 3,59 |
| Bosque | 144.868 → 149.266 | 92 → 101 | 60,0 → 60,0 | 16,8 → 16,7 | 747 → 660 | 262 → 214 | 5,39 → 5,66 | 3,59 → 3,59 |
| Recanto do besouro | 125.682 → 129.072 | 98 → 105 | 60,0 → 60,0 | 16,7 → 16,8 | 721 → 638 | 250 → 238 | 5,39 → 5,66 | 3,59 → 3,59 |
| Garganta | 90.406 → 93.604 | 43 → 48 | 60,0 → 60,0 | 16,7 → 16,7 | 653 → 549 | 274 → 220 | 5,39 → 5,66 | 3,59 → 3,59 |
| Pátio | 112.946 → 117.200 | 64 → 71 | 60,0 → 60,0 | 16,7 → 16,8 | 556 → 540 | 226 → 225 | 5,39 → 5,66 | 3,59 → 3,59 |
| Copa da Nascente | 123.454 → 122.206 | 90 → 94 | 60,0 → 60,0 | 16,7 → 16,8 | 591 → 537 | 267 → 219 | 5,39 → 5,66 | 3,59 → 3,59 |

## 1366 px · Detalhado

[Amostra da Etapa 7](base-1366-high.json) · [Amostra da Etapa 7B](regioes-1366-high.json)

| Região | Triângulos | Chamadas | FPS | p95 (ms) | Abertura (ms) | Primeiro lote GLB (ms) | Buffers (MiB) | Texturas (MiB) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Clareira | 288.906 → 292.102 | 178 → 202 | 60,0 → 60,0 | 16,7 → 16,7 | 610 → 553 | 118 → 132 | 4,27 → 4,38 | 2,84 → 2,84 |
| Passagem | 468.012 → 475.788 | 266 → 302 | 60,0 → 60,0 | 16,7 → 16,7 | 1.611 → 1.552 | 271 → 263 | 5,39 → 5,66 | 3,59 → 3,59 |
| Soleira | 275.212 → 288.016 | 160 → 174 | 60,0 → 60,0 | 16,7 → 16,8 | 860 → 689 | 266 → 237 | 5,39 → 5,66 | 3,59 → 3,59 |
| Bosque | 279.630 → 295.446 | 164 → 180 | 60,0 → 60,0 | 16,8 → 16,7 | 730 → 750 | 224 → 233 | 5,39 → 5,66 | 3,59 → 3,59 |
| Recanto do besouro | 257.140 → 269.408 | 168 → 182 | 60,0 → 60,0 | 16,8 → 16,7 | 654 → 630 | 237 → 216 | 5,39 → 5,66 | 3,59 → 3,59 |
| Garganta | 135.534 → 141.708 | 76 → 82 | 60,0 → 60,0 | 16,8 → 16,8 | 639 → 532 | 255 → 201 | 5,39 → 5,66 | 3,59 → 3,59 |
| Pátio | 162.410 → 171.284 | 98 → 106 | 60,0 → 60,0 | 16,7 → 16,8 | 568 → 516 | 216 → 196 | 5,39 → 5,66 | 3,59 → 3,59 |
| Copa da Nascente | 173.862 → 174.754 | 123 → 128 | 60,0 → 60,0 | 16,8 → 16,7 | 792 → 550 | 304 → 206 | 5,39 → 5,66 | 3,59 → 3,59 |
