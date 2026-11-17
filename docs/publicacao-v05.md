# Aventuras do Davi — publicação V0.5 no Windows

Esta PR prepara a instalação; não instala serviços, não altera o MikroTik e não faz merge. Execute os passos de implantação abaixo somente depois da aprovação. Todo o funcionamento diário permanece local.

## Configuração definitiva

| Item | Valor |
| --- | --- |
| Projeto / Python | `D:\davi-missoes` / Python 3.13.5, instalação para todos os usuários |
| DNS interno existente | `aventuras.davi.costa` → `192.168.2.10` |
| Rede / gateway | `192.168.2.0/24` / MikroTik `192.168.2.1` |
| Entrada | `https://aventuras.davi.costa`, TCP 443 em `192.168.2.10` |
| Backend | HTTP em `127.0.0.1:8765`, exige segredo do proxy |
| Serviços | `DaviApp` (Python), `DaviProxy` (Caddy, depende de DaviApp), automáticos, LocalService |
| Binários existentes | `D:\davi-ferramentas\caddy\caddy.exe` e `D:\davi-ferramentas\WinSW.NET461.exe` |
| Estado persistente | `dados\` e `publicacao\`, não substituir em atualizações |

Não configurar NAT, DMZ, UPnP ou encaminhamento de portas no MikroTik. A reserva do IP e o DNS interno devem continuar apontando para este computador. Não é necessário DNS público, ACME, internet ou conta de nuvem. O computador precisa permanecer ligado e acordado; serviço automático não impede suspensão.

O navegador acessa somente o nome acima. IP direto, aliases e HTTP não são origens da V0.5. Caddy usa `tls internal`, não abre porta 80, QUIC ou API administrativa. A CA fica explicitamente em `publicacao\caddy-data`, independente da conta que executa o Caddy. Caddy sobrescreve `X-Davi-Proxy` e `X-Davi-Client` com segredo e IP do socket. O backend valida esse segredo, Host e sub-rede; ignora cabeçalhos `X-Forwarded-*` para conceder acesso.

`/api/me` concede sessão infantil automaticamente, com token aleatório persistido em hash, cookie `Secure; HttpOnly; SameSite=Strict; Path=/` e token CSRF. A agenda e os feriados ficam disponíveis aos aparelhos da rede; conclusões exigem sessão e CSRF. Toda mutação exige Origin HTTPS exato; operações administrativas exigem sessão de responsável, obtida com a senha existente. Logout administrativo volta ao acesso infantil ao recarregar. A interface não oferece pareamento neste modo. O campo legado `simple_lan` da API indica acesso infantil automático também no HTTPS.

## 1. Conferir e preparar

Depois do merge aprovado, abra PowerShell como administrador em `D:\davi-missoes`. Os comandos de preparação apenas geram arquivos. As ações de alteração no script exigem `-Aprovado`; `-WhatIf` permite conferir o alvo antes de executá-las. `-Confirm:$false` evita uma segunda confirmação ao executar uma ação já escolhida.

```powershell
Set-Location D:\davi-missoes
$python = 'C:\Program Files\Python313\python.exe'
$ops = '.\scripts\Publicacao-Lan.ps1'
$pub = 'D:\davi-missoes\publicacao'
$caddy = 'D:\davi-ferramentas\caddy\caddy.exe'
$winsw = 'D:\davi-ferramentas\WinSW.NET461.exe'
& $python --version
& $ops -Acao Diagnostico -Python $python -Pasta $pub
```

Se a interface não se chamar `Ethernet 5`, acrescente `-InterfaceAlias 'nome real'` ao diagnóstico. Ele mostra IP/gateway/perfil, DNS, portas, serviços, firewall e existência da raiz TLS, sem ler dados da agenda nem corrigi-los. Confira o DNS com `Resolve-DnsName aventuras.davi.costa`: deve retornar `192.168.2.10`. As portas 443 e 8765 precisam estar livres e o firewall Windows habilitado. Não desligue o firewall para resolver problemas. É necessário .NET Framework 4.8 para o WinSW NET461 existente.

O servidor provisório já foi encerrado. Não execute `Iniciar-Davi-LAN.bat` junto dos serviços. Se a antiga regra `Davi-LAN-Simples-8765` tiver sido criada, confira-a e remova-a explicitamente:

```powershell
Get-NetFirewallRule -DisplayName 'Davi-LAN-Simples-8765' -ErrorAction SilentlyContinue |
    Get-NetFirewallPortFilter
# Apenas se for a regra antiga conferida acima:
Get-NetFirewallRule -DisplayName 'Davi-LAN-Simples-8765' -ErrorAction SilentlyContinue |
    Remove-NetFirewallRule
```

Antes de implantar, preserve o estado com os serviços e instâncias manuais parados:

```powershell
$save = Join-Path 'D:\davi-backups' ('pre-v05-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $save -ErrorAction Stop | Out-Null
Copy-Item -LiteralPath '.\dados' -Destination $save -Recurse
if (Test-Path -LiteralPath $pub) { Copy-Item -LiteralPath $pub -Destination $save -Recurse }
git rev-parse HEAD | Set-Content -LiteralPath (Join-Path $save 'commit.txt')
& $python maintenance.py integrity --database .\dados\agenda.sqlite3
& $ops -Acao Preparar -Python $python -Pasta $pub -Confirm:$false
```

O destino `publicacao` deve ser novo. Se já existir, não o apague nem regenere: preserve configuração, segredo e CA e confira sua origem. Uma instalação HTTPS histórica precisa ser revisada antes de migrar, pois usa outros nomes e política de acesso. Esta instalação parte do HTTP provisório já encerrado. O gerador não abre SQLite, não modifica ACLs, não instala confiança e não cria serviços. Gera JSON, Caddyfile e XMLs com caminhos absolutos. Não mova projeto, Python ou publicação depois disso.

Confira SHA-256 dos executáveis existentes contra as cópias cuja procedência foi verificada nas distribuições oficiais. O checksum da distribuição Caddy pode ser do ZIP e usar SHA-512; não o compare com o SHA-256 do EXE extraído. Não há novo download. Anote os SHA-256 dos EXEs verificados para o comando de instalação:

```powershell
Get-FileHash -LiteralPath $caddy,$winsw -Algorithm SHA256
& $caddy adapt --config "$pub\Caddyfile" --adapter caddyfile --pretty
```

`adapt` não abre listeners nem gera certificados, mas sua saída contém o segredo do proxy. Não publique essa saída, JSON, XML, CA privada, logs ou bancos na PR. A pasta de publicação deve ter acesso limitado às contas confiáveis do computador. Revise as permissões existentes com `Get-Acl`; instalar/iniciar não as modifica.

## 2. Instalar e iniciar

Substitua os dois valores abaixo pelos SHA-256 dos executáveis cuja origem foi conferida. O instalador reutiliza os binários existentes, copia WinSW como `DaviApp.exe`/`DaviProxy.exe` e Caddy para `publicacao\bin\caddy.exe`.

```powershell
$caddySha256 = 'COLE_O_SHA256_DO_CADDY_EXE_VERIFICADO'
$winswSha256 = 'COLE_O_SHA256_DO_WINSW_EXE_VERIFICADO'
& $ops -Acao Instalar -Python $python -Pasta $pub -WinSW $winsw -Caddy $caddy `
    -WinSWHash $winswSha256 -CaddyHash $caddySha256 -Aprovado -Confirm:$false
& $ops -Acao FirewallAdicionar -Pasta $pub -Aprovado -Confirm:$false
& $ops -Acao Iniciar -Pasta $pub -Aprovado -Confirm:$false
& $ops -Acao Status -Pasta $pub
```

A instalação registra início automático, sem iniciar os processos até a ação `Iniciar`. Falha ao registrar DaviProxy remove o registro recém-criado de DaviApp. O serviço recusa agenda ausente ou senha administrativa ausente; não cria uma agenda vazia nem troca a senha. Ignora variáveis `DAVI_*` herdadas de inicializadores manuais e usa o JSON. Os dois bancos existentes são mantidos; inicialização idempotente usa o esquema já existente.

O firewall cria `Davi-LAN-HTTPS-v05` permitindo apenas TCP 443 no IP local, executável Caddy e origem `192.168.2.0/24`, em todos os perfis. A regra `Davi-LAN-HTTPS-v05-Block` bloqueia explicitamente o restante do IPv4 para esse mesmo destino/programa, mesmo que outra regra conceda acesso amplo. Se a criação falhar, o script remove suas regras parciais. Caddy também rejeita IP do socket fora da sub-rede, mesmo com cabeçalhos forjados. Não há listener IPv6. Não se cria regra de entrada para Python/8765.

## 3. Confiar na raiz TLS em cada aparelho

Após o primeiro início, a raiz pública estará em:

```text
D:\davi-missoes\publicacao\caddy-data\pki\authorities\local\root.crt
```

Caddy não instala confiança automaticamente. A CA interna emite e renova o certificado do nome `aventuras.davi.costa`. Preserve toda a pasta `caddy-data`; recriá-la gera outra raiz e exige reinstalar confiança na família. Distribua **somente `root.crt`**, presencialmente, por USB, AirDrop ou outro canal familiar confiável. Nunca distribua `root.key`, `intermediate.key` ou a pasta inteira. Não disponibilize a CA privada pelo aplicativo.

Para identificar a raiz, calcule a impressão digital SHA-256 do certificado DER:

```powershell
& $python -c 'import hashlib,ssl,pathlib; p=pathlib.Path("publicacao/caddy-data/pki/authorities/local/root.crt"); print(hashlib.sha256(ssl.PEM_cert_to_DER_cert(p.read_text())).hexdigest())'
```

Compare a impressão digital nos aparelhos quando disponível. Se o sistema exigir DER, converta apenas a raiz pública com `certutil -decode "$pub\caddy-data\pki\authorities\local\root.crt" "$pub\root.cer"`.

| Aparelho | Instalação da raiz pública |
| --- | --- |
| Windows | Abrir `root.crt` → Instalar certificado → Usuário Atual → escolher **Autoridades de Certificação Raiz Confiáveis**. Alternativa para o usuário atual: `certutil -user -addstore Root caminho\root.crt`. Reabrir navegador. |
| Android | Configurações → Segurança/Privacidade → Criptografia e credenciais → Instalar certificado → **Certificado de CA**; selecionar a raiz. Os nomes variam conforme fabricante. Confirmar a instalação e reabrir Chrome. |
| iPhone/iPad | Abrir a raiz → Ajustes → Perfil Baixado → Instalar. Depois Ajustes → Geral → Sobre → **Ajustes de Confiança de Certificado** → ativar confiança total para essa raiz. Reabrir Safari. |
| macOS | Acesso às Chaves → importar raiz no chaveiro apropriado → abrir certificado → Confiança → confiar para SSL. Reabrir navegador. |
| Firefox | Se não usar a confiança do sistema: Configurações → Privacidade e Segurança → Certificados → Ver certificados → Autoridades → Importar raiz e permitir identificar sites. |

Agora abra **https://aventuras.davi.costa** no Wi-Fi doméstico. Deve abrir sem aviso TLS, com acesso infantil imediato. Não contorne avisos de certificado: confira data/hora, DNS, nome e raiz instalada. Em aparelhos com DNS privado/DoH ou VPN, confirme que esse nome usa o DNS doméstico; com rede de convidados isolada ou dados móveis o acesso não funciona.

## 4. Validação após instalação aprovada

```powershell
Get-Service DaviApp,DaviProxy | Select-Object Name,Status,StartType
Get-NetTCPConnection -State Listen | Where-Object LocalPort -in 443,8765 |
    Select-Object LocalAddress,LocalPort,OwningProcess
& $ops -Acao Diagnostico -Python $python -Pasta $pub
```

Esperado: serviços Running/Automatic; Python somente `127.0.0.1:8765`; Caddy somente `192.168.2.10:443`. Reinicie o Windows em uma janela combinada e confirme que o acesso retorna sem login no computador. No celular, a página deve carregar sem código/senha e mostrar atividades existentes; entrar na área do responsável continua exigindo a senha atual. Não crie/apague atividades reais para testar a implantação. CRUD, conclusões e restauração já são exercitados nas fixtures temporárias abaixo.

O teste físico com os aparelhos e o teste de reinicialização do Windows são verificações pós-instalação; não foram executados nesta PR, que não implanta os serviços.

## Permissão negada: ajuste somente se indispensável

Os comandos normais não chamam `Set-Acl`. LocalService precisa de leitura/execução no Python, código e configuração, e modificação em `dados`, `publicacao\logs` e `publicacao\caddy-data`. Use Segurança → Avançadas → Acesso efetivo, selecionando LocalService, e os logs para identificar o alvo que efetivamente está negado. Confira também acesso indevido de contas não confiáveis à CA/segredo; este procedimento não presume ACLs seguras nem as substitui silenciosamente. Python deve estar instalado para todos os usuários, como no ambiente confirmado.

Se for comprovadamente necessário acrescentar acesso em um alvo do projeto, pare os serviços e use **PermissoesMinimas**, com a lista exata de alvos negados. Exemplo apenas para uma pasta de logs negada:

```powershell
& $ops -Acao Parar -Pasta $pub -Aprovado -Confirm:$false
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$aclSnapshot = 'D:\davi-missoes\acl-snapshots\logs-v05\snapshot.acl.json'
& $ops -Acao PermissoesMinimas -Pasta $pub -SidManutencao $sid `
    -AlvosPermissao "$pub\logs" -BackupAcl $aclSnapshot -Aprovado -Confirm:$false
# Rollback, com serviços parados:
& $ops -Acao RestaurarPermissoes -Pasta $pub -BackupAcl $aclSnapshot -Aprovado -Confirm:$false
```

O diretório do snapshot deve ser novo. A opção pontual acrescenta somente a ACE LocalService: Modify em dados/logs/CA, ReadAndExecute no restante. Preserva ACEs existentes, proprietário e herança; pastas propagam para seus descendentes e novos arquivos, com descendentes existentes incluídos no snapshot. A raiz do projeto recebe somente acesso ao próprio objeto. Há rollback automático verificado em falha parcial e rollback explícito pelo snapshot. Negação explícita preexistente não é removida. Não use a ação histórica `Permissoes`, que substitui ACLs de dados/publicação e não faz parte da instalação V0.5. Não há modificação automática de ACLs do Python ou de `D:\`.

## Atualização e recuperação

1. Execute `Parar` (proxy primeiro, depois backend), confirme ausência de instâncias manuais e anote `git rev-parse HEAD`.
2. Faça cópia de `dados` e `publicacao`, como no passo 1, para pasta nova de backup. Isso preserva os dois SQLite, sidecars, segredo e CA. Não copie SQLite em uso com `Copy-Item`.
3. Com árvore Git limpa, obtenha a versão revisada: `git fetch origin` e `git merge --ff-only origin/main`. Não execute `git clean` e não regenere `publicacao`.
4. Confira integridade com `maintenance.py integrity`, valide o Caddyfile com `adapt`, execute os testes sintéticos abaixo e use `Iniciar`. Confira Status e acesso pelo nome.
5. Se falhar, use `Parar`, volte ao commit anotado com `git switch --detach COMMIT_ANTERIOR` (árvore limpa), e inicie novamente. V0.5 não migra tabelas nem regrava senha; não restaure bancos para reverter apenas o código.

Para restauração de dados por falha real: serviços parados, snapshot completo anterior preservado e integridade conferida. Há backups consistentes diários de `agenda.sqlite3` em `dados\backups`, retenção 14, pelo mecanismo já existente. `maintenance.py restore --database .\dados\agenda.sqlite3 --source CAMINHO_DO_BACKUP --confirm-stopped` verifica a origem, guarda cópia da agenda anterior e revoga sessões; não altera a senha do backup. Se houver `-wal`, `-shm` ou `-journal`, o comando recusa; não apague esses arquivos para forçar restauração. Backups completos de `dados` e CA devem ser guardados em local privado; não são enviados à nuvem.

Atualização de Caddy/WinSW é operação separada: serviços parados, binários antigos preservados junto do backup, origem/checksums novos conferidos, substituir somente EXEs correspondentes, validar e iniciar. Não reinstale serviços nem gere nova CA em atualizações normais. Reverta os EXEs do backup se necessário.

## Diagnóstico

| Sintoma | Conferência objetiva |
| --- | --- |
| Nome não resolve | `Resolve-DnsName aventuras.davi.costa`, DNS doméstico/VPN/DoH; resultado deve ser `192.168.2.10`. |
| Timeout | PC ligado, Wi-Fi doméstico, IP atual, firewall habilitado e duas regras V0.5, listener 443, isolamento de clientes. |
| Aviso TLS | Nome exato, relógio dos aparelhos e raiz instalada/confiada; compare fingerprint com a raiz do serviço. |
| 502 | DaviApp Running, listener loopback 8765, Python acessível e logs WinSW em `publicacao\logs`. |
| 403 | Rede autorizada, origem HTTPS exata, cookie/CSRF renovados recarregando a página; não remover as validações. Acesso direto ao backend deve retornar 403. |
| Serviço para imediatamente | .NET 4.8, caminhos absolutos, agenda/senha existentes, porta livre e Acesso efetivo da LocalService. |
| Backup falha | Espaço em disco e acesso de modificação em `dados\backups`; procurar mensagem no log DaviApp. |

Não cole config/Caddyfile nem logs sem revisão em chamados. `Status` e `Diagnostico` não mostram o segredo. O acesso fora da rede doméstica deve falhar; o projeto não configura o roteador nem testa conectividade externa enviando dados da agenda.

## Desinstalação preservando dados

```powershell
& $ops -Acao Desinstalar -Pasta $pub -Aprovado -Confirm:$false
& $ops -Acao FirewallRemover -Pasta $pub -Aprovado -Confirm:$false
```

Remove somente serviços e as duas regras V0.5. Conserva código, `dados`, SQLite, backups, configuração, executáveis, logs, raiz e chaves. Se usou ajuste pontual de ACL, restaure o snapshot com serviços parados, após conferir que ele ainda corresponde ao estado a recuperar. Para desativação definitiva, remova nos aparelhos apenas a raiz que foi instalada, identificada por impressão digital; no iOS remova o perfil correspondente. Não apague a CA nem os bancos automaticamente. Se reinstalar no mesmo caminho, reutilize os arquivos preservados, hashes conferidos e ação `Instalar`, sem `Preparar`.

## Testes sintéticos da PR

Em PowerShell, a partir do projeto, sem serviços em execução:

```powershell
$env:DAVI_TEST_CADDY = 'D:\davi-ferramentas\caddy\caddy.exe'
& $python -m unittest discover -s tests -v
& .\tests\test_service.ps1
& .\tests\test_acl.ps1
node --test tests/test_visual.cjs
Remove-Item Env:DAVI_TEST_CADDY
```

Os testes Python usam SQLite temporário. O teste TLS usa Caddy existente, portas efêmeras exclusivamente em loopback e CA temporária confiada somente pelo cliente do teste. Verifica certificado não confiável rejeitado, nome TLS correto, sessão infantil automática, cookies Secure, login administrativo, conclusão, CSRF/Origin, sobrescrita de cabeçalhos, bloqueio real do Caddy para IP fora da sub-rede e persistência da raiz ao reiniciar. Não instala confiança no Windows. Testes PowerShell substituem APIs de serviço/firewall; ACLs reais são exercitadas somente em árvore TEMP sintética, com restauração verificada. Node é necessário apenas para testes da interface.

Referências: [Caddy — proxy e cabeçalhos](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Caddy — opções globais/TLS interno](https://caddyserver.com/docs/caddyfile/options), [Caddy — remote_ip](https://caddyserver.com/docs/caddyfile/matchers), [WinSW 2.12 — configuração XML](https://github.com/winsw/winsw/blob/v2.12.0/doc/xmlConfigFile.md). Os binários existentes foram identificados como Caddy 2.11.9 e WinSW 2.12.0; o XML usa os campos `domain`/`user` da série WinSW 2.
