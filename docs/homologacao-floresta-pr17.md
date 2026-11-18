# Homologação física da Floresta — PR #17

Direção artística aprovada; homologação física **pendente**. Código-base da PR: `21e0aa1`. Preparação local no ramo `test/floresta-homologacao-lan`, em `D:\davi-floresta-homologacao`. Não houve merge, push ou deploy de produção.

## Acessar nos aparelhos

1. Conecte celular, tablet e computador à rede doméstica `192.168.2.0/24`. O servidor é `192.168.2.10`. A rede de convidados pode impedir comunicação entre aparelhos.
2. Copie **somente** o certificado público [Floresta-Homologacao-PR17.cer](../.homologacao-floresta/Floresta-Homologacao-PR17.cer) para os aparelhos por USB ou compartilhamento local. Ele é exclusivo desta homologação. Não copie arquivos `.key`, configurações ou bancos. Importe essa CA como confiável para o navegador/SO; no iOS/iPadOS, habilite também a confiança total após instalar o perfil. No computador hospedeiro, a importação também é manual se for testar pelo navegador.
3. Confira a impressão SHA-256 do certificado antes de confiar: `7F223F377A38EAD1B0138C336A328D8D78CD4F39499A37E879C8AE606030392B`. No Windows: `certutil -hashfile D:\davi-floresta-homologacao\.homologacao-floresta\Floresta-Homologacao-PR17.cer SHA256`. Não use a opção de ignorar erro de certificado. A instância não instala CA automaticamente.
4. Abra **[https://192.168.2.10:18443/?homologacao=1](https://192.168.2.10:18443/?homologacao=1)**. O endereço de produção `https://aventuras.davi.costa` continua separado. O painel fixo **TESTE SINTÉTICO** deve aparecer.
5. No servidor, gere um código por aparelho: `python scripts/homologar_floresta.py pair` dentro da pasta de homologação. Digite-o em “Código de autorização”. Cada código vale dez minutos e um uso; gere e use antes de gerar o próximo.
6. Para testar compras desde o início, combine a ordem dos aparelhos: os três compartilham **apenas o banco sintético**, então compras e progresso de um aparecem nos outros. A senha do responsável de teste está em `.homologacao-floresta\credenciais-teste.txt`. Nunca use a senha familiar.

Não é necessário mudar DNS, roteador, serviços ou certificados de produção. Se um aparelho não conseguir confiar na CA, registre o impedimento e não contorne o TLS. A homologação só vale após os fluxos funcionarem com HTTPS confiável.

## Medir sem ferramentas de desenvolvimento

O painel “TESTE SINTÉTICO · Medir desempenho” fica no canto inferior. Abra para ler; feche para jogar. Ele permanece disponível em missões, agenda e ilha 2D. O parâmetro `homologacao=1` ativa o painel nesta aba, inclusive após recarregar; `homologacao=0` desativa. Não há envio de telemetria.

- **FPS e p95**: intervalos reais entre frames da floresta, janela móvel de até 240 frames. p95 é tempo em milissegundos; menor é melhor. A leitura não mede FPS em 2D, bateria ou GPU diretamente. Amostras sobrepostas não são um benchmark independente.
- **Abrir mundo**: da chamada de abertura até a primeira renderização, incluindo API, modelos, montagem e render. O JSON também separa o carregamento dos assets e o carregamento do documento. Retorno de missão pode reutilizar modelos (tempo de assets próximo de zero); não confunda com primeira abertura.
- **Qualidade**: solicitada → efetivamente usada. Automática pode reduzir para econômica por tamanho da tela, processadores ou desempenho. Em “Opções do mundo”, teste também Econômica explicitamente; essa preferência é local por navegador.
- **WebGL**: erros de criação, perda/recuperação de contexto e avisos/erros de renderização. A amostragem para quando a aba fica oculta. Na homologação, contexto perdido por cinco segundos sem recuperação leva à ilha 2D. O botão “Continuar em 2D” também está sempre no painel.
- **Baixar relatório**: exporta JSON local com data, navegador, resolução, DPR, GPU quando disponível, medições, aberturas e falhas. Preencha modelo/SO e observações no registro abaixo. O relatório não inclui agenda, senha nem tokens.

Para cada aparelho: primeira abertura após limpar **somente os dados deste endereço de teste**, autorizar novamente e baixar um relatório; depois recarregar e medir abertura com cache. Em cada perfil (Automática e Econômica), espere 15 s, clique “Iniciar amostra”, caminhe 60 s e baixe o JSON. Preserve arquivos separados por aparelho/perfil. Faça também dez minutos de jogo contínuo, anotando calor, bateria antes/depois e engasgos. Não prometa medição de memória/temperatura se o aparelho não a fornece.

## Roteiro funcional por aparelho

Marque PASSOU / FALHOU / BLOQUEADO e anote evidência. Use retrato e paisagem em celular/tablet e janela normal/maximizada no computador.

| Verificação | Procedimento e resultado esperado |
|---|---|
| Entrada e layout | Autorizar, abrir floresta, girar aparelho/redimensionar. Sem corte, rolagem horizontal ou controles inacessíveis. |
| Toque e movimento | Segurar cada seta, soltar, arrastar dedo para fora e interromper toque. Andar para ao soltar/cancelar. Tocar no chão leva ao ponto válido; água e obstáculos bloqueiam. Testar também teclado WASD/setas e E no computador. |
| Câmera | Girar para os dois lados, centralizar, aproximar/afastar nas opções. Davi e Pipo permanecem visíveis; copas abrem a visão. Mudar orientação durante movimento. |
| Pipo | Caminha/acompanha Davi, para junto, continua presente após missão, compra e mudança de qualidade. Conferir animações e eventual tremor no aparelho físico. |
| Missões | “Minhas missões” mostra atividades e horário. Entrar na “TESTE · Missão aberta”, Aprender/Lembrar/minigames, depois Fazer. Somente Fazer confirma passos reais; concluir agenda é ação separada. Ajuda, dicas e retorno funcionam. |
| Janela temporal | Missão futura e encerrada permitem prática, mas bloqueiam confirmar/desfazer em Fazer fora da janela. Não alterar relógio do aparelho para liberar. O servidor usa tempo real de São Paulo. |
| Compras e construções | Começa com 100 estrelas sintéticas. Comprar ponte, atravessar pelo centro, comprar casa e abrir diário; comprar/equipar acessório do Pipo na oficina. Saldo diminui uma vez por compra; comprado não cobra novamente. |
| Persistência | Anotar saldo, posição, compras e passo marcado. Aguardar 2 s parado, recarregar; fechar/reabrir navegador; conferir em segundo aparelho após recarregar. Repetir após reiniciar só a homologação. |
| Retorno ao mundo | Sair de missão, abrir/voltar da agenda, responsável e opções. Cenário, construções e saldo preservados; posição válida. Preferências gráficas continuam locais. |
| Suspensão | Ir à tela inicial/bloquear por 30 s e retornar. Não continuar andando sozinho; sem travamento. Registrar erro/perda WebGL no JSON. |
| Econômica | Selecionar explicitamente, repetir caminhada e recarregar. Qualidade efetiva econômica; comandos e missões continuam funcionando. |
| 2D | Opções → Abrir a ilha 2D (ou botão do painel). Conferir missões, saldo, inventário e retorno “Floresta 3D”. Recarregar em 2D; escolha persiste. |

As atividades são sintéticas e usam o relógio real. A missão aberta foi criada dez minutos antes da preparação, dura 60 min e tem 30 min de tolerância. Se a janela passar, use o responsável **de teste** para ajustar os horários. A futura pode cair no dia seguinte; selecione a data correspondente na agenda. Não há relógio falso no servidor LAN. As compras são compartilhadas: para repetir construções em outro aparelho, o responsável sintético pode remover/reativar itens; isso preserva histórico e não equivale a nova compra. Para testar compra inicial novamente, prepare outra cópia isolada do código, nunca copie dados de produção.

Meta proposta para aprovação familiar: todos os fluxos essenciais passam; econômica sustenta pelo menos 30 FPS (p95 até 50 ms) na caminhada de 60 s; sem congelamento, perda de progresso ou falha WebGL sem continuação 2D. Registrar primeira abertura e cache separadamente; carregamento acima de 15 s ou desconforto térmico exige avaliação/ajuste antes de aprovar. São critérios de homologação, não resultados já obtidos.

## Operar somente a instância de teste

Instância preparada em `.homologacao-floresta`, ignorada pelo Git. Não apagar para reiniciar: banco e CA de teste persistem.

```powershell
cd D:\davi-floresta-homologacao
python scripts/homologar_floresta.py status # verifica HTTPS com a CA própria
python scripts/homologar_floresta.py pair   # um código por vez
python scripts/homologar_floresta.py stop   # encerra apenas os processos filhos da homologação
# Para iniciar novamente (manter terminal aberto, Ctrl+C também encerra):
python scripts/homologar_floresta.py run
```

Backend exclusivamente `127.0.0.1:18765`; proxy exclusivamente `192.168.2.10:18443`. Acesso permitido só a `192.168.2.0/24`, sem redirecionador HTTP, QUIC ou API administrativa do Caddy. Origin/Host/CSRF, sessão infantil e proteção do responsável continuam ativos. Os cabeçalhos de proxy são sobrescritos. Cookies usam Secure. Não há modo HTTP LAN nem desativação de TLS.

O preparo usa uma cópia do executável Caddy, configurações próprias e um banco criado do zero. Recusa sobrescrever instância, semear banco existente, apontar para outro diretório de dados ou ocupar portas já usadas. Limpa variáveis DAVI herdadas. Não chama instaladores ou comandos de serviço, não importa banco familiar e não usa a CA de produção.

Em uma nova cópia deste ramo, a preparação é:

```powershell
python scripts/homologar_floresta.py prepare --caddy D:\caminho\caddy.exe
python scripts/homologar_floresta.py run
```

Foi adicionada somente a regra de firewall `DaviFlorestaHomologacao18443`, perfil Privado, programa `.homologacao-floresta\caddy.exe`, IP local `192.168.2.10`, TCP 18443 e origem `192.168.2.0/24`. Se precisar recriar, em PowerShell elevado:

```powershell
New-NetFirewallRule -Name DaviFlorestaHomologacao18443 -DisplayName 'Davi Floresta homologacao sintetica 18443' -Direction Inbound -Action Allow -Protocol TCP -LocalAddress 192.168.2.10 -LocalPort 18443 -RemoteAddress 192.168.2.0/24 -Profile Private -Program 'D:\davi-floresta-homologacao\.homologacao-floresta\caddy.exe'
```

Ao terminar, executar `stop`, remover **só** essa regra com `Remove-NetFirewallRule -Name DaviFlorestaHomologacao18443` e remover dos aparelhos **somente a CA de teste identificada pelo hash acima**. Não remover a CA familiar. Não há serviço/tarefa de teste para desinstalar. Logs locais em `.homologacao-floresta\logs`; nunca anexar configurações, chaves, credenciais ou SQLite à PR.

## Evidências e registro na PR

Validação automatizada: [resultado JSON](evidencias-homologacao-pr17/resultado.json), capturas 360/390/768/1024/1366 e gameplay na mesma pasta. GPU real do computador hospedeiro; celular/tablet são **emulação de viewport/toque**, não aparelhos homologados. O teste de exportação realmente baixa e lê o JSON. [Texto pronto para registrar na PR #17](registro-pr17-homologacao.md).

O [relatório de isolamento](evidencias-homologacao-pr17/isolamento.json) registra HTTPS com CA explicitamente confiada, login/pareamento, banco sintético preservado no reinício e nove arquivos de produção com hashes idênticos antes/depois do teste de parada/reinício. `DaviApp` e `DaviProxy` permaneceram em execução nos mesmos PIDs. Essa comparação cobre o teste de ciclo de vida; não substitui um histórico anterior da instalação.

A validação de acessórios encontrou e corrigiu um defeito da floresta: chapéu, capa e lenço do Pipo eram exibidos pela posse do item, ignorando a escolha de vestir/tirar. Agora a malha respeita o equipamento salvo. O teste verifica compra, vestir, tirar e reabertura do lenço, além de Pipo acompanhar a movimentação.

Após os testes físicos, copiar o modelo de registro, preencher uma linha por aparelho/perfil, anexar os JSONs e vídeos curtos sintéticos e comentar em [PR #17](https://github.com/nellipe/davi-missoes/pull/17). Não marcar como aprovado um aparelho não testado. Nenhum comentário externo foi enviado nesta preparação.

Para repetir os testes automatizados (ferramentas Playwright/axe já existentes fora do projeto):

```powershell
$env:DAVI_TEST_CADDY = 'D:\davi-floresta-homologacao\.homologacao-floresta\caddy.exe'
python -m unittest discover -s tests -v
node --test tests/test_visual.cjs
$env:NODE_PATH = "$env:TEMP/davi-redesign-tools/node_modules"
$env:FOREST_EVIDENCE_DIR = 'D:/davi-floresta-homologacao/docs/evidencias-homologacao-pr17'
node tests/browser_forest.cjs
```

Os testes automatizados criam seus próprios bancos/processos temporários; não usam o banco LAN de homologação. O teste TLS real usa Caddy e CA temporários e valida a cadeia explicitamente. Sua atividade agora usa data/horário atuais para respeitar a janela de execução.
