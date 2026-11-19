# Etapa 9.2 · Microaventuras

| Mundo | Jogabilidade | Interações | Desfecho |
| --- | --- | --- | --- |
| Praia dos Tesouros | [Conchas e melodia](praia.mp4) | [Pista visual e sonora](praia-pista.jpg) · [Sequência no baú](praia-melodia.jpg) | [Pérola das Marés](praia-desfecho.jpg) |
| Vale dos Dinossauros | [Escavações e encaixes](dinossauros.mp4) | [Terra parcialmente escovada](dinossauros-escavacao.jpg) · [Encaixes com pista do Pipo](dinossauros-encaixes.jpg) | [Esqueleto montado](dinossauros-desfecho.jpg) |
| Cidade dos Inventores | [Válvula, bobina e comandos](inventores.mp4) | [Pressão](inventores-valvula.jpg) · [Circuito fechado](inventores-bobina.jpg) · [Ordem dos comandos](inventores-comandos.jpg) | [Dança do autômato](inventores-desfecho.jpg) · [Repetição em 2D](inventores-repeticao-2d.jpg) |

O roteiro `tools/forest/record_challenges.py` usa o aplicativo no Chromium e um banco SQLite descartável. O roteiro posiciona Davi junto aos pontos de interesse para concentrar os vídeos nos desafios. As soluções são jogadas pelos controles da tela.

A Praia foi jogada por teclado em desktop. Vale e Cidade foram jogados com toque em tela móvel emulada de 390 px, com verificações por teclado durante a escavação e na válvula. A gravação da Cidade também mostra a repetição em 2D a 360 px com movimento reduzido.

Os ensaios cobrem erro e correção sem perder os achados, ajuda progressiva do Pipo, retomada de uma escavação após recarregar, retomada do circuito e repetição depois da conclusão. Os vídeos registram a imagem do jogo. O roteiro confere separadamente as três notas com o som ligado e resolve a melodia com o som desligado.
