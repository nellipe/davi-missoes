# V0.7 A — horário das confirmações

PR independente do mundo 3D, referente à frente A da Issue #13.

A criança pode confirmar e desfazer compromissos/passos somente do início agendado até duração + tolerância (padrão 30 min), inclusive o instante final. O relógio é o do servidor, em America/Sao_Paulo via zoneinfo. Horários enviados pelo navegador ou campos role não mudam a regra. A API responde 409 quando a janela está fechada, inclusive em abas antigas.

O responsável ajusta a tolerância global em Preferências (0–240 minutos) e corrige conclusões/passos fora da janela. Correções ficam registradas em schedule_corrections e no histórico de passos; não concedem estrelas automaticamente. Não há alteração de permissões infantis. A janela vale também para desfazer infantil e reivindicar estrelas reais. Aprender/Lembrar são livres, mas só concedem estrelas na janela; treinar fora não consome o crédito da ocorrência, que pode ser conquistado por novo treino dentro do horário.

O calendário/roteiro publica window.state (upcoming/open/expired), opens_at, closes_at e server_now. As atividades permanecem visíveis; Fazer e confirmação ficam desabilitados fora do prazo. Atualizar horário nos modos consulta novamente o servidor. Não há contagem regressiva. O backend sempre revalida no momento da escrita.

Uma ocorrência das 23:50 com 30 min de duração e tolerância de 30 fecha às 00:50 do dia seguinte. Essa é a janela da ocorrência anterior, e não uma liberação de todas as tarefas do dia anterior. A soma usa minutos decorridos em UTC, inclusive em transições históricas de horário de verão; hora local inexistente avança pelo salto e hora ambígua usa a primeira ocorrência (fold=0). Comparações a cada requisição acompanham alterações no relógio do servidor.

O fallback TZif de America/Sao_Paulo, de domínio público, está incluído para Windows sem IANA/tzdata instalado. Origem/versão em assets/timezones/README.md. Não há instalação de dependências nem acesso à rede no runtime.

Validação: suíte Python com relógio fixado nos testes, 9 testes JS, e tests/browser_schedule.cjs com servidor/banco temporários e dados sintéticos. Capturas em docs/evidencias-v07-horarios: agenda futura em 360 px, Fazer bloqueado em 390 px e configuração em 1366 px; verificações axe WCAG A/AA e overflow. Nenhum dado real ou serviço Windows foi usado. TLS real é opcional e requer DAVI_TEST_CADDY.

Comandos: `python -m unittest discover -s tests -v`, `node --test tests/test_visual.cjs`, `node tests/browser_schedule.cjs` (Playwright e axe disponíveis via NODE_PATH).
