# Floresta Encantada — marco visual V0.7

Este ramo parte de `b2a7e52`, main com a PR #14 integrada. A PR #15 não foi incorporada. O escopo é um mundo para revisão artística, com [capturas, gameplay e comparação](evidencias-forest-v16/README.md).

A imagem `D:\davi-missoes\docs\modelo.png` foi consultada como referência de atmosfera e acabamento; não foi copiada, usada como fundo, textura ou publicada no repositório. Terreno, composição, ponte, casa, vegetação, materiais e personagens são originais. O objetivo é avaliar a direção artística antes de expandir para outros mundos.

## Fluxo de criação

`tools/forest/build_assets.py` cria a cena no Blender 4.5 LTS com superfícies desenhadas por perfis, curvas, UVs, pintura por vértices e materiais locais de madeira/rocha/tecido. Há rig e animações NLA de repouso, caminhada e saudação para Davi; Pipo possui repouso e ciclo de pernas. Exporta GLBs com texturas embutidas e cena `.blend` editável. O runtime usa GLTFLoader, AnimationMixer, materiais PBR, sombras, oclusão e efeitos de água; não modela o mundo a partir de primitivas em JavaScript.

As malhas estáticas são agrupadas por material; copas permanecem separadas para tratamento de oclusão da câmera. Recursos e animações são reutilizados ao retornar de missões. Qualidade automática reduz pós-processamento, detalhe e sombra em telas pequenas ou quando o tempo entre frames exige; o responsável/jogador também pode escolher modo econômico. A ilha 2D continua disponível e abre automaticamente quando WebGL não funciona.

## Integração preservada

Missões e vínculos continuam nas APIs existentes. Fazer mantém a janela obrigatória da PR #14, calculada no servidor em America/Sao_Paulo. Aprender/Lembrar, correções do responsável, revogação individual, catálogo, saldo e inventário permanecem nos mesmos módulos. Construir ponte/casa usa a compra atômica existente, sem moeda paralela ou concessão por explorar o cenário.

`forest.py` adapta a posição do mundo existente e valida caminhos, obstáculos e a ponte no servidor. Reutiliza `world_state`: não cria tabelas, migra dados ou muda o banco. Remover uma ponte normaliza a posição exposta se necessário, mantendo a economia e o histórico. A casa é um ponto de interação e diário, não um interior adicional.

A única ampliação de CSP é permitir blobs locais para decodificar texturas embutidas nos GLBs. Scripts e conexões de rede continuam restritos ao próprio aplicativo. Arquivos estáticos têm rota limitada aos diretórios de assets/Three, extensões permitidas e resolução de caminho protegida. Nenhuma dependência de CDN.

## Evidências e revisão

Os testes usam somente dados sintéticos, banco e processo temporários. O vídeo mostra uso real de teclado e a câmera seguindo, entrada/retorno de missão e construções. As capturas mostram 360, 390 e 1366 px, comparação com a PR #15 e o fallback.

A medição confirmada usa RTX 2060 SUPER / D3D11 em Windows, com limites documentados no relatório. Viewports móveis não substituem teste em celular físico. Não há afirmação de aprovação artística: o marco está pronto para o responsável julgar o encanto e o acabamento.

Nenhum outro mundo foi criado. Sem PostgreSQL/Docker, mudança de serviços Windows, instalação, merge ou deploy. A próxima expansão depende da aprovação visual deste mundo.
