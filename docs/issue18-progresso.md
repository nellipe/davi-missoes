# Issue #18 — rodada parcial, PR #17 em rascunho

Rodada encerrada a pedido do responsável. **Não pronta para merge nem homologação final.** A Issue #18 e os quatro comentários de revisão da PR #17 foram lidos integralmente. A avaliação artística anterior foi superada pelo feedback de reprovação da homologação; esta entrega não declara aprovação artística.

## Correções implementadas e evidência

1. **Caminhada substituída por saudação após troca:** `waving` guardava um prazo relativo ao relógio anterior; `open()` zerava `clock`, mas não o prazo. Depois da remontagem, uma saudação antiga podia sobrepor Walk enquanto o avatar se deslocava. O [registro anterior](evidencias-issue18/baseline-bugs.json) mostra `animation: Wave`, `pipoAnimation: Walk` e tecla `right` pressionada. Agora o prazo é reiniciado e deslocamento real tem prioridade sobre Wave. O [smoke atual](evidencias-issue18/smoke-resultado.json) registra Walk depois da mesma troca.
2. **Dois motores ativos:** entrar em 3D não encerrava explicitamente o 2D, pois ambos usavam `state.view=child-world`. Agora a transição aguarda encerramento e salvamento do outro motor. Foram adicionados cancelamento de frame/listeners, limpeza de teclas/alvos, proteção de operações assíncronas por geração e captura/cancelamento de ponteiros. O smoke verifica que o 2D está inativo e sem frame pendente durante o 3D. A hipótese inicial de que o identificador de frame, sozinho, explicava o defeito não se confirmou: `bind()` já zerava esse identificador no 2D; a ausência de encerramento na transição era o problema relevante.
3. **Apoio no terreno e limites:** a fórmula de apoio anterior ignorava o recorte real do riacho. O Blender agora exporta a grade da superfície; o runtime interpola a mesma diagonal dos triângulos renderizados. Uma tabela amostrada da malha animada compensa o deslocamento vertical dos pés. O smoke compara a malha do personagem com um raycast sobre a geometria renderizada na margem, antes de mover. O apoio em movimento ainda precisa de validação extensa em inclinações e ponte; não há promessa de IK completo por pé.
4. **Navegação:** módulo puro de caminhos, segmentos e movimento com colisão, incluindo a restrição da cachoeira que faltava no cliente. Há A* e simplificação de caminho, limite caminhável e deslize em obstáculos. Três testes verificam ponte/água/cachoeira, limites e interpolação da superfície. Câmera e gestos antigos são reiniciados na abertura; a projeção de toque usa matrizes atualizadas.
5. **Recursos:** descarte de materiais e recursos gerados, instancing de geometrias repetidas e remoção de SSAO/bloom. Econômica desliga sombras e limita DPR. Fallback 2D continua no código, mas a suíte completa de fallback/context loss anterior não foi repetida após todas estas alterações.

## Destinos 3D — implementação inicial, validação completa pendente

Foram modelados locais próprios para calendário, oficina, personalização e portal, somados a diário, ponte, casa e baú. Há um marcador 3D reutilizável por atividade, rótulos projetados e caminhos até destinos. “Caminhos” inicia deslocamento até o lugar; não substitui a interação local. Atividades sem roteiro continuam encaminhando à agenda. Os rótulos usam o estado de horário fornecido pelo servidor; confirmar/desfazer permanece nas APIs protegidas da PR #14, sem mudanças nas regras temporais.

**Limitação:** o smoke desta rodada usa agenda sintética vazia para reproduzir a troca e comparar o mesmo enquadramento. Não comprova navegação a todas as estações, colocação de muitos marcadores, todas as atividades ou paridade integral 2D/3D. Essa validação é pendente.

## Antes/depois real

Mesma posição inicial `(0, 0.71)`, sem ponte/casa compradas, mesma aplicação e dados sintéticos. A câmera foi revisada, portanto o enquadramento mudou; não é comparação por pixel nem benchmark equivalente. São capturas reais do navegador, sem composição de imagem gerada.

| Largura | Antes | Prévia atual |
|---|---|---|
| 360 px | [Antes](evidencias-issue18/antes-360.png) | [Depois](evidencias-issue18/depois-360.png) |
| 390 px | [Antes](evidencias-issue18/antes-390.png) | [Depois](evidencias-issue18/depois-390.png) |
| 1366 px | [Antes](evidencias-issue18/antes-1366.png) | [Depois](evidencias-issue18/depois-1366.png) |

Referência consultada: `D:\davi-missoes\docs\modelo.png`; não copiada nem publicada. A referência tem composição concentrada em um desfiladeiro, volumes rochosos ricos, vegetação em camadas, madeira envelhecida e luz suave. A cena anterior tinha copas esparsas, caminho pouco articulado, brilho repetitivo na água e muito custo de pós-processamento. Esta prévia introduz espécies/silhuetas diferentes, copas volumétricas, caminhos ramificados delimitados, bancadas/placas próprias, materiais de madeira menos saturados, margens em tons de rocha e fluxo de água mais discreto.

Ainda há distância perceptível da referência: relevo/rochas simplificados, transições de vegetação, sombra dura e personagens sem uma revisão completa de proporções/rig. A melhoria deve ser julgada pelo responsável; os testes não aprovam o visual. O vídeo antigo do marco visual não demonstra estas alterações. **Vídeo contínuo novo dos destinos ainda não foi produzido.**

## Custo medido e limites

| Item | Base da PR | Prévia atual |
|---|---:|---:|
| Triângulos da floresta exportada | 392.836 | 156.917 |
| Triângulos da ponte exportada | 26.856 | 11.932 |
| Total dos GLBs carregados | 9.183.428 bytes, cinco arquivos | 7.147.168 bytes, seis arquivos, incluindo marcador |

No smoke atual em RTX 2060 SUPER/D3D11: primeira abertura do mundo ~1.581 ms; reabertura ~198 ms. Snapshot detalhado: 175 chamadas, ~333 mil triângulos contando passes, 240 instâncias, ~4,86 MB de buffers de geometria ativos estimados e ~10,49 MB de texels estimados. Esses valores não incluem todos os recursos em cache, driver, buffers internos, framebuffer ou pico de processo. Não são medição completa de VRAM/RAM. Texturas/geometrias e heap quando disponíveis foram expostos em `DaviForest.diagnostics()`.

O número de frames da sessão curta é insuficiente para alegar FPS sustentado. O ensaio longo e as medições de memória/FPS reais em **Fire HD 8 (2022), Redmi 8 (modelo a confirmar) e LG All in One i7 de 3ª geração** estão pendentes. Não havia dispositivos conectados ao ADB, e o responsável informou que só poderá testar depois. Viewport móvel na GPU desktop não equivale a aparelho físico.

## Validação executada nesta rodada

- Python: 60 testes executados, 59 aprovados e TLS real opcional não executado nesta rodada.
- JavaScript: 12 aprovados (nove existentes e três de navegação).
- Playwright smoke: reproduz saudação após troca no código anterior; no atual verifica caminhada, 2D inativo, apoio inicial na geometria renderizada e capturas 360/390/1366. Sem erros JS na sessão curta.
- Validador Khronos: zero erros nos seis GLBs; avisos preservados em `assets/forest/validation.json`.

Para repetir o smoke, com as ferramentas já instaladas fora do projeto:

```powershell
cd D:\davi-issue-16-forest
$env:NODE_PATH = "$env:TEMP/davi-redesign-tools/node_modules"
node tests/browser_issue18_smoke.cjs
node --test tests/test_forest_navigation.mjs tests/test_visual.cjs
python -m unittest discover -s tests -v
```

O smoke cria banco/processo temporários, sem uso da produção. Não executar os scripts de evidência antigos para demonstrar os novos destinos: não os cobrem.

## Próxima rodada

1. Completar E2E de 30 alternâncias com teclas pressionadas, pointer cancel, toque em alvos explícitos, missão/retorno e recarga.
2. Verificar grounding/animação na ponte e inclinações, câmera/frustum e quantidade de recursos após vários ciclos.
3. Navegar a cada estação/atividade; validar agenda sem roteiro, compras/equipamentos, portal, persistência e bloqueios temporais pela UI.
4. Executar dez minutos contínuos e produzir vídeo contínuo novo dos destinos.
5. Reavaliar arte com comparação de ponte/casa construídas e referência; continuar acabamento sem novos efeitos pesados.
6. Atualizar a homologação LAN apenas quando esta revisão estiver suficientemente validada; colher métricas físicas e retorno artístico.

**Isolamento:** main preservada; nenhuma alteração em produção Windows, serviços, certificados, credenciais ou bancos reais. A instância LAN anterior continua na revisão anterior, sem atualização nesta rodada interrompida. Sem merge, deploy de produção ou migração de banco/tecnologia. PR #17 permanece aberta e em rascunho.
