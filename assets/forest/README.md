# Arte original — Floresta Encantada

Modelos, texturas e animações criados para Aventuras do Davi. A imagem `modelo.png` indicada pelo responsável foi consultada como referência de qualidade e atmosfera; não está incorporada nos assets nem é redistribuída aqui. Não foram usados modelos, personagens, mapas, texturas de jogos ou bibliotecas de assets de terceiros.

Os arquivos deste diretório são disponibilizados sob CC0-1.0: https://creativecommons.org/publicdomain/zero/1.0/ . Three.js e seus módulos têm licença MIT, preservada em vendor/three/LICENSE.

- `forest.glb`: terreno esculpido, leito rochoso, vegetação com folhas/frondes modeladas, placas, baú e lanternas.
- `bridge.glb`: tábuas curvas com grão de madeira, pegas, cordas amarradas e vigas.
- `treehouse.glb`: tronco/raízes, varanda, escada, painéis, telhas, porta, janela e copa.
- `davi.glb`: personagem original, malhas com pesos, vestuário e expressões modeladas; clips Idle, Walk e Wave.
- `pipo.glb`: companheiro original com corpo cerâmico, antena, barbatanas e pernas articuladas; clips Hover (repouso) e Walk.
- `forest-authoring.blend`: cena editável, câmera, materiais, rig e animações.
- PNGs locais: fontes de albedo e normais embutidas nos GLBs.

Fonte reproduzível: `tools/forest/build_assets.py`, Blender 4.5.9 LTS. Perfis, splines, UVs, pintura por vértices, materiais PBR locais, bordas trabalhadas, agrupamento de superfícies e animações NLA são definidos nessa fonte. O runtime carrega os GLBs; não substitui os assets por cubos/esferas gerados no navegador. A água, a névoa e partículas são efeitos de renderização.

Gerar em uma cópia de desenvolvimento:

```
blender --background --factory-startup --python-exit-code 1 --python tools/forest/build_assets.py
```

`asset-report.json` registra tamanho e triângulos da exportação. Geometrias estáticas são agrupadas por material no navegador; copas permanecem separadas para abrir passagem à câmera. Texturas e geometrias são locais e reutilizadas ao retornar de missões.

`validation.json` é o relatório resumido do validador oficial Khronos. Não há erros de glTF. Avisos de hierarquia de malhas skinned/exportação são mantidos no relatório para revisão; não foram ocultados. O teste em Three.js verifica renderização e os clips exportados. Repetição: `node tools/forest/validate_assets.cjs`, com gltf-validator disponível no ambiente de ferramentas.
