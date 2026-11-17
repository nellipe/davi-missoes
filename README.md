# Aventuras do Davi 🎮 — Agenda + Missões

Projeto familiar para acompanhar os compromissos do Davi e desenvolver autonomia nas rotinas diárias. Visual inspirado em jogos de aventuras em blocos, com identidade original (sem afiliação ao Roblox).

## Versão 0.4 — publicação interna em revisão

Autenticação obrigatória para consultar a agenda, autorização persistente de aparelhos infantis, HTTPS local com Caddy, preparação de serviços Windows e firewall restrito à rede doméstica. **Nada foi implantado.** Os scripts que alteram Windows exigem aprovação expressa.

Veja [o guia de publicação v0.4](docs/publicacao-lan-v04.md) para arquitetura, configuração, certificados, serviços, backup, atualização, rollback e limitações dos testes. Esta branch depende da [PR #1 (redesign)](https://github.com/nellipe/davi-missoes/pull/1), que permanece sem merge.

## Redesign v0.3 preservado

Identidade original com fundo claro, azul profundo, amarelo solar, mascote geométrico feito em CSS e botões com sombras táteis. Fontes, ícones e ilustrações são locais; nenhuma dependência de internet foi adicionada à aplicação.

A **área infantil** prioriza a próxima atividade pendente com horário igual ou posterior ao atual na data escolhida, com horário, descrição curta e botão “Consegui!”. A barra mostra a quantidade efetivamente concluída; a agenda abaixo mantém a ordem dos horários, descrições completas e opção de desfazer. Pendências de horários anteriores continuam visíveis, com aviso e identificação na lista. Nenhuma atividade é concluída pela passagem do tempo. Categorias são apenas pistas visuais, com texto, símbolo e cor, sem mudar os registros.

A **área do responsável** mantém o calendário mensal, formulários e senha. Em celulares, cada dia mostra a quantidade de atividades e um símbolo de feriado; ao selecionar o dia, a lista completa e o nome do feriado aparecem abaixo. Em telas maiores, o calendário também mostra prévias dos compromissos.

Detalhes de design, resultados e capturas com dados sintéticos: [Redesign v0.3](docs/redesign-v03.md).

## Agenda local preservada

Depois da autorização do aparelho, a aplicação abre na **área do Davi** com agenda do dia: horário, compromissos ordenados, marcação de conclusão e navegação entre datas.

A **área do responsável** exige senha existente ou criada offline pelo responsável e inclui:
- Calendário mensal com atividades, datas selecionáveis e feriados destacados;
- Cadastro de atividades com horário, duração, ícone e descrição;
- Recorrência **única, diária, segunda a sexta, dias selecionados da semana ou mensal**;
- Data de início e fim opcional; opção de ignorar sábados/domingos e feriados;
- Exclusão de ocorrência específica ou série inteira; edição da série completa;
- Edição do nome exibido na área infantil;
- Registros de tarefas feitas por data e atividade.

**Dados locais:** SQLite criado em `dados/agenda.sqlite3`. Não usa serviços externos, API de feriados ou conta na nuvem. O padrão continua sendo `127.0.0.1`. A publicação LAN é configurada separadamente, com HTTPS e autorização por aparelho.

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

- Toda consulta da agenda e conclusão exige sessão autorizada. Um aparelho novo recebe apenas a tela de entrada.
- O responsável usa senha com hash PBKDF2-SHA256 e sessão de até oito horas. A criança usa código temporário gerado pelo responsável e sessão de até 90 dias. Logout revoga no servidor; as preferências permitem revogar todos os aparelhos infantis.
- Cookies HttpOnly/SameSite=Strict; Secure na publicação HTTPS. Proteção de Origin/Host/CSRF e limitação de tentativas persistente.
- Não abra a porta do Python no firewall. Publique apenas o proxy HTTPS restrito à LAN conforme o guia, sem encaminhamento de portas no roteador.
- Backups consistentes, rotação, integridade e restauração ficam em `maintenance.py`. O banco, backups, configuração privada e CA não são versionados.
- O acesso físico ao computador e a dispositivos autorizados exige cuidado. Sem recuperação automática por e-mail; guarde a senha do responsável.

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

O script inicia seu próprio servidor na porta 18876, com `DAVI_DATA_DIR` em diretório temporário e **somente dados sintéticos**. Ele não inicia o servidor no banco pessoal. Ao terminar, encerra o servidor temporário, remove esse banco de teste e atualiza as capturas e o relatório em `docs/evidencias-v04/`. Se não houver launcher `py`, defina `$env:PYTHON` com o caminho do interpretador Python instalado. Para os testes Python e execução local, o equivalente é `python -m unittest discover -s tests -v` e `python server.py`.

## Limitações da v0.3

- A categoria é inferida pelo título e depois pelo ícone; textos ambíguos podem aparecer em “Outras”. É apenas apresentação.
- A próxima missão considera data e hora de Florianópolis (`America/Sao_Paulo`), usando o relógio do computador. Um horário anterior permanece pendente até confirmação manual, sem representar atraso ou falha. A duração não indica execução em andamento; não há início automático.
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
