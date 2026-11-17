# Aventuras do Davi 🎮 — Agenda + Missões

Projeto familiar para acompanhar os compromissos do Davi e desenvolver autonomia nas rotinas diárias. Visual inspirado em jogos de aventuras em blocos, com identidade original (sem afiliação ao Roblox).

## Publicação definitiva V0.5

Endereço da família: **https://aventuras.davi.costa**, exclusivamente na rede **192.168.2.0/24**. Caddy termina o HTTPS com certificado interno; os serviços Windows `DaviApp` e `DaviProxy` iniciam automaticamente. O backend fica em `127.0.0.1:8765` e somente o HTTPS TCP 443 recebe conexões da rede.

O acesso infantil é automático, sem pareamento ou senha. Cadastro, edição, exclusão e preferências continuam protegidos pela senha administrativa existente. Agenda, conclusões e bancos SQLite são preservados.

Siga o [procedimento Windows V0.5](docs/publicacao-v05.md) para instalar, confiar no certificado nos aparelhos, atualizar, diagnosticar e desinstalar. A instalação depende da aprovação da PR e de execução explícita no Windows. Nenhum serviço, firewall, ACL do projeto ou certificado confiável foi instalado durante o desenvolvimento.

## Publicação HTTP anterior (referência)

No Windows com IP **192.168.2.10**, dê dois cliques em **`Iniciar-Davi-LAN.bat`** e mantenha a janela aberta. Nos aparelhos da rede **192.168.2.0/24**, acesse **http://192.168.2.10:8765**. Encerre com **Ctrl+C**.

Esse modo é habilitado explicitamente pelo inicializador, usa Python diretamente e preserva `dados/agenda.sqlite3` e a senha existente. Qualquer aparelho da sub-rede pode consultar a agenda e marcar/desmarcar atividades, sem código de autorização. As alterações administrativas continuam exigindo a senha do responsável.

O [guia LAN simples](docs/lan-simples.md) e o [plano HTTPS v0.4](docs/publicacao-lan-v04.md) são referências históricas. Para V0.5, use somente o procedimento acima e encerre o inicializador HTTP. Não encaminhe portas no roteador.

## Redesign v0.3 preservado

Identidade original com fundo claro, azul profundo, amarelo solar, mascote geométrico feito em CSS e botões com sombras táteis. Fontes, ícones e ilustrações são locais; nenhuma dependência de internet foi adicionada à aplicação.

A **área infantil** prioriza a próxima atividade pendente com horário igual ou posterior ao atual na data escolhida, com horário, descrição curta e botão “Consegui!”. A barra mostra a quantidade efetivamente concluída; a agenda abaixo mantém a ordem dos horários, descrições completas e opção de desfazer. Pendências de horários anteriores continuam visíveis, com aviso e identificação na lista. Nenhuma atividade é concluída pela passagem do tempo. Categorias são apenas pistas visuais, com texto, símbolo e cor, sem mudar os registros.

A **área do responsável** mantém o calendário mensal, formulários e senha. Em celulares, cada dia mostra a quantidade de atividades e um símbolo de feriado; ao selecionar o dia, a lista completa e o nome do feriado aparecem abaixo. Em telas maiores, o calendário também mostra prévias dos compromissos.

Detalhes de design, resultados e capturas com dados sintéticos: [Redesign v0.3](docs/redesign-v03.md).

## Agenda local preservada

A aplicação abre na **área do Davi** com agenda do dia: horário, compromissos ordenados, marcação de conclusão e navegação entre datas. No modo LAN simples, a entrada é automática; nos demais modos, permanece a autorização do aparelho.

A **área do responsável** exige senha existente ou criada offline pelo responsável e inclui:
- Calendário mensal com atividades, datas selecionáveis e feriados destacados;
- Cadastro de atividades com horário, duração, ícone e descrição;
- Recorrência **única, diária, segunda a sexta, dias selecionados da semana ou mensal**;
- Data de início e fim opcional; opção de ignorar sábados/domingos e feriados;
- Exclusão de ocorrência específica ou série inteira; edição da série completa;
- Edição do nome exibido na área infantil;
- Registros de tarefas feitas por data e atividade.

**Dados locais:** SQLite em `dados/agenda.sqlite3`. Não usa serviços externos, API de feriados ou conta na nuvem. O padrão continua sendo `127.0.0.1`; o modo LAN simples exige `DAVI_LAN_SIMPLE=1`.

## Windows — instalar e executar

Validado no Windows com **Python 3.13.5**. Requer **Python 3.10 ou superior** e navegador Chrome ou Edge. Não requer bibliotecas Python adicionais.

1. No GitHub, faça **Code → Download ZIP** e extraia; ou rode `git pull` se já clonou.
2. Abra a pasta extraída e dê dois cliques em **`Iniciar-Davi.bat`**.
3. Com a janela do servidor aberta, vá para **http://127.0.0.1:8765** no navegador.
4. Se ainda não existe senha, pare o servidor e execute `python maintenance.py init-parent --database dados/agenda.sqlite3`; digite a senha de pelo menos 10 caracteres sem eco. Esse comando exige banco existente e não substitui senha cadastrada. Inicie novamente. Em instalação existente, mantenha a senha atual.
5. Entre na área do responsável, clique em **Cadastrar atividade** e comece a montar a agenda.
6. Clique em **Minha aventura** para ver o painel do Davi.
7. Para encerrar o servidor, pressione **Ctrl+C** na janela aberta.

Alternativa pelo PowerShell:

```powershell
cd D:\davi-missoes
py -3 server.py
# Em outra janela/navegador: http://127.0.0.1:8765
```

Para rodar os testes da lógica:

```powershell
py -3 -m unittest discover -s tests -v
```

## Feriados: Brasil + Florianópolis

O cálculo é local e automático por ano, incluindo:
- Feriados nacionais fixos: 1/1, 21/4, 1/5, 7/9, 12/10, 2/11, 15/11, 20/11 e 25/12;
- Feriados municipais de Florianópolis: **23 de março, Sexta-feira Santa e Corpus Christi**.
- Sexta-feira Santa e Corpus Christi são calculados a partir da data da Páscoa.

Os feriados são identificados individualmente; uma atividade **não é excluída por padrão** nesses dias. Ao cadastrar uma série, marque **Não ocorrer em feriados** para omiti-los.

**Pontos facultativos** (como Carnaval) não são tratados automaticamente como feriados. **Datas especiais estaduais de Santa Catarina, suspensão de aulas, emendas, calendário escolar e feriados extraordinários ainda não estão modelados**. Confirme dias sem aula com o calendário da escola e, quando necessário, remova apenas a ocorrência.

Legislação de referência:
- Florianópolis: [Lei Municipal nº 8.046/2009](https://www.legisweb.com.br/legislacao/?id=174581) e [Decreto Municipal nº 28.928/2026](https://www.legisweb.com.br/legislacao/?id=490360).
- Brasil: [Calendário federal de 2026](https://agenciagov.ebc.com.br/noticias/202512/confira-o-calendario-oficial-de-feriados-nacionais-e-pontos-facultativos-em-2026).

## Segurança e dados

- No modo LAN simples, a agenda é acessível à sub-rede autorizada e o navegador recebe uma sessão infantil automática com token CSRF. Essa sessão não dá acesso administrativo e deixa de ser aceita quando o modo é desativado.
- O responsável usa a senha existente com hash PBKDF2-SHA256 e sessão de até oito horas. Fora do modo LAN simples, permanece o código temporário gerado pelo responsável e a sessão infantil de até 90 dias. Logout revoga a sessão no servidor.
- Cookies HttpOnly/SameSite=Strict; Secure na publicação HTTPS. Proteção de Origin/Host/CSRF e limitação de tentativas persistente.
- No modo LAN simples, permita somente TCP 8765 para `192.168.2.0/24` no perfil privado e IP local `192.168.2.10`, conforme o guia. Não encaminhe portas no roteador. HTTP não cifra o tráfego; esse modo pressupõe confiança na rede doméstica.
- Backups consistentes, rotação, integridade e restauração ficam em `maintenance.py`. O banco, backups, configuração privada e CA não são versionados.
- O acesso físico ao computador e a dispositivos autorizados exige cuidado. Sem recuperação automática por e-mail; guarde a senha do responsável.

## Cinco mundos 3D — V0.7 B

Floresta, nuvens, cidade dos robôs, tesouros e cristais agora usam cenas WebGL locais, com câmera, personagem e Pipo animados. Mundos, posições, descobertas e compras persistem. O responsável cria novos mundos com modelos prontos e vincula atividades/desafios. A ilha 2D continua disponível. Veja o [guia dos mundos 3D](docs/mundos-3d-v07.md) e as [capturas comparativas](docs/evidencias-v07-3d/README.md).

## Controle do responsável — V0.6D

Revogação individual de estrelas, histórico preservado, remoção/reativação de itens e correções de passos/compromissos no painel protegido. O mundo mostra todas as atividades da data, mesmo sem roteiro. Veja o [guia V0.6D](docs/controle-responsavel-v06d.md). A evolução 3D está documentada na etapa V0.7 B.

## Mundo de aventuras — Etapas A, B e C

A tela inicial infantil agora é a **Ilha das ideias**: caminhe com setas/WASD, botões de direção ou toque no chão. Visite os pontos de interesse, entre nas missões e use estrelas para construir a ponte, a casa na árvore e o portal. A oficina mostra preço e prévia; o guarda-roupa permite equipar chapéu/capa, escolher uma cor e vestir o Pipo. Saldo, construções e personagem persistem no servidor e aparecem nos outros aparelhos LAN. O calendário clássico continua disponível na ilha.

Aprender, os minigames e o esforço em Fazer podem conceder estrelas, com validação no servidor, crédito único e limite diário. Medicação e higiene essencial não recebem prêmio de realização; cuidados e acesso às missões nunca dependem de estrelas. O responsável ajusta preços, disponibilidade e valores em **Mundo e estrelas**. Veja o [guia curto da Etapa C](docs/etapa-c.md).

No painel do responsável, **Roteiros de missões** permite criar, editar, adicionar/remover e reordenar etapas com orientação, dica e fase de preparação/execução/retorno. Em uma atividade do calendário, **Roteiro e progresso** vincula a sequência à série ou somente à data escolhida. Nenhuma atividade recebe roteiro automaticamente.

Na agenda infantil, **Entrar na missão** abre a base ilustrada do Pipo com três modos: **Aprender**, **Fazer** e **Lembrar**. O executor mostra uma etapa por tela, com voz PT-BR opcional, dicas e ajuda. Os minigames **Trilha da memória** e **O que vai na bolsa?** exercitam sequência e memória com rodadas curtas, variação e recomeço. Som e movimento são opcionais.

Somente **Fazer** confirma/desfaz etapas realizadas fora da tela. O progresso é próprio de cada ocorrência e persiste ao reabrir. Aprender e ganhar um minigame **não alteram** etapas reais nem concluem o compromisso; a confirmação da agenda continua separada. Ocorrências iniciadas guardam uma versão da sequência, enquanto as seguintes recebem as edições do responsável. Veja [jogabilidade e teste rápido da Etapa B](docs/etapa-b.md).

Os dez roteiros originais foram importados para uma biblioteca editável, com modelos adicionais de Taekwondo, escola e futsal. A migração é aditiva, idempotente e faz backup antes de alterar uma agenda existente. Veja [arquitetura, API, migração e rollback](docs/v06-etapa-a.md) e [evidências sintéticas](docs/evidencias-v06-a/README.md). A publicação HTTPS V0.5 continua com a configuração existente.

## Protótipo lúdico da v0.1

A versão anterior, com 10 roteiros (banheiro, escovação, banho, mochila, quarto, sono, manhã, alimentação, sair, encerrar jogo), permanece em **`index.html`**. Você pode abri-la isoladamente no navegador. Os roteiros e design estão em `docs/PRODUTO-E-MISSOES.md`.

O protótipo isolado mantém seus modos e armazenamento próprios; ele não é servido pelo calendário e seu progresso local não é importado. O aplicativo atual integra os roteiros, os jogos e o mundo persistente das etapas A/B/C da [Issue #5](https://github.com/nellipe/davi-missoes/issues/5).

## Testes da interface (opcionais, desenvolvimento)

A aplicação continua exigindo somente Python e navegador. Para os testes de categorização e progresso, com Node.js instalado:

```powershell
node --test tests/test_visual.cjs
```

Para repetir a validação visual, instale as ferramentas de teste em uma pasta temporária, separada do projeto (essa preparação requer internet):

```powershell
$validationTools = Join-Path $env:TEMP 'davi-redesign-tools'
npm install --prefix $validationTools playwright@1.65.1 @axe-core/playwright@4.14.0
& (Join-Path $validationTools 'node_modules/.bin/playwright.cmd') install chromium
$env:NODE_PATH = Join-Path $validationTools 'node_modules'
node tests/browser_redesign.cjs
```

O script inicia seu próprio servidor na porta 18876, com `DAVI_DATA_DIR` em diretório temporário e **somente dados sintéticos**. Ele não inicia o servidor no banco pessoal. Ao terminar, encerra o servidor temporário, remove esse banco de teste e atualiza as capturas e o relatório em `docs/evidencias-v04/`. Se não houver launcher `py`, defina `$env:PYTHON` com o caminho do interpretador Python instalado. Para os testes Python e execução local, o equivalente é `python -m unittest discover -s tests -v` e `python server.py`.

## Limitações da v0.3

- A categoria é inferida pelo título e depois pelo ícone; textos ambíguos podem aparecer em “Outras”. É apenas apresentação.
- A próxima missão considera data e hora de Florianópolis (`America/Sao_Paulo`), usando o relógio do computador. Um horário anterior permanece pendente até confirmação manual, sem representar atraso ou falha. A duração não indica execução em andamento; não há início automático.
- A descrição em destaque é resumida a 160 caracteres; o texto completo permanece na agenda.
- Os modos do protótipo `index.html` continuam independentes; o calendário já integra roteiros e progresso por ocorrência pela Etapa A descrita acima.
- Os testes automatizados de acessibilidade não substituem avaliação com leitor de tela ou observação de uso pela família. Outros navegadores e toque físico não foram avaliados nesta entrega.

## Próximas etapas sugeridas

1. Revisar e cadastrar os compromissos reais e os dias sem aula do Davi.
2. Homologar e polir a experiência com a família, conforme Etapa D da Issue #5.
3. Alertas visuais/sonoros próximos da hora e lembretes configuráveis.
4. Ilustrações originais, avatar e mapas de progressão.
5. API com autenticação forte multiusuário e banco de servidor quando o produto estiver validado.

## Estrutura

```
server.py            # API local + calendário + SQLite
app.html             # Interface web da versão 0.3
app.css              # Estilos
app.js               # Painel infantil e responsável
Iniciar-Davi.bat     # Inicializador Windows
Iniciar-Davi.ps1     # Inicializador alternativo PowerShell
Iniciar-Davi-LAN.bat # Inicializador LAN explícito, sem instalação
tests/               # Testes das regras do calendário
index.html           # Jogo original da versão 0.1
docs/                # Design e roteiros das 10 missões
dados/               # Banco gerado localmente (ignorado pelo Git)
```


## Importar uma agenda pessoal sem publicar seus dados

**Não coloque informações particulares de crianças no repositório público.** Receba o JSON por canal privado, salve-o somente no seu Windows, e execute na pasta do projeto:

```powershell
py -3 .\importar_agenda.py "$env:USERPROFILE\Downloads\agenda-privada-davi.json" --simular
py -3 .\importar_agenda.py "$env:USERPROFILE\Downloads\agenda-privada-davi.json"
```

O importador valida o JSON, faz backup SQLite antes de inserir, preserva os dados existentes e reconhece cada atividade por uma chave estável: se executado de novo, não duplica os mesmos compromissos. O banco local fica em `dados/agenda.sqlite3`. Recarregue o navegador após importar.

O formato do JSON é `davi-agenda-v1`, contendo `events`, cada qual com `key` exclusiva e os mesmos campos do cadastro normal (título, horário, recorrência etc.). O importador é genérico e **não contém nenhuma agenda particular embutida**.

**Atenção aos limites:** há atividades que dependem de momentos relativos, como “ao acordar” ou “depois de almoçar”, para as quais ainda não existe um motor de gatilhos na agenda. Não invente um horário apenas para preencher o campo. Atividades em feriados e calendário escolar devem ser conferidas pelo responsável. A importação não é sincronização: alterações feitas no JSON após a primeira importação não atualizam eventos existentes com a mesma chave.
