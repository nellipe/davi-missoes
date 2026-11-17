# V0.6D — controle do responsável e atividades no mundo

Esta entrega cobre os itens 1 e 2 da Issue #11. A evolução para mundo 3D cartoon fica para uma próxima etapa, em PR separada.

## Uso

- No painel protegido, **Mundo e estrelas** mostra saldo, itens adquiridos e histórico completo. Cada concessão informa registro em UTC, atividade, data da ocorrência, modalidade, estrelas e estado. Compras mostram o estado atual do item. Os preços e valores ficam em **Ajustar recompensas e preços**.
- **Revogar esta concessão** pede motivo opcional e confirmação. O crédito original permanece e um ajuste negativo é acrescentado ao extrato. Repetir a requisição não desconta outra vez. Repetir a mesma atividade/data/modalidade não recupera o crédito revogado; a revogação também não libera novamente o limite diário.
- Se as estrelas já foram gastas, o saldo pode ficar negativo. Novas compras exigem recompor o saldo; itens comprados permanecem. Não há remoção automática de construções.
- **Remover / Reativar** afeta somente o item selecionado, sem estorno nem nova cobrança. Remover um acessório o desequipa; reativar permite equipá-lo novamente. A remoção reposiciona o personagem na ilha principal para evitar ficar preso sem ponte/portal. A mudança também fica no extrato, com zero estrelas.
- No calendário do responsável, **Confirmar compromisso / Desfazer** corrige a conclusão da data. **Roteiro e progresso → Ver passos e progresso** permite confirmar/desfazer cada passo. Esses controles são separados das estrelas: não geram ou revogam créditos automaticamente.
- O mundo oferece **Atividades do dia** com todas as atividades, horário e status. Com roteiro, abre Aprender/Fazer/Lembrar; sem roteiro, abre a agenda. A data pode ser escolhida diretamente ou pelos botões anterior/próximo/hoje. Um dia vazio aponta para os compromissos e explica o cadastro/vínculo pelo responsável.
- Para vincular um roteiro: selecionar a data no calendário do responsável, **Roteiro e progresso**, escolher o roteiro e salvar. É possível aplicar à série ou à data. Versões já iniciadas conservam o roteiro anterior.

## Persistência e publicação

Migração aditiva de SQLite: contexto no extrato e estado ativo no inventário. O mecanismo existente faz backup antes da migração. Reinicializar não repete a migração nem altera saldos. Créditos antigos sem contexto recuperam o título pelo identificador estável da atividade; se a atividade já foi excluída, aparecem como “Atividade anterior”, mantendo data e modalidade. Novos créditos guardam o título no próprio registro.

O painel informa **versão 0.6D-1**, obtida do backend em execução. Isso ajuda a distinguir a instalação publicada do código disponível no GitHub. Merge de PR não atualiza os serviços Windows: a publicação continua sendo uma ação posterior explícita, conforme o procedimento V0.5. Esta entrega não altera instalação, serviços ou dados reais.

## Validação sintética

```powershell
python -m unittest discover -s tests -v
node --test tests/test_visual.cjs
# Com playwright e @axe-core/playwright disponíveis via NODE_PATH:
node tests/browser_parent_controls.cjs
```

O teste de navegador inicia processo próprio em porta livre e diretório temporário, sem usar a agenda da família, e encerra/remove seus dados ao terminar. Exercita datas, atividades com/sem roteiro, revogação pela interface após compra, remoção/reativação, vínculo em dia futuro, correção de passos e conclusão. Verifica ausência de erros JavaScript, overflow e violações axe WCAG A/AA em 1366 e 360 px. Capturas e resultado: [evidências](evidencias-v06-d/README.md).

A suíte Python cobre autorização/CSRF, revogação idempotente, saldo negativo, bloqueio de compras, não reconcessão, inventário sem desconto duplo, correções separadas e migração da versão anterior. TLS real permanece opcional e exige DAVI_TEST_CADDY. Não foram alterados serviços para executar testes.
