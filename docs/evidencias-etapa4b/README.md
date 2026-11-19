# Etapa 4B · Quem mora sob a folha?

Na Floresta Encantada, siga os barquinhos até o varal. Escolha o piso de casca e entre no recanto ao lado do tronco oco. A ponta prateada tem patinhas. Perto da boca do tronco, dá para ver o besouro e a goteira. Toque na folha grande ou escolha **Virar a folha**. No teclado, pressione **E** junto à folha. Veja a água mudar de lado e o besouro levar sua telha para o novo abrigo. Vá até outra região e volte. A folha, a poça e o abrigo continuam como você deixou. [Game design publicado integralmente](../game-design/etapa4-floresta-viva.md)

## Evidências para revisão

[Vídeo contínuo no Chromium](besouro-1366.mp4). A gravação parte da clareira, acompanha a ida ao recanto, mostra a mudança de posição da folha, a saída para a garganta, a volta pelas lajes e um novo encontro com o besouro. **Agora** abre a ficha sintética “Mochila de teste” a partir do recanto.

| Cena | 360 px | 390 px | 1366 px |
|---|---|---|---|
| Bifurcação com câmera inicial | [Casca e lajes](bifurcacao-360.png) | [Casca e lajes](bifurcacao-390.png) | [Casca e lajes](bifurcacao-1366.png) |
| Primeiro encontro | [Besouro e goteira](encontro-360.png) | [Besouro e goteira](encontro-390.png) | [Besouro e goteira](encontro-1366.png) |
| Depois de virar a folha | [Abrigo e poça](abrigo-360.png) | [Abrigo e poça](abrigo-390.png) | [Abrigo e poça](abrigo-1366.png) |

O varal fica entre os braços, com as travessas escuras de um lado e as lajes largas do outro. A câmera em retrato abre um pouco o quadro na chegada e acompanha Davi com uma pequena folga para o lado da poça no recanto. Pipo reage com uma inclinação breve da cabeça. A pista sobre as patinhas pode ser pedida no controle de ajuda. A água, a folha e o besouro dão toda a resposta visual.

## Validação

- O navegador exercitou toque direto na folha em 360 px, ação contextual em 390 px e teclado em 1366 px. Nos dois tamanhos em retrato, verificou alvos nas duas entradas antes de usar qualquer controle de câmera.
- O percurso registrou a mudança da poça e do besouro, o retorno pelo bosque e a abertura da missão com **Agora**. A prova em retrato incluiu recarga, movimento reduzido, reversão da folha e retorno pelo 2D. Os ensaios comparam posição, saldo, inventário e a ocorrência da agenda. [360 px](besouro-360.json) · [390 px](besouro-390.json) · [1366 px](besouro-1366.json)
- Passaram 62 testes Python, quatro testes de navegação JavaScript, o ensaio de 30 alternâncias completas entre 2D e 3D e a visita aos dez destinos da clareira, incluindo missão com e sem roteiro, oficina, ponte, casa e baú.
- A descoberta ocupa parte do recanto da Etapa 3. O estado é uma única configuração salva no SQLite existente. O desenho de conexão caminhável da clareira à Soleira continua em revisão. Nesta versão a chegada à Soleira usa o acesso da Etapa 3.

As capturas são do jogo rodando em Chromium, com dados sintéticos em loopback. Celulares foram emulados. A leitura por uma criança e as medições nos aparelhos físicos continuam pendentes.

Para repetir as três larguras com Playwright, Chromium, Python e FFmpeg disponíveis, rode `node tests/browser_shelter.cjs 360`, `node tests/browser_shelter.cjs 390` e `node tests/browser_shelter.cjs 1366`. Defina `FOREST_EVIDENCE_DIR` para salvar os resultados numa pasta separada.
