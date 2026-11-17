# Etapa B — uma base para brincar e fazer

> Referência da entrega B. A [Etapa C](etapa-c.md) já integra validação de prática no servidor, estrelas e mundo persistente.

Implementa a [Issue #7](https://github.com/nellipe/davi-missoes/issues/7). No calendário infantil, escolha **Entrar na missão** de um compromisso que tenha roteiro vinculado pelo responsável.

- **Aprender:** explorar uma etapa por tela; ouvir em PT-BR quando a voz estiver disponível, voltar, pedir dica ou chamar o responsável. Não confirma execução.
- **Fazer:** realizar o passo fora da tela e confirmar. Retoma no primeiro passo pendente; permite rever/desfazer e visitar fases de preparação, atividade e retorno. A conclusão do compromisso permanece separada na agenda.
- **Lembrar:** ordenar de 2 a 4 passos na **Trilha da memória** ou memorizar a lista e escolher itens em **O que vai na bolsa?**. São duas rodadas curtas, com pistas, possibilidade de retirar/trocar escolhas e recomeçar. Sem punição, ranking ou cronômetro.

A bolsa usa kits ilustrados de Taekwondo, escola, mochila e futsal. A lista muda a cada treino e é do jogo; a bolsa real continua combinada com o responsável. Outros roteiros usam a trilha baseada nos passos editados. O cenário e o companheiro Pipo são ilustrações vetoriais locais; não há serviços externos, fontes remotas ou ativos de outras marcas.

Som começa desligado; narração só toca quando solicitada. **Sem movimento** e a preferência de movimento reduzido do aparelho interrompem animações. Essas duas preferências ficam no navegador. A interação funciona por toque, mouse e teclado, sem exigir arrastar objetos. O foco acompanha o novo passo; pistas e feedback têm anúncio acessível.

## Encaixe para a próxima etapa

`game.js` cuida do jogo e recebe a missão pela API existente. Só os controles de **Fazer** chamam o endpoint de confirmação real. Os jogos não escrevem em SQLite.

Ao terminar Aprender ou duas rodadas de Lembrar, é emitido `davi:practice-complete`, com contrato `version:1`, ID de sessão, modo/desafio, missão/revisão, evento/data, rodadas, dicas e instante de término. A aplicação guarda apenas as dez sessões recentes em memória da página. Recarregar limpa essa prática; o progresso real continua persistido. A Etapa C poderá consumir o contrato com validação própria no servidor. **Não há moedas, concessão de estrelas, inventário ou mundo persistente nesta etapa.**

## Teste essencial, somente com dados sintéticos

No worktree de desenvolvimento, com Playwright e axe instalados em pasta temporária:

```powershell
$env:NODE_PATH = Join-Path $env:TEMP 'davi-v06-browser-tools/node_modules'
node tests/browser_gameplay.cjs
```

O teste abre um servidor loopback em porta efêmera e SQLite em TEMP. Demonstra os três modos em Taekwondo e mochila, dois minigames completos, tentativa com pista/recomeço, teclado, voz PT-BR solicitada, som/movimento opcionais e retomada após voltar à agenda. Compara diretamente `step_progress` e `completions` da fixture antes/depois dos treinos. Verifica acessibilidade e ausência de overflow em 360 e 1366 px. A regressão do editor/vínculos continua em `tests/browser_missions.cjs`.

Capturas sintéticas: [base de missões](evidencias-etapa-b/taekwondo-modos-1366.png), [executor no celular](evidencias-etapa-b/taekwondo-fazer-360.png), [trilha](evidencias-etapa-b/taekwondo-trilha-360.png) e [bolsa](evidencias-etapa-b/mochila-bolsa-1366.png).

Desenvolvimento em `D:\davi-missoes-etapa-b`, separado da pasta servida. Sem mudança de esquema, instalação, serviço Windows, configuração HTTPS ou banco real. Nenhum merge/deploy executado. Voz e som físicos dependem do aparelho e não foram homologados com a família nesta PR.
