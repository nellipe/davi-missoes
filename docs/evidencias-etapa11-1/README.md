# Etapa 11.1 — Começar aventura do zero

Em **Responsável → Aventura e pausas → Recomeçar**, o responsável pode reiniciar somente a campanha ou começar uma partida nova. A segunda opção exibe o que será reiniciado e só fica disponível para confirmar após digitar **RECOMEÇAR**.

| Verificação | Evidência |
| --- | --- |
| Partida sintética com 10.000 estrelas e Cidade liberada | [Antes do reset](antes-cidade-e-saldo.jpg) |
| Diferença entre as duas ações | [Opções do painel protegido](duas-opcoes.jpg) |
| Confirmação explícita | [Diálogo com a palavra digitada](confirmacao-digitada.jpg) |
| Aba já aberta sincronizada com a nova partida | [Floresta inicial em 2D](depois-floresta-2d.jpg) |
| Reabertura após inicializar o servidor, em nova sessão | [Floresta inicial em 3D](depois-floresta-3d.jpg) |
| Só o primeiro capítulo aberto | [Seletor após o reset](capitulos-bloqueados.jpg) |
| Agenda com os registros originais | [Agenda após o reset](agenda-preservada.jpg) |

O SQLite sintético contém os quatro capítulos abertos, seis compras, um acessório removido, roupas equipadas, checkpoints, folha e besouro, as oito microaventuras concluídas, aprovações e tempo utilizado. A regressão compara o conteúdo lógico das tabelas da agenda, dos roteiros, das confirmações e das regras administrativas antes e depois. Também compara a autenticação e os bytes do arquivo sintético `auth.sqlite3`.

Os créditos e compras anteriores ficam arquivados por partida. A nova partida permite recomprar a ponte e os acessórios. Uma ocorrência futura pode render estrelas normalmente. A chave global do crédito e o registro das ocorrências já concluídas bloqueiam a reconcessão, inclusive quando o responsável havia confirmado todos os passos sem pedir as estrelas. A exclusão de itens, posições, prática e tempo de jogo faz parte da mesma transação que cria a nova partida.

Os testes cobrem perfil infantil, CSRF ausente, palavra incorreta, prévia do responsável, resets simultâneos, repetição da confirmação, falha ao registrar a operação, atualização de um banco legado e retorno após inicialização. As capturas e a operação de reset usam apenas SQLite sintético.

```powershell
$env:DAVI_TEST_CADDY = 'D:\davi-missoes\publicacao\bin\caddy.exe'
python -m unittest discover -s tests
node --test tests/test_activity_placement.mjs tests/test_visual.cjs tests/test_forest_navigation.mjs tests/test_world_map_navigation.mjs
python tools/forest/record_game_reset.py --chromium "$env:LOCALAPPDATA\ms-playwright\chromium_headless_shell-1255\chrome-headless-shell-win64\chrome-headless-shell.exe"
```
