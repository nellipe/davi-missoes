# Etapa C — Ilha das ideias

Implementa a [Issue #9](https://github.com/nellipe/davi-missoes/issues/9). A tela infantil abre um mundo ilustrado em SVG local: andar por toque, setas/WASD ou direcional; câmera acompanha o personagem no celular. O desenho e a câmera só são atualizados durante movimento; não há loop de animação rodando em repouso.

## Jogar, transformar e utilizar

- **Missões do dia** e a bandeira do Pipo abrem os modos e jogos existentes. O calendário clássico continua na placa da ilha e no cabeçalho.
- **Oficina de estrelas:** prévia e preço antes da compra. Ponte abre o bosque para caminhar; casa aparece na árvore e pode ser visitada; portal abre a seleção de missões/jogos. Nada é sorteado.
- **Meu personagem:** cores gratuitas, chapéu, capa e lenço do Pipo comprados com estrelas. Equipar é gratuito e reversível. As construções, acessórios, saldo, cor e posição são compartilhados entre os aparelhos autorizados.
- **Baú de treino:** mostra o prêmio previsto e revela as estrelas já guardadas no servidor. Abrir o baú não concede outro prêmio. Som opt-in, movimento reduzido e voz das missões continuam da Etapa B.
- **Responsável → Mundo e estrelas:** valores por modo, limite diário, preços e disponibilidade dos itens, além das últimas conquistas/compras. Itens já adquiridos não desaparecem ao desativar sua venda.

Padrão: 1 estrela por Aprender, 2 por cada tipo de minigame e 2 pelo esforço em finalizar os passos reais de um roteiro elegível; máximo 12 por dia. Cada modo só recompensa uma vez por identidade de atividade/data. Revisão do roteiro não muda essa chave; repetir treino, editar ou desfazer/refazer não produz duplicatas. Gastar estrelas não libera novamente o limite diário. Quando o limite é atingido o jogo continua disponível, sem perda de saldo ou punição.

Fazer só concede prêmio aos roteiros originais de preparação/organização elegíveis. Cuidados essenciais e medicação ficam excluídos, incluindo títulos/instruções que indiquem esses cuidados. Aprender/Lembrar reconhecem prática de memória, nunca prova de cuidado. Nenhuma tarefa ou cuidado exige prêmio, compra ou comprovação de ingestão. O compromisso da agenda e o progresso real continuam separados dos jogos.

## Persistência simples

`world.py` cria seis tabelas aditivas: configurações, catálogo, inventário, extrato idempotente, estado do mundo e sessões de prática. A inicialização usa o backup SQLite consistente já existente em `dados/antes-v06` antes da mudança; falha de backup interrompe a migração. Nenhuma linha/esquema legado ou hash de senha é regravado. Reiniciar não reinicializa o mundo.

O servidor cria cada desafio de memória e valida as respostas/rodadas. Aprender registra avanços ordenados. Os eventos `davi:practice-complete` do navegador são apenas feedback de interface, sem autoridade para creditar. Créditos, limite diário, compras e inventário são transacionais; comprar novamente retorna o item sem nova cobrança. Saldo e preços são sempre calculados no servidor. Uma mudança de preço exige reabrir a prévia antes de comprar.

Nenhuma dependência de runtime externa, conta online, pagamento, anúncio, sorteio ou ranking. `world.js`/`world.css` cuidam do mapa e reutilizam o Pipo e os jogos locais. O personagem representa uma única criança, compartilhado pela família, como a agenda existente.

## Validação sintética

```powershell
python -m unittest discover -s tests -p test_world.py -v
$env:NODE_PATH = Join-Path $env:TEMP 'davi-v06-browser-tools/node_modules'
node tests/browser_gameplay.cjs
```

Quatro testes essenciais cobrem emissão única, limite, edição, respostas inválidas, compra única/insuficiente, avatar entre sessões, proteção administrativa, isolamento de tarefas e migração/backup. A jornada de navegador usa apenas SQLite TEMP e servidor loopback: joga, ganha estrelas, conclui esforço elegível, ajusta preços no painel, compra três construções, equipa avatar/Pipo, anda e reencontra tudo em uma segunda sessão. Usa preços reduzidos pelo responsável na fixture para exercitar todos os itens. Verifica 360/390 px e desktop, sem overflow ou violações axe A/AA detectadas. A regressão da agenda/editor também permanece disponível.

Capturas: [ilha inicial](evidencias-etapa-c/ilha-inicial-1366.png), [mundo construído](evidencias-etapa-c/ilha-construida-1366.png), [personagem](evidencias-etapa-c/personagem-390.png) e [exploração no celular](evidencias-etapa-c/exploracao-360.png).

Worktree isolado `D:\davi-missoes-etapa-c`, partindo de `024481f`. Nenhuma execução sobre banco real, pasta servida, serviços Windows ou configuração de rede/HTTPS. Sem merge/deploy. Homologação física com os aparelhos da família continua após aprovação.
