# Contrato de integração — Etapa 8 Cartoon Chibi (vídeo oficial)

## 1. Fonte e objetivo
A referência que prevalece é **referencia-cinematografica.html**, derivada do HTML do vídeo de 20 segundos. Os outros HTMLs interativos enviados anteriormente servem apenas como apoio se necessários; **não são a referência principal**. Importar arquitetura, estilo, personagens, câmera, interação e ritmo visual; NÃO importar a sequência automática como única forma de jogar.

A transição tem de ocorrer sobre a aplicação existente de verdade, não em um projeto alternativo ou página que substitui agenda/missões.

## 2. Arquitetura que deve ser preservada
- Backend Python com sessões/autorização e persistência em SQLite: server.py, forest.py, world.py e regras de agenda/horários.
- Frontend existente: app.js, forest.js, forest.css, world.js, assets/forest/navigation.mjs, trail.mjs, regions.mjs, bosque.mjs, boat.mjs, sight.mjs, wardrobe.mjs e mapa 2D.
- Fontes de arte reproduzíveis: tools/forest/build_assets.py, build_bosque.py, modelos .blend e .glb.
- Infra LAN existente: DaviApp, DaviProxy, HTTPS doméstico e DNS. Nenhuma alteração de infraestrutura.
- API do mundo e economia: estrelas somente por eventos autorizados; compras, inventário, vestuário, persistência e revogação pelo responsável.
- Missões Aprender/Fazer/Lembrar, botão Agora, horários do servidor, tarefas sem roteiro, navegação contínua, posições e transição 2D/3D.

A proposta original menciona React Three Fiber, WebGPU, PWA e Capacitor como possibilidades genéricas: **não migrar para essas stacks nesta etapa**. O jogo já é Three.js e deve funcionar sem dependências externas na LAN.

## 3. Tradução do vídeo para a experiência real
| No vídeo | No jogo real |
|---|---|
| 20 segundos com window.renderAt(t), câmera e trajeto fixos | Movimentação livre por teclado, toque e clique; câmera dinâmica com controle do jogador |
| Soleira, roda e calha | Manter percurso e posições no **mesmo mundo contínuo** da Etapa 7C; melhorar câmera, iluminação, geometria e elementos visuais sem falsificar regiões |
| Barquinho, roda e água animados | Ação contextual do usuário, com começo, percurso, chegada e resposta visual; sem disparos por relógio de demonstração |
| Pedras da travessia com pulos e reação | Interação/jogabilidade segura e rota real, sem quebrar colisões e caminhos alternativos |
| Folha, criatura e tronco oco | Respeitar estado persistente do besouro e descobertas atuais; visual do ouriço é referência artística e deve ser adaptado ou acrescentado somente sem substituir silenciosamente conquistas |
| Estrelas flutuando e contador pulando | Consumir estados e eventos do backend; animação de prêmio é feedback de crédito real, não uma segunda economia |
| Pipo flutuante | Nova representação intencional do companheiro: animação expressiva, proximidade e reação, sem flutuação de bug nem atravessar cenário |
| Botão contextual amarelo e balões | HUD acessível com alvos ≥48px e foco/teclado, sem ocultar Agora, Missões, Agenda e controle do responsável |
| Toon com contorno roxo em todo o mundo | Estilo consistente, mas otimizar os outlines: duplicar toda malha pode dobrar draw calls; estudar seletivamente aplicação em personagens e objetos protagonistas |
| Roteiro visual diurno | Preservar qualidade/tema e movimento reduzido; evitar efeitos que causem enjoo ou prejudiquem leitura |

## 4. Fases de implementação na nova PR
**8A — Estudo e cena integrada:** reproduzir visualmente a Soleira → Bosque → tronco usando o motor real. Incluir arte-base, paleta, fontes locais licenciadas, toon, contorno e câmera. A cena deve ser acessível dentro do jogo real com mapa e posições preservados. Não usar o HTML protótipo como página de produção.

**8B — Jogabilidade e reação:** integrar ações, travessia, roda/barco, criatura e feedback de estrelas ao backend e às missões. Foco em controle táctil, colisões e estabilidade de estados. Pipo consciente e expressivo.

**8C — Consistência e expansão:** após aprovação visual de 8A/8B, aplicar linguagem às demais regiões existentes: Clareira, Garganta, Pátio e Copa, mantendo as duas rotas e todo o circuito contínuo. Sem adicionar mundos novos.

**8D — Medição física e liberação:** só após revisão do responsável, preparar piloto de produção com backup/rollback, sem fazer merge ou deploy nesta PR automaticamente.

## 5. Orçamento e qualidade
Comparar contra e035424 (Etapa 7C) com resolução, cena e ângulo equivalentes. Na passagem de 1366px Detalhado foram reportadas ~289 draw calls e 476.632 triângulos. A proposta do protótipo declara **metas**, não resultados provados, de 30 FPS em celular e até ~150 calls/150k triângulos. Não prometer esses valores sem medir e não introduzir excesso de passes por contorno.

Alvos físicos: Amazon Fire HD 8 2022, Xiaomi Redmi 8, LG All-in-One i7 3ª geração. Manter Econômico, Automático, Detalhado, fallback 2D, movimentos reduzidos/ativados e diagnóstico JSON. Sem alegar homologação física antes de receber medições da família.

## 6. Regras de segurança e governança
Nenhum banco familiar pode ser copiado ou usado em testes. Usar exclusivamente instâncias em loopback, banco SQLite sintético e Playwright. Evitar efeitos externos por padrão. Sem GitHub Actions automáticas, merge, deploy de produção, novo serviço, DNS, certificado ou migração destrutiva. Branch e PR continuam em rascunho até revisão do responsável.