# Etapa 8A.1 · Acabamento da cena Cartoon Chibi

A Soleira da Roda Baixa, o Bosque das Bainhas e o tronco oco receberam novos volumes de cenário no jogo. A [revisão da PR #19](https://github.com/nellipe/davi-missoes/pull/19#issuecomment-7009187303) aprovou a integração inicial como base e pediu mais fidelidade ao [HTML cinematográfico](../direcao-arte/chibi-video/referencia-cinematografica.html). Estas são as evidências para a próxima avaliação.

- **Soleira.** Copas em volumes arredondados, moitas baixas com bagas e grupos de flores deixam o primeiro plano mais próximo da referência. A roda tem aros vazados, pás e cavaletes. A calha desemboca em água com margem irregular e espuma.
- **Bosque.** O varal pontua a bifurcação. Fragmentos de casca e seixos assentados dão ritmos distintos às duas trilhas. As lajes atravessam um veio raso cuja superfície acompanha o solo existente. A reação da pedra preserva o apoio e a rota do personagem.
- **Tronco.** O novo cilindro esculpido tem boca clara, interior escuro, musgo volumétrico e grupos de flores e fungos. A composição manteve a folha, o besouro e o abrigo persistente do jogo.
- **Enquadramento.** A câmera se recentraliza conforme o lugar e pode girar livremente. Troncos e copas cedem espaço às linhas de visão dos personagens e dos pontos da trilha. Em telas estreitas, os três botões de câmera ficam numa faixa abaixo da cena. Agora, a ação contextual e o direcional continuam ao alcance.

## Protótipo e jogo

Os trípticos mostram o quadro do protótipo, a Etapa 8 em `d6cf1f5` e a Etapa 8A.1, nessa ordem. Os dois quadros do jogo têm posição, lente, inclinação, rotação e área de renderização equivalentes. Os quadros do protótipo correspondem aos mesmos motivos em seu próprio percurso cinematográfico, com cenário e escala próprios.

| Motivo visual | Quadro de referência | Comparação |
|---|---:|---|
| Roda, calha e margem | 4 s | [Soleira](referencia-soleira.webp) |
| Copas, moitas e bifurcação | 7 s | [Bosque](referencia-bosque.webp) |
| Água e seixos da travessia | 10 s | [Lajes](referencia-lajes.webp) |
| Boca do tronco, planta baixa e criatura | 19,5 s | [Tronco](referencia-tronco.webp) |

### Comparações com a Etapa 8

A versão base aparece à esquerda e a revisão à direita. A coluna Jogo mostra o HUD e a câmera de produção.

| Largura e perfil | Soleira | Bosque | Lajes | Tronco | Jogo |
|---|---|---|---|---|---|
| 360 · Econômico | [Soleira](par-360-low-soleira.webp) | [Bosque](par-360-low-bosque.webp) | [Lajes](par-360-low-lajes.webp) | [Tronco](par-360-low-tronco.webp) | [Abrir](jogo-360-low.webp) |
| 360 · Detalhado | [Soleira](par-360-high-soleira.webp) | [Bosque](par-360-high-bosque.webp) | [Lajes](par-360-high-lajes.webp) | [Tronco](par-360-high-tronco.webp) | [Abrir](jogo-360-high.webp) |
| 390 · Econômico | [Soleira](par-390-low-soleira.webp) | [Bosque](par-390-low-bosque.webp) | [Lajes](par-390-low-lajes.webp) | [Tronco](par-390-low-tronco.webp) | [Abrir](jogo-390-low.webp) |
| 390 · Detalhado | [Soleira](par-390-high-soleira.webp) | [Bosque](par-390-high-bosque.webp) | [Lajes](par-390-high-lajes.webp) | [Tronco](par-390-high-tronco.webp) | [Abrir](jogo-390-high.webp) |
| 1366 · Econômico | [Soleira](par-1366-low-soleira.webp) | [Bosque](par-1366-low-bosque.webp) | [Lajes](par-1366-low-lajes.webp) | [Tronco](par-1366-low-tronco.webp) | [Abrir](jogo-1366-low.webp) |
| 1366 · Detalhado | [Soleira](par-1366-high-soleira.webp) | [Bosque](par-1366-high-bosque.webp) | [Lajes](par-1366-high-lajes.webp) | [Tronco](par-1366-high-tronco.webp) | [Abrir](jogo-1366-high.webp) |

## Jogabilidade

Os dois vídeos gravam o aplicativo em loopback com perfil Econômico e um SQLite sintético por sessão. O Playwright toca no botão do barco, gira a câmera arrastando o dedo, percorre a rota das lajes por toques no chão, vira a folha e abre Agora. O passo pressiona a laje e a folha segue virada ao reabrir a Floresta. A economia se mantém estável durante as interações do cenário.

| Tela | Gravação | Checagens no percurso |
|---|---|---|
| 360 px | [Vídeo](jogabilidade-360.mp4) | [Barco](roda-360.webp) · [Travessia](lajes-360.webp) · [Besouro](tronco-360.webp) · [Registro](jogabilidade-360.json) |
| 390 px | [Vídeo](jogabilidade-390.mp4) | [Barco](roda-390.webp) · [Travessia](lajes-390.webp) · [Besouro](tronco-390.webp) · [Registro](jogabilidade-390.json) |

## Desempenho

As duas revisões foram medidas no mesmo Chromium, em Windows com RTX 2060 SUPER e ANGLE/D3D11. Cada registro usa 45 quadros da cena estabilizada. A camada de comparação fixa a lente, a posição da câmera e a altura do canvas móvel em 62% da janela. Essa altura explica diferenças entre a nova medição da base e a tabela da Etapa 8 anterior. [Medições da Etapa 8](medicoes-etapa8.json) · [Medições da Etapa 8A.1](medicoes-etapa8a1.json).

| Cena e perfil | Chamadas de desenho · base → 8A.1 | Triângulos · base → 8A.1 |
|---|---:|---:|
| Soleira · 360 Econômico | 77 → 63 | 124.400 → 135.850 |
| Soleira · 390 Econômico | 79 → 65 | 130.680 → 142.130 |
| Bosque · 390 Econômico | 71 → 62 | 133.534 → 150.182 |
| Lajes · 390 Econômico | 78 → 68 | 172.916 → 176.560 |
| Tronco · 390 Econômico | 90 → 87 | 131.468 → 147.128 |
| Soleira · 1366 Detalhado | 153 → 112 | 273.996 → 276.058 |
| Bosque · 1366 Detalhado | 152 → 115 | 303.398 → 296.836 |
| Lajes · 1366 Detalhado | 174 → 138 | 347.012 → 341.862 |
| Tronco · 1366 Detalhado | 155 → 132 | 267.122 → 275.926 |

As 24 comparações reduziram as chamadas em 3 a 41. O Econômico usa mais triângulos nos pontos amostrados. Os dois builds ficaram em aproximadamente 60 FPS, com p95 de 16,7 a 16,8 ms nesta estação. A abertura da revisão ficou entre 474 e 1.704 ms, ante 455 a 1.587 ms na base. A geometria rastreada subiu de 6,03 MB para 6,15 MB e a estimativa de texturas continuou em 2,28 MB.

O bloco `art` nos JSONs mede as famílias atingidas no passe principal. A amostra da Soleira em 390 px Econômico mostra como a instância por família e a tinta em um só passe compensam mais volume no primeiro plano.

| Família | Chamadas · base → 8A.1 | Triângulos · base → 8A.1 |
|---|---:|---:|
| Árvores e copas | 11 → 6 | 13.296 → 15.770 |
| Moitas, flores e fungos | 5 → 3 | 29.484 → 37.526 |
| Solo, lajes e tronco | 6 → 5 | 6.734 → 9.102 |
| Água, roda, calha e lote de madeira | 9 → 7 | 1.088 → 3.556 |

Os totais da cena também incluem personagens, outras malhas visíveis e passes de sombra. Fire HD 8 2022, Redmi 8 e LG All-in-One ainda aguardam medição física. Os ativos novos ficam na cena-mestra para a avaliação visual da PR.

## Testes

- Passaram 64 testes Python, incluindo TLS em loopback, e 13 testes Node. Cobrem agenda, horários, missões, persistência SQLite, estrelas, compras, revogação, vestuário e navegação.
- No Chromium, as seis combinações de largura e qualidade passaram na auditoria axe. Os testes conferiram alvos de 48 px, teclado, toque, giro e carregamento pela origem local.
- A regressão percorreu as regiões no mesmo canvas, usou as duas trilhas, conferiu os dez destinos, a agenda, a oficina, vestuário, Agora com e sem roteiro e movimento reduzido. [Circuito](regioes-1366-high.json) · [Agora](agora.json) · [Movimento](movimento-390.json).
- O teste em 360 px tocou no chão das duas rotas e diretamente na folha, saiu do recanto e conferiu o estado ao retornar. Uma segunda sessão completou Aprender pelo botão Agora e recebeu o crédito do servidor. [Folha e besouro](folha-e-besouro-360.json) · [Crédito da missão](credito-missao.json).
- Trinta alternâncias preservaram a posição e os controles em 2D e 3D. A perda do contexto aciona a vista 2D. [Alternâncias](alternancias.json) · [Fallback](fallback.json).
- O Blender 4.5.9 LTS exportou o Bosque atualizado. O validador glTF encontrou zero erros no arquivo. [Fonte dos modelos](../../tools/forest/build_bosque.py) · [Validação](../../assets/forest/validation.json).

Com Playwright, Chromium, axe e FFmpeg já disponíveis, aponte `FOREST_EVIDENCE_DIR` para uma pasta temporária. Use `node tests/browser_forest_chibi.cjs mobile 360` e `mobile 390` para gravar. Execute `node tests/browser_forest_chibi.cjs compare-master <checkout> <nome>` para repetir em cada revisão e `node tests/browser_forest_chibi.cjs native` para verificar HUD e acessibilidade.
