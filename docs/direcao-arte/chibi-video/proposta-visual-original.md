# Aventuras do Davi: proposta visual chibi

Protótipo de direção de arte para a Floresta Encantada, refazendo o mesmo trecho do vídeo original (Soleira da Roda Baixa → Bosque das Bainhas → tronco oco). Acompanham este documento o vídeo `aventuras-do-davi-chibi.mp4` e o protótipo `aventuras-do-davi-chibi.html`, que roda direto no navegador.

## O que muda em relação à versão atual

No vídeo original o Davi ocupa pouco da tela, a câmera fica alta e longe, e a névoa lava as cores. As pedras do percurso aparecem como placas claras e translúcidas, sem leitura de rocha, e as peças marrons do caminho parecem tábuas. Árvores entram na frente da câmera e escondem o personagem. Os botões têm o mesmo peso visual entre si, então "Soltar um barquinho" ou "Virar a folha" aparecem sem destaque, e não há retorno visual quando algo acontece (o contador de estrelas fica em 0).

A proposta resolve isso com quatro decisões. A câmera fica mais perto e mais baixa, com dois momentos de cinema: abertura de frente para mostrar os rostos e final de lado, enquadrando Davi, Pipo e o ouriço. Tudo que é decorativo tem contorno fino e cores calmas, e tudo que é tocável ganha contorno amarelo-gema, brilho e um botão contextual grande com ícone. A mesma tinta roxo-escura (#34264A) contorna o mundo 3D e a interface, então HUD e cenário parecem uma única ilustração. E cada ação tem resposta: a estrela sobe e explode em brilho, o contador pula, as pedras afundam quando o Davi pisa, o nome da área troca com um banner.

## Direção de arte

Os personagens seguem proporção chibi, com cabeça quase do tamanho do corpo, olhos grandes com dois brilhos, bochechas rosadas e silhuetas arredondadas. O Davi mantém os óculos, a camiseta verde-água e ganhou mochila e um topete. O Pipo virou uma bolinha branca flutuante com visor escuro, olhos turquesa e um broto na cabeça. O cenário usa formas de brinquedo: árvores de copa em nuvem, pedras lisas com musgo no topo, cogumelos de bolinhas e riacho com faixas de espuma animadas.

| Papel | Cor | Uso |
|---|---|---|
| Tinta | `#34264A` | Contornos 3D, bordas e texto da interface |
| Gema | `#FFC93C` | Exclusivo para o que é tocável |
| Folha | `#9BE07A` | Banner de área, ícones de lugar |
| Grama | `#B2E57F` → `#62B860` | Chão, com tom mais fechado no bosque |
| Trilha | `#F7D9A2` / `#E6B97B` | Caminho e borda |
| Água | `#56C8F2` / `#9FE3FA` | Riacho, calha e lago da roda |

A fonte é a Fredoka (arredondada, gratuita, com acentos do português), em um único peso de família: 500 para textos de apoio, 600 para botões e 700 para títulos.

## Interface

A interface mantém a mesma estrutura do app atual (topo, cena, barra inferior) para não exigir reaprendizado. Os botões ficam "fofos" e espessos, com borda de 3 px e sombra sólida embaixo que afunda quando pressionados. O direcional mostra a seta ativa enquanto o Davi anda. O botão contextual fica no canto inferior direito, maior que os outros e ao alcance do polegar. O Pipo fala por balões que acompanham a posição dele na cena. Alvos de toque têm no mínimo 48 px.

## Decisões de tecnologia

| Tema | Decisão | Motivo |
|---|---|---|
| Motor 3D | three.js com WebGL2 | Leve, roda em qualquer navegador moderno, ecossistema enorme. Se o app já usa React, React Three Fiber por cima. |
| WebGPU | Melhoria progressiva, não requisito | Já existe em Chrome, Edge, Safari 26 e Firefox, mas com lacunas (Firefox no Linux e Android, GPUs móveis antigas). O `WebGPURenderer` do three.js volta para WebGL2 sozinho. |
| Visual toon | `MeshToonMaterial` com rampa de 3 tons | Sombreado em degraus sem texturas, então os downloads ficam pequenos. |
| Contorno | Casco invertido em shader, espessura em pixels | Uma passada extra por objeto, bem mais barato que pós-processamento em celular. |
| Sombras | Sombra-mancha nos personagens e shadow map só no nível alto | Personagens ficam limpos e o celular fraco desliga o shadow map sem perder leitura. |
| Oclusão | Árvores entre câmera e Davi ficam translúcidas | Resolve o problema do vídeo original sem limitar o cenário. |
| Interface | HTML e CSS por cima do canvas | Texto nítido, acessível a leitor de tela, fácil de traduzir e de ajustar sem mexer no 3D. |
| Assets | Blender → glTF (.glb), Meshopt ou Draco, texturas KTX2 | Formato padrão da web, compressão pronta via gltf-transform. |
| Muitos objetos | `InstancedMesh` para grama, flores e pedrinhas | Milhares de itens em poucas chamadas de desenho. |
| Multiplataforma | PWA instalável com cache offline; Capacitor se precisar de loja | Um só código para celular, tablet e desktop. |

## Desempenho

O protótipo foi pensado para celular intermediário. As metas são 60 fps no desktop e 30 fps estáveis no celular, até cerca de 150 chamadas de desenho e 150 mil triângulos visíveis. A resolução fica limitada a `min(devicePixelRatio, 2)` e cai sozinha se o tempo de quadro subir. Na carga, um teste rápido escolhe entre três níveis: alto (sombras reais, partículas, antialias), médio (sombras de menor resolução) e baixo (só sombras-mancha, menos grama). `prefers-reduced-motion` reduz balanços de câmera e efeitos.

## Como o protótipo foi feito

A cena inteira é procedural, feita em three.js 0.170 sem modelos externos: personagens montados com esferas e cápsulas, terreno com altura por ruído, trilha e riacho como faixas seguindo curvas. O vídeo foi gravado quadro a quadro no Chromium sem tela e codificado em H.264. Por isso a animação é uma rota automática, sem controle. Na versão de produção os personagens viriam do Blender com esqueleto e animações (parado, andar, pular, acenar, comemorar).

## Próximos passos sugeridos

Primeiro validar a direção de arte com o Davi e com o responsável usando o vídeo. Depois modelar Davi e Pipo no Blender seguindo estas proporções e trocar os materiais atuais pelo toon com contorno, começando pela Floresta Encantada. Por último medir em dois celulares reais, um Android de entrada e um iPhone, antes de expandir para as outras áreas.