# Etapa 8C.1 · HTTP 502 na publicação e estabilidade do backend

A revisão `94e061dee9fed1af8656c6491ce3d85872b2dcc9` respondeu pelo HTTPS nas duas tentativas de publicação. O Chromium encontrou um 502 ao abrir a Floresta e o publicador voltou para `5abdf765ecdeaa93b8eb6cd8b7b71d1649bc4dfe` em ambas. A investigação abaixo consultou os registros da instalação e executou os ensaios somente em loopback com dados sintéticos. [Revisão da PR #19](https://github.com/nellipe/davi-missoes/pull/19#issuecomment-7016121853).

## Linha do tempo de 19/11/2026 (UTC−03)

| Marco | Primeira tentativa | Segunda tentativa |
|---|---|---|
| Python iniciado pelo WinSW | 13:36:47.611, PID 56496 | 13:39:32.634, PID 39820 |
| Caddy iniciado pelo WinSW | 13:36:47.795, PID 43364 | 13:39:32.820, PID 61212 |
| Build servido antes da abertura | `94e061d`, HTTP 200 | `94e061d`, HTTP 200. A sondagem sequencial de HTML e módulos também passou |
| Recusa de conexão em `127.0.0.1:8765` | 13:36:49.160, HTTP 502 em `/assets/forest/chibi.mjs` | 13:39:37.398, HTTP 502 em `/assets/forest/sight.mjs` |
| Início da parada comandada para rollback | Caddy 13:37:10.169; Python 13:37:10.523 | Caddy 13:39:38.803; Python 13:39:39.145 |
| Python após rollback | 13:37:11.529, PID 61640 | 13:39:40.397, PID 1260 |
| Caddy após rollback | 13:37:11.700, PID 28888 | 13:39:40.570, PID 65124 |

Os PIDs das duas tentativas coincidem com os PIDs que o WinSW encerrou por comando do rollback. Não apareceu reinício entre o começo de cada tentativa e a sua parada. O stderr do DaviApp estava vazio, o stdout só registrava partida e backup, e a consulta ao SCM e ao Application Error no intervalo não retornou os eventos 7031, 7034, 7035, 7036, 1000, 1001 ou 1002 relevantes. A abertura da segunda tentativa também interrompeu o verificador antigo ao registrar o erro. O 502 e o recurso atingido foram confirmados independentemente pelo log do Caddy.

A conferência de produção nesta investigação usou o endpoint público `/api/build`, com a CA instalada e hostname validado, e consultas de leitura ao SCM e às portas. O Python do PID 1260 continuava escutando em `127.0.0.1:8765`, filho do wrapper 34276. O Caddy do PID 65124 continuava no listener HTTPS, filho do wrapper 60088. Os serviços estavam em `Running` e o SHA servido era `5abdf76`.

## Causa reproduzida

Python 3.13.5 usava a fila de aceitação TCP padrão de cinco conexões no `ThreadingHTTPServer`. Quando o Caddy 2.11.9 recebe uma rajada HTTP/2, ele pode abrir muitas conexões simultâneas ao backend HTTP. Nessa condição o Windows recusou conexões enquanto o mesmo processo continuava atendendo outras. Isso explica por que uma sondagem pontual de `/api/build` ou uma série de GETs sequenciais passou antes do erro.

O ensaio reproduziu o mesmo 502 de upstream com a versão 8C original. A comparação controlada no commit de código `01beea1e757cf5a9a52ac8a70ef89af3957d92ad` reproduziu a recusa com fila de cinco e eliminou as recusas alterando apenas o tamanho dessa fila para 128. O processo permaneceu vivo e respondeu a `/api/build` após a pressão nos dois casos. Os 502 reproduzidos atingiram tanto rotas estáticas quanto API. `server.py`, `chibi.mjs` e `sight.mjs` tinham o mesmo conteúdo em `5abdf76` e `94e061d`. Adotar a fila de 128 manteve o mesmo `forest_navigation.py`, o mesmo `obstacles.json` e a mesma API de mapa durante o teste.

Essa é a causa demonstrada em Windows que corresponde ao incidente. Na janela familiar não havia captura de SYNs nem contador da fila TCP para observar diretamente a lotação de cada recusa. Os registros descartam um reinício do processo entre a partida e as paradas comandadas e não apresentam evidência de falha de importação, conflito de porta, falta de memória ou intervenção de segurança. O ensaio de loopback usa a entrada `run_service.py`, mas executa sob a conta do operador. Os serviços familiares executam como LocalService.

## Verificação da correção

Os resultados abaixo foram obtidos com dados sintéticos, Caddy temporário ligado a loopback e portas efêmeras, no mesmo Windows (build 26300) e com as mesmas versões do runtime e do proxy. A CA temporária ficou confinada ao ensaio. Python e Node HTTP/2 validaram a CA e o hostname. O Chromium sintético usou o pin da chave do certificado temporário, obtido numa conexão com CA e hostname validados. Em produção o verificador Chromium usa a confiança normal do navegador.

| Execução | Arranques | Requisições HTTP/2 | HTTP 502 com recusa upstream |
|---|---:|---:|---:|
| Fila de 5, rajadas de 24 | 3 | 2.880 | 1.837 |
| Fila de 128, rajadas de 24 | 3 | 2.880 | 0 |
| Fila de 128, rajadas de 48 | 4 | 4.800 | 0 |

Nos três arranques com a fila corrigida e verificação completa, o publicador também fez ao menos 12 segundos de HTTPS concorrente por arranque, seguido de três aberturas da Floresta em 3D, da API de mapa e de Agora. O monitor do processo e do listener continuou ativo ao longo desses ensaios. [Reprodução com fila de cinco](fila-5.json) · [Fila corrigida e verificador completo](fila-128.json) · [Rajadas de 48](rajadas-48.json).

Em duas execuções separadas com fila de cinco, três aberturas no Chromium chegaram a passar e a prova HTTPS concorrente recusou ambas no primeiro 502. O teste PowerShell 5.1 simulou erro HTTP, troca de PID e SHA divergente, confirmando diagnóstico antes do rollback, retorno ao SHA anterior e preservação dos dados em uso. Os testes Python cobriram os dois SQLite sintéticos com WAL e a rejeição do primeiro 502. Também passaram as regressões de navegação e a regeneração determinística do manifesto.

## Publicador para revisão

[Publicar-Revisao.ps1](../../scripts/Publicar-Revisao.ps1) usa o SHA aprovado explicitamente e verifica a ref da PR. Registra uma cópia privada dos bancos e dos arquivos de publicação com ambos os serviços parados e valida o SQLite. Depois da troca de código, aguarda `Running`, confirma os listeners e seus processos-pai e exige HTML, módulos, mapa e SHA exato durante a janela de estabilidade. O Chromium deve abrir a Floresta e o mapa três vezes e abrir Agora. A comparação final de PID e horário de início, a leitura dos 502 do proxy e a verificação da configuração ocorrem antes do sucesso.

O primeiro erro da janela invalida a execução. O registro privado guarda fase, horário, serviço, PID, porta e os códigos dos recursos afetados, sem corpos de resposta, cookies ou parâmetros de URL. O rollback retorna ao SHA anterior, aguarda os dois serviços e confirma o SHA restaurado por HTTPS. A cópia dos SQLite permanece disponível para recuperação independente. O rollback de código preserva os bancos em uso.

Para revisar o script sem parar a instalação, forneça o SHA completo que estiver na cabeça da PR.

```powershell
$script = '.\scripts\Publicar-Revisao.ps1'
& $script -Acao Conferir -ShaAprovado $sha
& $script -Acao Publicar -ShaAprovado $sha -Aprovado -WhatIf
& $script -Acao Voltar -ShaAprovado $sha -Aprovado -WhatIf
```

Os testes usam o executável Caddy já disponível para testes, um Node com Playwright e o Chromium do Playwright.

```powershell
python -B tests/backend_stability.py --caddy $caddy --backlog 5 --starts 3 --rounds 40 --concurrency 24
python -B tests/backend_stability.py --caddy $caddy --starts 3 --rounds 40 --concurrency 24 --gate --expect-stable
python -B tests/backend_stability.py --caddy $caddy --starts 4 --rounds 25 --concurrency 48 --expect-stable
powershell.exe -NoProfile -File tests/test_publicar_revisao.ps1
python -B -m unittest discover -s tests -q
```

A próxima publicação, após revisão expressa da correção, continua sendo manual e direta na instalação existente. Nenhuma terceira tentativa foi executada.
