# Matriz de aceitação — migração visual e de jogabilidade

| Dimensão | Prova exigida |
|---|---|
| Referência correta | Vídeo e referencia-cinematografica.html analisados; capturas do protótipo usadas como padrão, sem confundir com HTMLs interativos |
| Personagens | Davi e Pipo do jogo real se aproximam do desenho, volume, expressão, roupa e escala da referência; Pipo flutua por intenção com comportamento consistente |
| Cenário | Cores toon, contornos, árvores/bosques, água, caminho, roda, pedras, tronco e natureza com materiais e silhuetas legíveis |
| Câmera | Acompanhamento livre em 360, 390 e 1366px; rotação/toque; personagens identificáveis e oclusão contextual funcional |
| Controle | D-pad, WASD, clique/tap, ação E/toque; sem condução forçada por script de 20 s |
| Interações | Barquinho sai ao clicar, percorre calha e água; descobertas causam transição e recompensa visual observáveis |
| Economia real | Estrelas/inventário e vestuário obtidos via API, compras persistidas, nenhuma estrela creditada pela timeline local |
| Missões | Agora, agenda, Aprender/Fazer/Lembrar, horários e atividades sem roteiro continuam acessíveis |
| Continuidade | Todas as regiões e duas trilhas preservadas; posição compartilhada e 30 alternâncias 2D/3D sem regressão |
| Acessibilidade | Controles de toque adequados, teclado, contraste, foco e movimento reduzido, com consequência de ações ainda visível |
| Otimização | Compares equivalentes antes/depois em 360/390/1366px, Econômico/Detalhado: triângulos, draw calls, FPS, p95, carregamento, memória. Não inferir FPS mobile de RTX |
| Reprodutibilidade | Assets Blender/fontes licenciadas, modelos GLB e scripts funcionam do zero no ambiente de desenvolvimento |
| Segurança | Nenhum dado familiar, merge, deploy ou configuração infra alterada; PR rascunho para avaliação |

## Evidências exigidas na PR
1. Imagens lado a lado de **Etapa 7C vs integração** nos mesmos pontos/ângulos, com cena não preparada apenas para captura.
2. Vídeo de jogabilidade **real** no navegador com controle humano/automatizado de input, percorrendo trecho, interagindo e acionando Agora; não vídeo timeline do protótipo.
3. Imagens em 360/390/1366px e modo Econômico/Detalhado.
4. Testes automatizados de backend, navegação, persistência, compras, acessibilidade e fallback. Resultados reais, não inventados.
5. Diagnóstico técnico e limites; testes físicos dos aparelhos somente pelo responsável.

**Bloqueio:** Se perder missão, horários, inventário, progressão, controle familiar ou continuidade do mapa, não é aprovado independentemente de aparência.