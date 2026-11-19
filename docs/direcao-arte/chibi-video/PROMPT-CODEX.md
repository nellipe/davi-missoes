# Prompt executivo para o Codex — Etapa 8, direção oficial do vídeo

**Projeto:** nellipe/davi-missoes
**Branch:** feat/etapa8-chibi-video-direcao-oficial
**Base funcional herdada:** e035424c2d6a5072ebe6907b2dbe779f492c4c2e
**PR anterior:** #17, encerrada sem merge, histórico preservado nesta branch
**Executor recomendado:** GPT-6.2 Sol — Raciocínio Alto

## DECISÃO FINAL DO RESPONSÁVEL
A direção artística escolhida é o **HTML do vídeo** (arquivo original aventuras-do-davi-chibi(1).html (sem espaço antes do parêntese)). **Não é o HTML de navegação livre** que também foi enviado. O vídeo de ~20s é a referência de personagem, ambiente, contorno, paleta, HUD, câmera, narrativa, reações e clima.

Esta nova PR substitui a direção artística proposta na antiga PR #17, mas **não descarta seus recursos de jogo**. O objetivo é reconstruir a estética e o ritmo interativo dentro da experiência 3D real já existente.

## LEITURA OBRIGATÓRIA
1. docs/direcao-arte/chibi-video/README.md
2. docs/direcao-arte/chibi-video/referencia-cinematografica.html — renderizar em navegador, examinar shaders/cores/câmera e a função window.renderAt(t), percorrer todo roteiro de 0 a 20 segundos.
3. docs/direcao-arte/chibi-video/proposta-visual-original.md — referência de intenção, não autorização de migração de stack.
4. docs/direcao-arte/chibi-video/PLANO-INTEGRACAO.md e CRITERIOS-ACEITE.md.
5. Código real: forest.js, forest.css, app.js, world.js, server.py, forest.py, world.py, assets/forest/*.mjs, tools/forest/build_assets.py, tools/forest/build_bosque.py, GLBs, .blend e testes existentes. Identificar as integrações e o estado persistente antes de alterar.

O vídeo MP4 foi enviado ao responsável na conversa original e não está commitado; a própria referência HTML reproduz a sequência animada. Não afirmar que o MP4 existe no repo nem depender de anexo inexistente no Codex CLI.

## EXECUÇÃO
- **Implementar, não só planejar.** Começar a Etapa 8A dentro do jogo real: Soleira → Bosque → tronco oco. Manter mapa conectado, regiões originais e caminhos alternativos. Não criar página separada simulando sucesso.
- Replicar a **linguagem toon 3D** da referência: contorno roxo-escuro seletivo, paleta viva, Davi grande/expressivo com óculos, mochila, camiseta verde, Pipo de corpo branco/visor turquesa/broto com flutuação intencional, árvores e pedras legíveis, água azul, rodas/canal e objetos narrativos valorizados.
- Redesenhar o HUD do modo floresta com botões arredondados e feedback de pressão, contagem de estrelas, banner de região, botão contextual amarelo, balão do Pipo; garantir que Agora, missões, agenda, configurações, o menu do responsável e acessibilidade continuem completos.
- Adaptar câmera para perto/baixo, com enquadramento confortável e controle manual preservado; não copiar camera motion do vídeo como roteiro obrigatório.
- Relacionar cenas e ações do vídeo a eventos reais: roda e barco só disparam por interação, pedras têm resposta visível ao pisar, descobertas e recompensas vêm da API. Não implantar contadores client-side independentes nem desrespeitar horários da agenda.
- Integrar direção artística com o pipeline Blender/GLB existente; manter arquivos-fonte editáveis, rig/animações, personalização Menta/Sol/Azul, acessórios e progresso persistente. Se alterar Pipo de caminhada para flutuação, fazê-lo intencionalmente e documentar migração visual sem quebrar estados antigos.
- Carregar Three.js, fontes e texturas localmente em produção; NÃO importar a URL CDN do protótipo nem embutir fontes base64 na aplicação. Não migrar para React, React Three Fiber, WebGPU nem novas infraestruturas.
- Usar instancing, culling, LOD, redução de DPR, sombras econômicas, shader toon e outlines somente onde agregam valor. Os 289 draw calls / 476.632 triângulos da Etapa 7C em 1366px Detalhado servem como baseline; 150 calls / 150k são metas inspiracionais do documento, não restrição rígida nem resultado provado.

## EVIDÊNCIAS E APROVAÇÃO
- Comparação real da Etapa 7C e da nova Soleira/Bosque/tronco em mesma posição/câmera.
- Vídeo da **jogabilidade livre** no aplicativo, com personagem andando, Pipo reagindo, soltar barquinho, descobrir criatura, ganhar estrela pelo backend e abrir Agora/voltar; não reproduzir somente a timeline.
- Capturas 360, 390 e 1366 px nos perfis Econômico e Detalhado; verificar teclado e toque.
- Regressão integral: Python, navegador, missões, horários, compras, acessórios, 2D/3D, posições, câmera, fallback WebGL, controles do responsável.
- Medir FPS, p95, draw calls, triângulos, uso de memória e tempos de abertura; registrar riscos para Fire HD 8 2022, Redmi 8, LG All-in-One antigo, sem inventar testes físicos.
- Entregar commits na mesma PR nova, que fica **em rascunho** até revisão visual do responsável.

## GOVERNANÇA
Sem merge. Sem deploy (nem piloto). Sem editar produção, SQLite familiar, serviços Windows, DNS, certificados, Caddy ou rede. Não executar GitHub Actions automáticas; respeitar controles existentes. Não apagar ou reescrever histórico da PR #17. O responsável decidirá quando a cena-mestra jogável estará pronta para replicar o estilo às demais regiões.

**CRITÉRIO DECISIVO:** ao comparar o jogo jogável com o vídeo original, o responsável deve reconhecer imediatamente o mesmo universo visual infantil, expressivo e interativo — sem perder qualquer capacidade funcional construída nas etapas anteriores.