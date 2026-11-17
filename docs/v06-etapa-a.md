# V0.6 — Etapa A: missões ligadas ao calendário

Implementa a fundação da [Issue #5](https://github.com/nellipe/davi-missoes/issues/5): modelos editáveis, associação explícita, progresso e histórico por ocorrência, com migração segura. Esta PR não implanta nem reinicia os serviços V0.5.

## Uso

1. Entrar em **Responsável** com a senha existente e abrir **Roteiros de missões**.
2. Criar ou adaptar uma sequência: título, ícone, orientação concreta, dica opcional e fase de cada etapa. Usar **Subir/Descer** para mudar a ordem. Salvar preserva os identificadores das etapas existentes.
3. No calendário, abrir **Roteiro e progresso** de uma atividade e selecionar **Toda a série** ou **Somente esta data**. **Sem roteiro** é uma escolha válida; remover a exceção de uma data volta a usar a série.
4. Na área infantil, abrir **Ver passos da missão**. Ler as orientações, realizar a ação fora da tela e usar **Fiz esta etapa**. É possível desfazer e voltar depois. Não há prova obrigatória, tempo limite, prêmio ou punição.
5. O responsável acompanha a data pelo mesmo calendário e consulta até 200 execuções recentes na biblioteca, inclusive sequências de atividades que foram excluídas.

Uma preparação e um retorno podem pertencer à mesma ocorrência: os passos têm fases distintas, sem inventar horários de desbloqueio. A interface desta fundação mostra a sequência ordenada. O executor de uma etapa por tela, a narração e os modos Aprender/Fazer/Lembrar completos ficam para a Etapa B. A lista não exige passar por instruções para concluir um compromisso comum; eventos sem roteiro mantêm o comportamento V0.5.

## Regras de preservação

- Abrir uma missão é uma leitura: não inicia execução, não insere progresso e não conclui nada.
- A primeira confirmação cria uma execução com snapshot do roteiro, sua revisão e IDs de etapas. Consultas posteriores usam esse snapshot.
- Edições e reordenações atingem ocorrências ainda não iniciadas imediatamente na próxima consulta. Uma ocorrência iniciada mantém textos, ordem, versão e progresso anteriores, mesmo após remoção de uma etapa ou troca/desvinculação do roteiro.
- Uma nova data começa com progresso próprio. Não se reutiliza uma confirmação entre repetições de um evento, entre eventos ou entre templates.
- A aplicação é de uma criança: “individual por ocorrência” significa chave `(event_id, date)`, compartilhada entre seus aparelhos autorizados. Não há cadastro de múltiplas crianças nesta etapa.
- `step_progress` registra relato humano de realização real. `completions` continua sendo a confirmação independente do compromisso. Completar todos os passos não escreve em `completions`; concluir/desfazer um compromisso não altera os passos.
- Exceções e regras de recorrência, fins de semana e feriados são verificadas antes de ler/confirmar passos. Datas inválidas ou excluídas não criam progresso. Se o responsável mudar/excluir uma série depois, o histórico iniciado continua disponível na biblioteca, mas a ocorrência removida não pode receber novas confirmações.
- Arquivar conserva vínculos já existentes e histórico, impede novos vínculos e pode ser desfeito pelo responsável. Não há exclusão física de templates pela API.

## Modelo e limites de responsabilidade

`missions.py` concentra o domínio. `mission_catalog.json` é conteúdo estático local. `server.py` fornece autenticação, transações e validação de ocorrência. `app.js` usa a API existente com Host/Origin/CSRF e sessão V0.5.

| Tabela nova em agenda.sqlite3 | Responsabilidade |
| --- | --- |
| `mission_schema` | Versão aditiva da migração, independente do esquema legado. |
| `mission_templates` | Nome, ícone, revisão e arquivamento. |
| `mission_steps` | ID estável por template, posição, fase, orientação e dica. |
| `event_missions` | Vínculo com série (`date=''`) ou exceção de uma data; template nulo significa sem roteiro. |
| `mission_event_keys` | Identidade lateral estável da atividade, removida em cascata quando ela é excluída. Evita herdar progresso se SQLite reutilizar um ID legado. |
| `mission_runs` | Uma execução por identidade da atividade/data, com ID estável e snapshot imutável. Não depende de FK ao evento, para conservar histórico após exclusão. |
| `step_progress` | Última confirmação explícita de cada etapa da execução, com data de atualização. |
| `mission_history` | Histórico de mudanças de confirmação, autor por papel e instante; repetição do mesmo estado não duplica o histórico. |

IDs de passos permitem reordenação sem confundir etapas; revisões evitam sobrescrever edições de outro aparelho. A identidade lateral distingue uma nova atividade de outra excluída com o mesmo ID numérico, preservando o histórico antigo sem associá-lo à nova agenda. Edição obsoleta e tentativa de confirmar uma versão que mudou antes de iniciar retornam **409**, pedindo reabertura. Escritas de missões usam `BEGIN IMMEDIATE`, validação e commit antes de responder; dois aparelhos não criam execuções duplicadas.

Limites: 1–40 passos por roteiro, nome/título até 100 caracteres, orientação até 600, dica até 400, ícone até 12. Passos novos recebem IDs gerados pelo servidor quando omitidos. O responsável pode personalizar os dez roteiros originais; a importação não os sobrescreve novamente a cada início. Não são importados dados personalizados do localStorage do protótipo.

### Extensões futuras, sem implementação antecipada

- **Etapa B:** o executor usará snapshot/IDs/fases; uma sessão de prática ou minigame deverá ter armazenamento separado. Acertar um jogo nunca deverá chamar a confirmação de etapa ou o endpoint de conclusão do calendário.
- **Etapa C:** recompensas, inventário e mundo deverão ter tabelas e migrações próprias, referenciando fontes estáveis como `mission_runs.id` e eventos de esforço/prática. Uma concessão deverá ter chave idempotente e limites definidos pelo responsável. Não há contadores de moedas/estrelas, regras de prêmio, tabelas vazias de mundo, loja, mapa ou desbloqueios nesta PR.
- Etapas de higiene, sono, alimentação ou outras necessidades essenciais não são bloqueadas por progressão. Não foi criado roteiro de ingestão/medicação nem exigência de prova.

## API

Todas as rotas continuam atrás das verificações V0.5. Mutação exige JSON, Origin exato, sessão e CSRF. Operações administrativas exigem responsável; o acesso infantil automático HTTPS continua existindo. Erros de validação retornam 400, falta de autorização 403 e revisão obsoleta 409.

| Método / rota | Acesso | Conteúdo |
| --- | --- | --- |
| `GET /api/missions` | Responsável | Biblioteca com contagem de passos e revisão. |
| `POST /api/missions` | Responsável | `{name, icon, steps:[{title,instruction,hint,icon,phase}]}`. |
| `GET /api/missions/{id}` | Responsável | Template completo e IDs dos passos. |
| `PUT /api/missions/{id}` | Responsável | Corpo completo incluindo `revision`; ordem do array define a sequência. Manter IDs existentes, omitir ID para passo novo. |
| `PUT /api/missions/{id}/archive` | Responsável | `{archived:boolean, revision:integer}`. |
| `GET /api/missions/history` | Responsável | Até 200 execuções recentes, snapshots e confirmações por passo. |
| `GET /api/events/{id}/mission` | Responsável | Vínculos de série e datas. |
| `PUT /api/events/{id}/mission` | Responsável | `{template_id: id ou null, date: '' ou 'AAAA-MM-DD'}`. Data omitida aplica à série. |
| `DELETE /api/events/{id}/mission?date=...` | Responsável | Remove exceção da data; sem data remove vínculo da série. Não apaga execuções iniciadas. |
| `GET /api/events/{id}/mission?date=AAAA-MM-DD` | Sessão autorizada | Sequência efetiva, progresso, fase, IDs, revisão e indicação de início. |
| `PUT /api/events/{id}/mission/steps/{step_id}` | Sessão autorizada | `{date, template_id, revision, done:boolean}`; só confirma/desfaz etapa existente nesta ocorrência. |

O calendário recebe o campo adicional `has_mission`; os campos legados continuam iguais. O campo textual legado `events.mission` é preservado e não é usado para inferir vínculos nem sobrescrito pela migração. Os roteiros não são vinculados por heurística de título: o responsável escolhe quando o apoio é útil.

## Migração e backup

Na futura implantação aprovada, a inicialização faz o seguinte:

1. Se a agenda existir e não tiver a migração v1 de missões, executa backup SQLite consistente para `dados/antes-v06/davi-*.sqlite3`, com integridade verificada e retenção 14. Lê também dados já confirmados no WAL, sem copiar manualmente um banco aberto. Falha de backup interrompe a inicialização antes de qualquer DDL.
2. Mantém a inicialização legada e cria somente as tabelas adicionais, os 13 templates (10 originais + Taekwondo/escola/futsal) e seus passos, dentro de uma transação. A versão é gravada apenas ao terminar. Falha parcial reverte DDL e seed.
3. Não altera linhas/esquemas de `events`, `exceptions`, `completions`, `settings`, hashes, horários ou recorrências. Não troca a senha e não faz migração em `auth.sqlite3`.
4. Reinícios não reinserem catálogo nem sobrescrevem personalizações. O backup diário e `maintenance.py` existentes cobrem o banco inteiro, incluindo as novas tabelas.

Não foi executada migração em dados reais. Antes de uma implantação futura, conservar backup completo privado de `dados` e `publicacao`, com os serviços parados, seguindo [V0.5](publicacao-v05.md). Conferir acesso de leitura da LocalService aos novos módulos e ao JSON do catálogo, e escrita na pasta de backup; nenhum ajuste de ACL é aplicado por esta PR.

### Rollback futuro, somente após autorização

- Parar os serviços pelo procedimento V0.5, guardar uma cópia consistente do estado V0.6 e voltar ao commit V0.5 aprovado. As tabelas aditivas podem permanecer: o código V0.5 não as utiliza. Não é necessário apagar tabelas nem restaurar a agenda apenas para recuar o código.
- Se for indispensável desfazer também alterações de dados posteriores, conferir o snapshot de `dados/antes-v06` e usar `maintenance.py restore --database CAMINHO_AGENDA --source CAMINHO_SNAPSHOT --confirm-stopped`, com os serviços parados. Esse procedimento preserva uma cópia da agenda anterior à restauração e revoga sessões por segurança, conforme V0.5. Não substituir `auth.sqlite3` ou certificados.
- Uma restauração de snapshot anterior perde alterações feitas depois dele; por isso ela é uma decisão separada do rollback do código. Não apagar sidecars SQLite para forçar recuperação.

A preservação do esquema legado e a restauração/backup das novas tabelas foram validadas com fixtures sintéticas. O retorno físico dos serviços a uma versão anterior permanece uma operação de implantação futura; não foi executado no computador da família. Nenhum script de serviços, Caddy, firewall, DNS, certificados ou MikroTik foi modificado. A continuidade da publicação existente não exige criar novos serviços ou origens.

## Evidências

Veja [relatório e capturas](evidencias-v06-a/README.md). Os testes cobrem migração aditiva/idempotente e falhas, WAL, backup/restauração, preservação de hashes legados e SQLite de autenticação, templates, autorização, conflitos, duas sessões concorrentes, datas/exceções, progresso independente, histórico e HTTPS real com Caddy em loopback temporário. Não há GitHub Actions nesta entrega.
