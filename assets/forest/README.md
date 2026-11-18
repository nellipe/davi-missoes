# Arte original — Floresta Encantada

Modelos, texturas e animações criados para Aventuras do Davi. A referência Cartoon Chibi foi usada para estudar proporções, silhuetas arredondadas e acabamento de brinquedo. As imagens de referência do responsável ficam fora dos assets distribuídos. Modelos, materiais e animações desta pasta são autorais.

Os arquivos deste diretório são disponibilizados sob CC0-1.0: https://creativecommons.org/publicdomain/zero/1.0/ . Three.js e seus módulos têm licença MIT, preservada em vendor/three/LICENSE.

- `forest.glb`: terreno esculpido, leito rochoso, vegetação com folhas/frondes modeladas, placas, baú e lanternas.
- `bridge.glb`: tábuas curvas com grão de madeira, pegas, cordas amarradas e vigas.
- `treehouse.glb`: tronco/raízes, varanda, escada, painéis, telhas, porta, janela e copa.
- `davi.glb`: personagem original, cabeça ampliada, olhos em relevo, vestuário e botinas modeladas. O esqueleto acompanha as novas proporções e mantém os clips Idle, Walk e Wave.
- `pipo.glb`: companheiro original com corpo cerâmico, visor expressivo, antena, barbatanas e pernas articuladas. Clips Hover (repouso) e Walk.
- `bosque.glb` e `bosque-authoring.blend`: copas, troncos, rochas e vegetação compartilhada entre as regiões. A versão econômica reutiliza o mesmo tronco e usa copas esculpidas com menos vértices.
- `forest-authoring.blend`: cena editável, câmera, materiais, rig e animações.
- PNGs locais: fontes de albedo e normais embutidas nos GLBs.

Fonte reproduzível: `tools/forest/build_assets.py`, Blender 4.5.9 LTS. Perfis, splines, UVs, pintura por vértices, materiais PBR locais, bordas trabalhadas, agrupamento de superfícies e animações NLA são definidos nessa fonte. O runtime carrega os GLBs; não substitui os assets por cubos/esferas gerados no navegador. A água, a névoa e partículas são efeitos de renderização.

Gerar em uma cópia de desenvolvimento:

```
blender --background --factory-startup --python-exit-code 1 --python tools/forest/build_assets.py
blender --background --factory-startup --python-exit-code 1 --python tools/forest/build_bosque.py
```

`asset-report.json` registra tamanho e triângulos da exportação. Geometrias estáticas são agrupadas por material no navegador; copas permanecem separadas para abrir passagem à câmera. Texturas e geometrias são locais e reutilizadas ao retornar de missões.

`validation.json` é o relatório resumido do validador oficial Khronos. Não há erros de glTF. Avisos de hierarquia de malhas skinned/exportação são mantidos no relatório para revisão; não foram ocultados. O teste em Three.js verifica renderização e os clips exportados. Repetição: `node tools/forest/validate_assets.cjs`, com gltf-validator disponível no ambiente de ferramentas.
