# V0.7 B — cinco mundos 3D e editor do responsável

Frente B da Issue #13, em branch independente da frente A. A base é a main após a PR #12. Esta PR não incorpora o controle temporal da PR #14; os mundos consomem e mostram `window` nas atividades quando esse contrato está disponível, sem decidir permissões de confirmação no navegador. O servidor da frente A continua sendo a autoridade de horário após integração das duas entregas.

## Experiência

- Floresta Encantada: árvores, caminho circular, bosque separado, ponte adquirível e casa na copa.
- Ilhas das Nuvens: três ilhas flutuantes conectadas, nuvens volumétricas e balões.
- Cidade dos Robôs: laboratório, prédios com antenas, rua e uma estação além da passarela.
- Ilha dos Tesouros: praia, palmeiras, cais com barco e ilha do farol.
- Montanhas de Cristal: grandes formações, arco e trilhas para dois mirantes.

São cenas WebGL reais com malhas, câmera perspectiva que acompanha o personagem, luz hemisférica/direcional, materiais, sombras, profundidade e geometria original. Davi tem braços/pernas articulados, caminhada e acessórios; o Pipo acompanha e flutua. Os modelos são gerados pelo código local, sem sprites fingindo 3D, marcas ou assets de outros jogos. Three.js 0.180.0 está versionado localmente sob MIT, com licença e procedência em vendor/three/. Nenhum CDN ou build é necessário para executar a aplicação.

Setas/WASD, botões de direção, toque no chão e E para o ponto próximo. Botões giram/centralizam a câmera. As placas mostram o nome do ponto mais próximo, com nome completo também por foco/hover. Viajar abre o catálogo de mundos ou usa o portal no terreno. Voltar ao mesmo mundo recupera a posição; um segundo aparelho recebe mundo atual, posição, descobertas e inventário salvos no servidor. Enquanto um aparelho está em outro mundo, movimentos de uma aba antiga recebem 409 para não sobrescrever o novo mundo.

A agenda completa está acessível de qualquer mundo, mesmo que uma atividade não esteja vinculada àquele cenário ou ainda não tenha roteiro. As atividades vinculadas aparecem identificadas. O painel permite consultar ontem/amanhã/hoje; a agenda completa mantém o seletor de datas.

## Construções e recompensas

As estrelas, compras e controles da PR #12 continuam nas tabelas existentes. Viajar e repetir desafios não concedem estrelas. Descobertas são progresso próprio de cada mundo, sem cobrança nem moeda nova. As estrelas continuam vindo das atividades e práticas existentes.

A ponte libera fisicamente o bosque da Floresta, onde fica seu mirante. A casa se torna uma construção 3D na copa, com refúgios nos demais mundos. O portal comprado acrescenta um santuário com acesso aos desafios de memória/lógica; desafios de exploração ainda exigem visitar o ponto. O portal de viagem entre mundos é livre, para que os cinco cenários iniciais possam ser explorados. Chapéu/capa/lenço aparecem nas malhas dos personagens. Remover um item pelo responsável continua bloqueando seu uso; a posição é normalizada se uma ponte removida tornaria um ponto inacessível.

## Editor simples

No painel protegido, **Mundos e desafios** permite criar/editar nome, descrição, modelo visual, cor, disponibilidade e requisito de item adquirido. Sempre deve haver um mundo livre disponível. Ao mudar o modelo, pontos que ficariam fora dos caminhos são recolocados em locais válidos, preservando as descobertas. Não é um editor 3D livre: os cinco presets fornecem cenário, caminhos, entrada e posição dos pontos.

Atividades são selecionadas por série, conservando as datas e o calendário. Um mundo aceita até 20 desafios com título, orientação, tipo e ponto nomeado no mapa. Tipos: visitar o ponto, repetir uma sequência ou responder uma pergunta com opções. Em memória, as opções cadastradas definem a sequência exibida; em lógica, o responsável indica o número da resposta correta. Novos casos não exigem programação. Remover um desafio o oculta, preservando o registro de descoberta; editar mantém a descoberta anterior e criar outro desafio inicia um novo registro.

## Persistência e compatibilidade

Migração aditiva com backup pelo mecanismo existente, sem alterar as tabelas da agenda/economia. Tabelas novas: realms, realm_player, realm_progress, realm_events, realm_challenges, realm_completed. Vínculos de atividades usam identidade estável para não apontar para uma nova atividade caso um ID antigo seja reutilizado. Não há limpeza global. O editor tem checagem de revisão para detectar edições concorrentes.

Ilha 2D continua funcional. Pode ser escolhida por aparelho e a preferência fica salva localmente, com botão de retorno ao 3D. Sem WebGL2, a abertura usa automaticamente a ilha anterior. Perda de contexto mostra orientação para continuar em 2D. As páginas mantêm seus controles de responsável protegidos.

## Desempenho e acessibilidade

Objetos estáticos repetidos usam InstancedMesh; geometrias e materiais são compartilhados e liberados ao sair. Pixel ratio limitado a 1 em modo econômico/tela pequena, até 1,5 em detalhe. Sombras são desligadas em econômico; qualidade automática, econômica ou detalhada pode ser escolhida. Animações podem ser desligadas e respeitam redução de movimento. A renderização pausa com a página oculta e o contexto anterior é liberado nas trocas.

As medições e capturas de testes são de Chromium com WebGL por software no Windows, em viewports 360/390/1366. São diagnóstico de carga, não uma medição em celular físico. O conjunto verificou renderização contínua, chamadas de desenho e triângulos; resultados atuais em docs/evidencias-v07-3d/resultado.json. Validação em aparelhos físicos medianos permanece necessária na revisão de produto.

## Testes sintéticos

`python -m unittest discover -s tests -v`

`node --test tests/test_visual.cjs`

`node tests/browser_realms.cjs` (Playwright e axe disponíveis via NODE_PATH).

A suíte inicia banco/processo temporários, porta livre e crédito de teste claramente sintético; nunca usa a instalação da família. Exercita troca, posição após reload, segundo contexto autorizado, editor, vínculo de atividade, desafio persistente, construções/acessórios, perda/ausência de WebGL e comparação com a ilha 2D. Verifica nenhuma requisição externa, erros JS, overflow e axe em superfícies principais. O teste de conectividade assegura caminhos entre todas as ilhas de cada preset. TLS real é opcional e exige DAVI_TEST_CADDY.

Capturas e comparação visual: [evidências](evidencias-v07-3d/README.md). Nenhum merge, deploy, serviço Windows ou dado real foi alterado.
