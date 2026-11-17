# Redesign v0.3 — aventura em blocos

## Identidade e decisões

A agenda agora tem uma identidade original de exploração: mascote geométrico desenhado em CSS, pequenos blocos de cenário estáticos, superfícies claras e sombras táteis. Não utiliza marcas, personagens ou assets de terceiros. Usa fontes do sistema e emojis locais; a aparência dos emojis pode variar entre sistemas.

A área infantil responde a três perguntas: a primeira pendência aparece em **Próxima missão**, a lista cronológica mostra **o que vem depois**, e o estado textual e a barra mostram **o que já foi feito**. A próxima missão é a primeira pendência da data selecionada na ordem fornecida pela API, mesmo quando seu horário passou. A saudação “Olá” funciona em qualquer horário. Não há pontuação competitiva, punições, cronômetros, áudio ou animações contínuas.

A área do responsável compartilha tipografia e cores, com uma hierarquia administrativa mais sóbria: calendário, detalhes do dia, cadastro e ações explícitas de edição/exclusão. O calendário exibe prévias em telas maiores. No celular, exibe contagens legíveis e o símbolo de feriado; a seleção revela abaixo os detalhes completos, inclusive o nome do feriado.

## Paleta final

| Uso | Cor principal | Superfície complementar |
| --- | --- | --- |
| Azul profundo / títulos / navegação | `#173A7A` | `#EEF4FF` |
| Azul de interação / foco | `#2563CF` / `#1557C0` | `#EAF2FF` |
| Ação principal / estrela | `#FFD54A` | `#FFF1BD` |
| Texto / texto secundário | `#203454` / `#536580` | `#FFFFFF` |
| Escola | `#245BB3` | `#EDF4FF` |
| Saúde e terapias | `#6840B4` | `#F4EEFF` |
| Esportes / conclusão | `#23763B` / `#298547` | `#EDF8EE` |
| Alimentação | `#A04D12` | `#FFF2E8` |
| Higiene | `#82600A` | `#FFF9DC` |
| Sono | `#304B81` | `#EDF0FC` |
| Medicação | `#A33252` | `#FFF0F4` |
| Outras | `#536580` | `#F0F3F8` |

Os tons escuros nas categorias favorecem contraste do texto; os tons claros e símbolos mantêm a diferenciação sem depender só da cor. O mascote acrescenta turquesa `#65C9CB` e azul claro `#7BAAFF` em elementos decorativos.

## Componentes

- Cabeçalho com marca original, alternância das duas áreas e estado `aria-pressed`.
- Saudação personalizada e cenário em CSS, oculto para tecnologias assistivas.
- Cartão da próxima pendência com ícone, título, horário original, duração, descrição de até 160 caracteres e ação real “Consegui!”. O texto completo permanece na lista.
- Progresso nativo (`progress`) calculado por concluídas / total da data, com contagem textual. Dias vazios mostram zero, sem divisão por zero e sem ação fictícia.
- Lista diária ordenada, com categoria escrita, ícone e estado “Pendente” / “Concluída”; conclusão reversível.
- Calendário com borda de seleção, indicação do dia atual, feriados com símbolo e nome acessível. As prévias concluídas também usam ✓.
- Formulários com rótulos, controles nativos, grupos de recorrência e botões de cancelamento. Exclusões e alteração de série mantêm as confirmações existentes.
- Alertas de erro, anúncio discreto de conclusão e bloqueio de ações duplicadas durante requisições.

A classificação visual examina o título sem acentos e depois o ícone; usa fallback “Outras”. Não grava categoria no banco, não altera eventos e não conclui medicações ou outras atividades automaticamente.

## Acessibilidade

Fonte Segoe UI / sistema; contraste de texto e foco verificado pelas regras automatizadas indicadas abaixo. Botões têm pelo menos 46 px de altura; estados usam textos e símbolos. A ação amarela destaca apenas a próxima missão no painel infantil. A lista usa ações secundárias, e cada botão de conclusão tem nome acessível com o título da atividade.

O link “Pular para o conteúdo” aparece ao receber foco. Foco visível, `aria-busy` durante carregamento e reposicionamento de foco após renderização permitem continuar pelo teclado. As ações de calendário também informam seleção e data atual. Não há reprodução automática de áudio, pop-ups de recompensa ou movimento contínuo. A folha respeita `prefers-reduced-motion`.

Limite: a verificação automática não certifica conformidade integral. Leitor de tela, toque físico, percepção de foco com diferentes temas do sistema e adequação da experiência ao uso familiar ainda precisam de avaliação humana.

## Responsividade e evidências

As capturas usam exclusivamente nomes e compromissos sintéticos de demonstração. Não contêm dados do banco pessoal.

| Largura | Área infantil | Responsável | Geometria e auditoria automatizada |
| --- | --- | --- | --- |
| 360 px | [Captura](evidencias-v03/crianca-360.png) | [Captura](evidencias-v03/responsavel-360.png) | Sem rolagem horizontal, controles fora da tela ou sobrepostos; 0 violações detectadas |
| 390 px | [Captura](evidencias-v03/crianca-390.png) | [Captura](evidencias-v03/responsavel-390.png) | Mesmo resultado |
| 768 px | [Captura](evidencias-v03/crianca-768.png) | [Captura](evidencias-v03/responsavel-768.png) | Mesmo resultado |
| 1366 px | [Captura](evidencias-v03/crianca-1366.png) | [Captura](evidencias-v03/responsavel-1366.png) | Mesmo resultado |
| 1920 px | [Captura](evidencias-v03/crianca-1920.png) | [Captura](evidencias-v03/responsavel-1920.png) | Mesmo resultado |

Em até 650 px, os painéis se empilham, os cartões reorganizam ícone e horário, o formulário usa uma coluna e o calendário usa contagens. Em 768 px, os painéis mantêm duas colunas e as ações administrativas quebram para uma linha própria. A largura de leitura é limitada em monitores grandes.

Os cenários de nome de 35 caracteres, título sem espaços de 100 caracteres e descrição de 800 caracteres também foram exercitados nas cinco larguras, junto com abertura e cancelamento do formulário. O destaque resume descrições longas e a lista preserva seu conteúdo integral.

## Funcionalidades preservadas

`server.py`, `importar_agenda.py`, inicializadores Windows e `index.html` não foram alterados. Permanecem os endpoints, schema SQLite, cookies e sessões, cadastro de senha, login/logout, preferências, horários, recorrências, regras de feriados, exceções e registros de conclusão. Nenhum serviço, dependência de produção ou GitHub Actions foi adicionado.

O banco pessoal não foi aberto pela aplicação ou pelos testes. O SHA-256 conferido antes e depois permaneceu idêntico. Os testes Python já usam bancos temporários; a validação de navegador cria seu próprio diretório `DAVI_DATA_DIR`, verifica um identificador sintético exclusivo do servidor antes de qualquer escrita e remove esse banco ao terminar. Nenhum banco ou conteúdo pessoal entra na entrega.

A edição de série mantém o comportamento anterior: reinicia as marcações e exclusões anteriores da série após a confirmação existente. A interface continua informando esse efeito. Exclusão de ocorrência e exclusão de série continuam distintas.

## Validação executada

Ambiente: Windows, Python **3.13.5**, Node.js **24.19.0**, Playwright **1.65.1**, Chromium instalado por essa versão e `@axe-core/playwright` **4.14.0**. Executado em 17/11/2026.

| Verificação | Comando / evidência | Resultado |
| --- | --- | --- |
| Regras existentes de calendário, recorrência, feriados, conclusão, hash de senha e liberação de SQLite | `py -3 -m unittest discover -s tests -v` | 12 testes aprovados |
| Categorias, prioridade título/ícone, fallback, escape de texto, descrição curta, missão pendente sem conclusão por horário, progresso vazio/completo | `node --test tests/test_visual.cjs` | 5 testes aprovados |
| Fluxos reais de interface e capturas | `node tests/browser_redesign.cjs` | 7 grupos aprovados; 10 capturas |
| Axe com tags `wcag2a`, `wcag2aa`, `wcag21aa` | Mesmo script | 10 auditorias, nenhuma violação detectada |
| Layout com textos extensos e formulários | Mesmo script | Cinco larguras, sem rolagem horizontal |
| Erros JavaScript / console inesperados | Mesmo script | Nenhum; 401 esperado do cenário de senha incorreta |

Os sete grupos de navegador abrangem: configuração inicial e login; cadastro/edição semanal e exclusões de ocorrência/série; feriado e seleção de data; ordenação, conclusão por Enter, desfazer e foco; conteúdo extenso e formulários; navegação de datas, dias vazio/completo, logout e senha inválida; link de salto e preferência por movimento reduzido. Os casos de recorrência diária, dias úteis, semanal, mensal e feriados também estão na suíte Python existente.

O [relatório estruturado](evidencias-v03/validation.json) registra as medidas por largura, os grupos exercitados e os resultados Axe. Instruções reproduzíveis estão no [README](../README.md#testes-da-interface-opcionais-desenvolvimento). Node.js, Playwright e Axe são ferramentas opcionais de desenvolvimento, instaladas fora do repositório; não são necessários para usar a agenda.

## Limitações e revisão

Categorias por texto são heurísticas; a apresentação não substitui conferência do responsável. O calendário compacto exige selecionar o dia para ler os compromissos completos no celular. A integração com o jogo guiado fica para outra PR e não tem botão fictício nesta versão. A validação visual e automática foi feita em Chromium; outros navegadores, leitores de tela e interação física em dispositivos não foram testados.

A proposta permanece sujeita à revisão do responsável. Esta entrega não autoriza merge ou deploy.
