# Arte original — Floresta Encantada

Modelos, texturas e animações criados para Aventuras do Davi. A referência Cartoon Chibi foi usada para estudar proporções, silhuetas arredondadas e acabamento de brinquedo. As imagens de referência do responsável ficam fora dos assets distribuídos. Modelos, materiais e animações desta pasta são autorais.

Os arquivos deste diretório são disponibilizados sob CC0-1.0: https://creativecommons.org/publicdomain/zero/1.0/ . Three.js e seus módulos têm licença MIT, preservada em vendor/three/LICENSE.

- `forest.glb`: terreno esculpido, leito rochoso, vegetação com folhas/frondes modeladas, placas, baú e lanternas.
- `bridge.glb`: tábuas curvas com grão de madeira, pegas, cordas amarradas e vigas.
- `treehouse.glb`: tronco/raízes, varanda, escada, painéis, telhas, porta, janela e copa.
- `davi.glb` traz cabeça ampliada, óculos azuis modelados, brilhos nos olhos, bochechas, topete e mochila laranja. O esqueleto usa os clips Idle, Walk e Wave. A túnica neutra recebe Menta, Sol ou Azul. Chapéu e capa continuam como malhas equipáveis do esqueleto.
- `pipo.glb` traz casco esférico branco, visor com olhos turquesa, broto e barbatanas articuladas. O clip Hover anima o repouso. O clip Walk anima a inclinação e as barbatanas em deslocamento. O jogo calcula a altura da flutuação sobre o terreno e usa a rota existente do companheiro. O lenço conserva suas malhas equipáveis.
- `bosque.glb` e `bosque-authoring.blend` incluem as famílias da Floresta e os modelos da cena-mestra da Etapa 8A.1. As novas copas têm volumes arredondados com versões Econômica e Detalhada. Moitas com bagas, flores, seixos de margem, lajes e tronco com musgo têm pigmento por vértice. Os modelos anteriores continuam disponíveis para as demais regiões.
- `forest-authoring.blend`: cena editável, câmera, materiais, rig e animações.
- PNGs locais: fontes de albedo e normais embutidas nos GLBs.
- `chibi.mjs` aplica a rampa toon e o contorno roxo seletivo sobre as malhas exportadas. A tinta das copas e das moitas usa o próprio passe de iluminação.
- `cenario-agua.mjs` monta a roda e os cavaletes da Soleira e gera a lâmina d’água no tanque e na trilha das lajes usando a superfície do mapa.
- `fonts/fredoka-latin.woff2` contém a variante latina de Fredoka sob [SIL Open Font License 1.1](fonts/OFL-Fredoka.txt). [Fonte original](https://fonts.google.com/specimen/Fredoka).

Fonte reproduzível: `tools/forest/build_assets.py`, Blender 4.5.9 LTS. Perfis, splines, UVs, pintura por vértices, materiais PBR locais, bordas trabalhadas, agrupamento de superfícies e animações NLA são definidos nessa fonte. O runtime carrega os GLBs; não substitui os assets por cubos/esferas gerados no navegador. A água, a névoa e partículas são efeitos de renderização.

Gerar em uma cópia de desenvolvimento:

```
blender --background --factory-startup --python-exit-code 1 --python tools/forest/build_assets.py
blender --background --factory-startup --python-exit-code 1 --python tools/forest/build_bosque.py
```

`asset-report.json` registra tamanho e triângulos da exportação. Geometrias estáticas são agrupadas por material no navegador; copas permanecem separadas para abrir passagem à câmera. Texturas e geometrias são locais e reutilizadas ao retornar de missões.

`validation.json` é o relatório resumido do validador oficial Khronos. Não há erros de glTF. Avisos de hierarquia de malhas skinned/exportação são mantidos no relatório para revisão; não foram ocultados. O teste em Three.js verifica renderização e os clips exportados. Repetição: `node tools/forest/validate_assets.cjs`, com gltf-validator disponível no ambiente de ferramentas.
