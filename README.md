# Aventuras do Davi 🎮 — Agenda + Missões

Projeto familiar para acompanhar os compromissos do Davi e desenvolver autonomia nas rotinas diárias. Visual inspirado em jogos de aventuras em blocos, com identidade original (sem afiliação ao Roblox).

## Versão 0.3 — aventura em blocos

Identidade original com fundo claro, azul profundo, amarelo solar, mascote geométrico feito em CSS e botões com sombras táteis. Fontes, ícones e ilustrações são locais; nenhuma dependência de internet foi adicionada à aplicação.

A **área infantil** prioriza a primeira atividade pendente do dia escolhido, com horário, descrição curta e botão “Consegui!”. A barra mostra a quantidade efetivamente concluída; a agenda abaixo mantém a ordem dos horários, descrições completas e opção de desfazer. Nenhuma atividade é concluída pela passagem do tempo. Categorias são apenas pistas visuais, com texto, símbolo e cor, sem mudar os registros.

A **área do responsável** mantém o calendário mensal, formulários e senha. Em celulares, cada dia mostra a quantidade de atividades e um símbolo de feriado; ao selecionar o dia, a lista completa e o nome do feriado aparecem abaixo. Em telas maiores, o calendário também mostra prévias dos compromissos.

Detalhes de design, resultados e capturas com dados sintéticos: [Redesign v0.3](docs/redesign-v03.md).

## Agenda local preservada

A nova aplicação abre numa **área do Davi** com agenda do dia: horário, compromissos ordenados, marcação de conclusão e navegação entre datas.

A **área do responsável** exige senha cadastrada no primeiro acesso e inclui:
- Calendário mensal com atividades, datas selecionáveis e feriados destacados;
- Cadastro de atividades com horário, duração, ícone e descrição;
- Recorrência **única, diária, segunda a sexta, dias selecionados da semana ou mensal**;
- Data de início e fim opcional; opção de ignorar sábados/domingos e feriados;
- Exclusão de ocorrência específica ou série inteira; edição da série completa;
- Edição do nome exibido na área infantil;
- Registros de tarefas feitas por data e atividade.

**Dados locais:** SQLite criado em `dados/agenda.sqlite3`. Não usa serviços externos, API de feriados ou conta na nuvem. A interface só está disponível em `127.0.0.1` (no próprio computador).

## Windows — instalar e executar

Validado no Windows com **Python 3.13.5**. Requer **Python 3.10 ou superior** e navegador Chrome ou Edge. Não requer bibliotecas Python adicionais.

1. No GitHub, faça **Code → Download ZIP** e extraia; ou rode `git pull` se já clonou.
2. Abra a pasta extraída e dê dois cliques em **`Iniciar-Davi.bat`**.
3. Com a janela do servidor aberta, vá para **http://127.0.0.1:8765** no navegador.
4. Clique em **Responsável** e defina uma senha com pelo menos 10 caracteres.
5. Entre na área do responsável, clique em **Cadastrar atividade** e comece a montar a agenda.
6. Clique em **Minha aventura** para ver o painel do Davi.
7. Para encerrar o servidor, pressione **Ctrl+C** na janela aberta.

Alternativa pelo PowerShell:

```powershell
cd C:\davi-missoes
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

- O administrador tem senha armazenada como hash PBKDF2-SHA256 com salt; a sessão é mantida em cookie HttpOnly/SameSite=Strict, por até oito horas em memória.
- A interface do Davi **não exige autenticação nesta versão**; permite visualizar compromissos e marcar como feitos, apenas no próprio computador.
- A senha protege a *edição da agenda* pela interface/API; o programa e o banco permanecem acessíveis a quem tiver acesso ao sistema de arquivos do computador.
- A configuração inicial de senha é feita pela primeira pessoa que abrir a aplicação local; faça isso como responsável.
- **Não abra a porta 8765 no firewall e não coloque esse servidor na internet.** Ainda não existe autenticação de criança, multiusuário nem acesso remoto seguro.
- Para backup, encerre o programa e copie `dados/agenda.sqlite3` para uma pasta protegida; este arquivo contém agenda e hash da senha.
- Se perder a senha, **não há recuperação automática** na v0.3; guarde-a em um gerenciador de senhas.
- Os testes foram executados no Windows com Python 3.13.5 e Chromium automatizado. A revisão familiar e a avaliação com leitor de tela continuam recomendadas.

## Missões lúdicas da v0.1

A versão anterior, com 10 roteiros (banheiro, escovação, banho, mochila, quarto, sono, manhã, alimentação, sair, encerrar jogo), permanece em **`index.html`**. Você pode abri-la isoladamente no navegador. Os roteiros e design estão em `docs/PRODUTO-E-MISSOES.md`.

A **integração entre o calendário e a execução interativa das missões** é uma próxima etapa. Nesta versão, a agenda permite registrar o compromisso e marcá-lo como feito, mas **ainda não abre o passo a passo do jogo dentro do calendário**.

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

O script inicia seu próprio servidor na porta 18876, com `DAVI_DATA_DIR` em diretório temporário e **somente dados sintéticos**. Ele não inicia o servidor no banco pessoal. Ao terminar, encerra o servidor temporário, remove esse banco de teste e atualiza as capturas e o relatório em `docs/evidencias-v03/`. Se não houver launcher `py`, defina `$env:PYTHON` com o caminho do interpretador Python instalado. Para os testes Python e execução local, o equivalente é `python -m unittest discover -s tests -v` e `python server.py`.

## Limitações da v0.3

- A categoria é inferida pelo título e depois pelo ícone; textos ambíguos podem aparecer em “Outras”. É apenas apresentação.
- A próxima missão é a primeira atividade pendente na ordem da API, inclusive se o horário já passou; não há relógio de execução nem início automático.
- A descrição em destaque é resumida a 160 caracteres; o texto completo permanece na agenda.
- O jogo guiado do `index.html` ainda é independente. Nenhum botão sugere uma integração inexistente.
- Os testes automatizados de acessibilidade não substituem avaliação com leitor de tela ou observação de uso pela família. Outros navegadores e toque físico não foram avaliados nesta entrega.

## Próximas etapas sugeridas

1. Revisar e cadastrar os compromissos reais e os dias sem aula do Davi.
2. Integrar “Executar missão” à atividade programada.
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
