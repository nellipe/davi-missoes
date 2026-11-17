# Aventuras do Davi — Missões do Dia 🎮

Protótipo de aplicativo educativo **offline** para ajudar uma criança de 8+ anos a praticar sequências de tarefas cotidianas com apoio visual, texto e áudio. O estilo de aventura em blocos é original; não é um produto Roblox nem utiliza seus personagens.

## Como abrir no Windows

1. Abra o repositório e selecione **Code → Download ZIP**.
2. Extraia o ZIP no computador.
3. Dê dois cliques em `index.html` (Chrome ou Edge atualizado).
4. Ative o áudio do computador. A voz é sintetizada pelo navegador; dependendo do sistema, vozes em português precisam estar instaladas.
5. Escolha uma missão e um modo de jogo.

Alternativa para desenvolvedores:

```powershell
git clone https://github.com/nellipe/davi-missoes.git
cd davi-missoes
start .\index.html
```

**Sem npm, build, instalação ou internet obrigatórios para a aplicação.** O jogo usa apenas HTML/CSS/JavaScript e emojis do sistema.

## Funcionalidades

- **Aprender:** passo a passo com texto, símbolo visual e leitura por voz (Web Speech API).
- **Fazer:** sequência de apoio durante uma tarefa real; a criança avança quando termina a etapa.
- **Lembrar:** desafio de ordenar etapas; erros não retiram estrelas, e dicas são permitidas.
- **Estrelas:** por participação e conclusão dos modos (1/2/3 estrelas), sem metas competitivas.
- **Área do responsável:** nome, áudio, criação, edição e exclusão de missões (2 a 20 etapas).
- **Backup JSON:** exportação/importação de missões, progresso e preferências.
- **Privacidade:** nenhum dado é enviado a serviço externo pelo código; armazenamento local no navegador.

## Dez missões iniciais

| # | Missão | Área |
|---|---|---|
| 1 | Operação Banheiro | Banheiro |
| 2 | Poder do Sorriso | Higiene bucal |
| 3 | Missão Banho | Banho |
| 4 | Inventário da Mochila | Escola |
| 5 | Base Organizada | Quarto |
| 6 | Portal do Descanso | Sono |
| 7 | Start do Dia | Manhã |
| 8 | Missão Refeição | Alimentação |
| 9 | Pronto para Sair | Saída |
| 10 | Fim da Partida | Encerrar brincadeiras/telas |

As instruções são **modelos personalizáveis**, não protocolos universais: adapte a idade, a autonomia e os hábitos da família. Para começar, é melhor usar apenas uma ou duas missões com acompanhamento e combinar o apoio visual com pistas no ambiente real.

## Limitações da versão 1

- Ícones são emojis, **não ilustrações individuais**. Nem todos os sistemas os exibem da mesma forma.
- A voz depende do navegador e das vozes instaladas; o áudio pode variar e não há arquivos de áudio pré-gravados.
- O armazenamento local não sincroniza dispositivos, e pode desaparecer ao limpar os dados do navegador.
- A área do responsável **não possui senha**. Não é indicada para exposição pública sem autenticação.
- O modo Fazer depende do toque consciente em **Próximo**; o sistema não verifica se a tarefa realmente foi executada.
- Os passos de banheiro, higiene e segurança exigem personalização conforme necessidades individuais.
- Sem rastreamento, notificações, analytics ou integração Roblox.

## Orientação de uso

O jogo é ferramenta de apoio, não diagnóstico ou tratamento. Evite pressão, punições, comparação ou exigência de perfeição. Valorize tentativas e o progresso gradual. Use auxílio de um adulto em atividades que envolvam água quente, segurança, higiene ou saída de casa.

## Arquivos

- `index.html`: aplicação completa, autocontida.
- `docs/PRODUTO-E-MISSOES.md`: conceito, design, 10 sequências, narração e roadmap.

## Próxima validação sugerida

1. Testar no Edge/Chrome do Windows, inclusive som.
2. Conferir em telas pequenas.
3. Validar **Operação Banheiro** com Davi e revisar a ordem real das etapas.
4. Fazer um desafio Lembrar e verificar clareza de dicas.
5. Editar uma missão e exportar backup.
6. Testar fechar/reabrir o navegador e conferir progresso.

**Versão:** 0.1 — protótipo familiar para validação.
