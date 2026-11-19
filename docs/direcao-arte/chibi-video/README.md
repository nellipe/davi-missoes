# Etapa 8 — direção artística oficial Cartoon Chibi (vídeo do responsável)

## Decisão
Esta pasta registra a decisão do responsável em 19/11/2026: **o HTML que originou o vídeo de aproximadamente 20 segundos é a referência artística principal**. O objetivo não é reproduzir o vídeo como animação automática, mas transferir o seu estilo e sua linguagem de interação para a Floresta Encantada jogável existente.

**Referência canônica:** [referencia-cinematografica.html](referencia-cinematografica.html). É derivada do upload exatamente nomeado **aventuras-do-davi-chibi(1).html** (sem espaço antes do parêntese): roteiro de 20 segundos com API window.renderAt(t). A proposta original também está em [proposta-visual-original.md](proposta-visual-original.md).

**O vídeo entregue pelo responsável:** aventuras-do-davi-chibi.mp4, 19,866667 segundos, SHA-256 148691a6faa3aa092f7252915a9af2bc9f4ca24d202e97027943d4e992715187. **Não está versionado nesta pasta** (arquivo de vídeo de 19,6 MB); a sequência pode ser reproduzida com o HTML canônico e o próprio vídeo pode ser guardado fora do Git. Se o vídeo precisar estar disponível na máquina do Codex, o responsável poderá copiá-lo localmente; não presumir que o Codex CLI tenha acesso aos anexos desta conversa.

O HTML original do usuário tinha SHA-256 c95bb5f79554b6b058dcb5ab65142704de8e39da322216bd8f85de09b69b2b95. Nesta cópia de consulta foram **removidos apenas os três blocos de fontes binárias embutidas**, substituídos pelo carregamento de Fredoka via Google Fonts, para evitar redistribuir arquivos de fonte. Portanto, a cópia em Git não é idêntica byte a byte ao upload. O protótipo ainda usa Three.js 0.170 via CDN; isso vale **somente para a referência**, não para o jogo LAN que deve continuar com assets locais.

## O que o Codex precisa abrir, nesta ordem

1. [referencia-cinematografica.html](referencia-cinematografica.html), renderizar e observar a cena animada, inclusive os personagens, as fases, a câmera e os efeitos.
2. [proposta-visual-original.md](proposta-visual-original.md), como intenção criativa. Recomendações genéricas de novas tecnologias não são autorização para alterar a arquitetura do jogo.
3. [PLANO-INTEGRACAO.md](PLANO-INTEGRACAO.md), para mapear o protótipo aos recursos reais e à arquitetura.
4. [CRITERIOS-ACEITE.md](CRITERIOS-ACEITE.md), para comprovar paridade visual e funcional.
5. [PROMPT-CODEX.md](PROMPT-CODEX.md), instrução executável da nova etapa.
6. Código atual do projeto: forest.js, forest.css, app.js, world.js, assets/forest/*.mjs, ferramentas Blender, server.py, forest.py, world.py, testes e documentação da Etapa 7C.

## Identidade visual escolhida
- Câmera mais baixa e próxima, com Davi e Pipo legíveis, sem ficar presa ao roteiro do vídeo.
- Toon com desenho de contorno roxo-escuro e cores limpas; elementos interativos em amarelo.
- Davi de óculos, cabeça grande, roupa verde-água, mochila e reações visíveis.
- Pipo branco, visor turquesa, broto e **flutuação intencional com animação**. É uma decisão artística nova; não confundir com o antigo defeito de deslizar involuntariamente.
- Riacho turquesa, pedras claras/lilases identificáveis, roda e calha em evidência, copas esculpidas, fungos, tronco oco e descoberta da criatura.
- HUD com botões infantis táteis, marcador de região, botão contextual destacado, estrelas e balão do Pipo.
- Toda ação com consequência visível e feedback, conectada à economia e às missões reais; **não premiar estrelas apenas pelo tempo de reprodução**.

## Convivência com o legado
A nova branch descende do último commit da PR #17. O histórico e os recursos funcionais permanecem no código, embora a PR #17 seja encerrada **sem merge**. Esta nova PR também inclui as mudanças históricas que ainda não estão em main; **não presumir que a base main já tenha os recursos da Floresta**.

**Não mexer na produção, banco familiar, serviços Windows, Caddy, DNS ou certificados. Sem merge e sem deploy automático.**