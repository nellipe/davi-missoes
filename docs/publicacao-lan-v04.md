# Publicação interna v0.4 — preparação para revisão

> Referência histórica do plano HTTPS. Para a publicação doméstica atual, use o [modo LAN simples](lan-simples.md). Esse modo não executa os scripts de instalação, certificados, serviços ou permissões descritos abaixo.

**Não implantado.** Nenhum serviço Windows, regra de firewall, DNS do roteador ou certificado de confiança foi instalado. A implantação exige autorização expressa do responsável e execução assistida dos passos abaixo. Não há GitHub Actions, Docker, VPS ou serviço pago.

## Ambiente confirmado pelo responsável

| Item | Valor informado |
| --- | --- |
| Windows / Python | Python 3.13.5 |
| Projeto | `D:\davi-missoes` |
| Interface | `Ethernet 5` |
| IPv4 do computador | `192.168.2.10` |
| Gateway | `192.168.2.1` |
| Perfil Windows | `Private` |
| Rede autorizada | `192.168.2.0/24` |
| Proxy planejado | HTTPS TCP 443 em `192.168.2.10` |
| Backend planejado | HTTP em `127.0.0.1:8765`, acessível somente pelo proxy autenticado |
| Endereços planejados | `https://davi.home.arpa` e `https://192.168.2.10` |

Os dados acima foram confirmados pelo responsável; não representam um diagnóstico executado nesta etapa. A confirmação da infraestrutura **não autoriza instalar ou iniciar** a publicação. Nesta atualização, foram alterados apenas scripts versionados, documentação e testes simulados; nenhuma configuração real foi gerada ou modificada e nenhum SQLite foi aberto pela aplicação.

O script usa esses valores como referência para seu diagnóstico somente leitura, com parâmetros substituíveis. O diagnóstico compara endereço, gateway e perfil da interface e informa divergências sem corrigir nada. O endereço permanece explícito no comando de preparação recomendado. O hostname é uma proposta: registro DNS, reserva DHCP e confiança da CA ainda precisam de verificação e aprovação. Não se presume que o DNS esteja configurado.

## Dependência e preservação dos dados

Branch `feat/publicacao-lan-v04`, criada a partir de `origin/feat/redesign-aventura-v03` no commit `b5068d9cbb4d6928ac72f2d530e29001c6d87c0a`, após inspecionar o repositório e a [PR #1](https://github.com/nellipe/davi-missoes/pull/1). A nova PR tem a branch do redesign como base. A PR #1 permanece aberta, aguardando aprovação, sem merge. Depois da aprovação e merge do redesign, revisar o diff e mudar a base da v0.4 para `main` antes de considerar seu merge.

O desenvolvimento não abriu a agenda pessoal pela aplicação, não executou inicialização ou migração sobre ela e não a recriou. A verificação SHA-256 antes/depois confirmou conteúdo idêntico. Horários, recorrências, feriados e regras de medicação permanecem intactos. Todos os testes usam SQLite temporário e dados sintéticos. O importador permanece intacto e não foi executado.

## Arquitetura

```text
Dispositivo autorizado: navegador + confiança na CA local
          | HTTPS TCP 443, hostname ou IP explicitamente permitido
          v
Firewall Windows: IP do PC + origem 192.168.2.0/24 + executável Caddy
          v
Caddy: bind em IP específico, tls internal, bloqueio fora da sub-rede
          | HTTP apenas no computador, segredo de proxy + IP sobrescritos
          v
Python: 127.0.0.1:8765, valida Host/Origin/proxy/perfil/CSRF
          |-- dados/agenda.sqlite3 (agenda existente e hash do responsável)
          |-- dados/auth.sqlite3 (sessões e códigos com token em hash)
          `-- dados/backups/ (snapshots consistentes, retenção 14)
```

Em produção o backend exige o segredo do proxy em **todas** as requisições, inclusive arquivos estáticos. Cabeçalhos fornecidos pelo cliente são sobrescritos pelo Caddy. O backend valida o IP original informado pelo proxy e rejeita origens externas. A API administrativa exige perfil responsável; consulta e conclusão exigem sessão autorizada. Somente a página de entrada, os arquivos estáticos e informações mínimas de estado ficam disponíveis antes da autenticação, através do proxy.

Sem configuração de publicação, `python server.py` continua em HTTP `127.0.0.1:8765`. A autenticação é obrigatória também nesse modo. HTTP local é uma facilidade de desenvolvimento; não é a publicação doméstica.

## Requisitos

- Windows, Python 3.13 instalado para todos os usuários, em caminho acessível pela conta de serviço. Testado com Python 3.13.5. A aplicação usa apenas a biblioteca padrão.
- Caddy Windows amd64, distribuição oficial; integração TLS validada com **2.11.9**. WinSW **2.12.0**, variante `WinSW.NET461.exe` executada no **.NET Framework 4.8** atualizado do Windows, para hospedar os processos no SCM. Evitar a variante antiga com runtime .NET Core 3.1 embutido. O instalador não baixa nem executa binários durante o desenvolvimento.
- IP IPv4 confirmado: `192.168.2.10`, na interface `Ethernet 5`. Confirmar a reserva DHCP correspondente no MikroTik antes da instalação, sem alterar o endereço atual nesta etapa.
- Energia, disco com espaço para backups e computador acordado. Serviço automático não impede suspensão ou desligamento.
- Administrador Windows somente para instalar/desinstalar serviços, ajustar ACLs e firewall. Navegação e conta de serviço não precisam ser administradores.
- Downloads e instalação de dependências de teste exigem internet; o funcionamento diário não depende de internet.

Conferir .NET Framework 4.8 antes de instalar o wrapper; não será instalado pelo script. As [variantes de runtime do WinSW](https://github.com/winsw/winsw/blob/v2.12.0/README.md#supported-platforms) são dependências distintas.

Baixar os binários de [Caddy Releases](https://github.com/caddyserver/caddy/releases) e [WinSW Releases](https://github.com/winsw/winsw/releases/tag/v2.12.0). Conferir os checksums do publicador antes de extrair. O manifesto do Caddy 2.11.9 usa SHA-512; não comparar com SHA-256. O script de instalação recebe o SHA-256 **do executável extraído e já verificado**, para confirmar que é o mesmo arquivo escolhido pelo responsável. Um hash calculado de um download sem verificar sua origem não comprova autenticidade. Não versionar executáveis, configurações geradas, certificados ou credenciais.

## Arquivos e scripts

| Arquivo | Função |
| --- | --- |
| `lan_security.py` | Validação fechada de rede, origem e proxy; sessões persistentes, limitação e autorização infantil |
| `prepare_lan.py` | Gera configuração privada, Caddyfile e XMLs WinSW; não instala nem inicia |
| `run_service.py` | Carrega configuração local e exige banco existente antes de iniciar |
| `maintenance.py` | Backup consistente, integridade, restauração e senha inicial offline |
| `scripts/Acl-Lan.psm1` | Snapshot privado verificável, política mínima e restauração de ACL com rollback em falha parcial |
| `scripts/Publicacao-Lan.ps1` | Diagnóstico, preparação, ACLs, serviços e firewall reversível |

`publicacao/` contém `config.json` com segredo aleatório do proxy, `network.json`, `Caddyfile`, XMLs e executáveis de serviço, `logs/`, `bin/` e `caddy-data/`. A geração recusa destino existente: preservar CA e configuração, sem sobrescrever silenciosamente. O `.gitignore` exclui dados, backups, SQLite, configurações geradas e material de certificados, inclusive arquivos gerados em outra pasta. Não usar `git add -f` nesses arquivos.

### Diagnóstico e preparação, sem modificar serviços ou firewall

Comandos para execução futura, após aprovação da preparação local. **Não executados contra o ambiente real nesta etapa.** Na pasta `D:\davi-missoes`, em PowerShell:

```powershell
.\scripts\Publicacao-Lan.ps1 -Acao Diagnostico -InterfaceAlias "Ethernet 5" -Endereco 192.168.2.10 -GatewayEsperado 192.168.2.1 -PerfilEsperado Private
.\scripts\Publicacao-Lan.ps1 -Acao Preparar -Endereco 192.168.2.10 -Hostname davi.home.arpa
```

O diagnóstico é somente leitura: versão Python, SQLite/TLS, interfaces e perfis, portas e serviços existentes. A preparação somente cria arquivos no destino, sem alterar agenda, ACLs, firewall, serviços, DNS ou repositório remoto. Não execute `server.py` contra a agenda real durante a revisão. Proteja a pasta gerada antes de compartilhá-la ou iniciar a publicação.

### Variáveis de ambiente

| Variável | Padrão / exigência |
| --- | --- |
| `DAVI_HOST` | `127.0.0.1`; aceita IPv4 explícito dentro da LAN quando proxy HTTPS está configurado |
| `DAVI_PORT` | `8765` |
| `DAVI_DATA_DIR` | `dados/` junto do código; serviço exige `agenda.sqlite3` existente |
| `DAVI_LAN_CIDR` | `192.168.2.0/24`; validação aceita apenas sub-redes privadas de `192.168.0.0/16` |
| `DAVI_ORIGINS` | Local: `http://127.0.0.1:8765,http://localhost:8765`; produção: lista exata de origens HTTPS, sem barra final |
| `DAVI_PROXY_KEY` | Sem padrão em modo local; produção exige pelo menos 43 caracteres, gerador usa 48 bytes aleatórios |

Produção aceita hostname em `.home.arpa` ou IP da LAN, com porta explícita se diferente de 443. Hostnames externos, HTTP remoto, IP público, IPv6, wildcard e `0.0.0.0` são rejeitados. Não existe opção para ignorar validação TLS.

A geração mantém `DAVI_HOST=127.0.0.1`. Caso seja necessário usar um IP local explícito para o **backend**, configure `DAVI_HOST=192.168.2.10` no JSON e altere o upstream no Caddyfile para `192.168.2.10:8765`. Mantenha segredo, HTTPS, origens e restrição de rede. Apenas o proxy do próprio PC com o segredo é aceito; acesso direto por HTTP continua bloqueado. Não criar regra liberando a porta do Python. O teste de configuração cobre esse modo; o modo recomendado e testado ponta a ponta usa loopback no backend.

## Segurança, perfis e autorização

**Responsável:** usa a senha já existente. Novas senhas usam PBKDF2-HMAC-SHA256, salt aleatório de 16 bytes e 600 mil iterações; hashes legados de 310 mil iterações continuam válidos sem regravar dados. Sessão absoluta de oito horas, token aleatório novo em cada autenticação, cookie HttpOnly/SameSite=Strict e Secure na publicação. Token de sessão é armazenado apenas como SHA-256 no banco de autenticação. Logout revoga a sessão no servidor e limpa o cookie.

Se ainda não existe senha, com aplicação e proxy parados, executar **somente após autorização para preparação do banco real**:

```powershell
python maintenance.py init-parent --database D:\davi-missoes\dados\agenda.sqlite3
```

A senha é digitada sem eco e não vai para argumentos, histórico, env ou arquivo de configuração. O comando exige banco existente e recusa sobrescrever senha. Não há cadastro público de responsável pela rede nem recuperação por e-mail. Guardar a senha no gerenciador do responsável. Esta entrega não implementa reset de senha perdida.

**Davi:** em navegador novo, nenhuma agenda ou nome pessoal é entregue. O responsável entra em seu próprio aparelho, abre **Preferências → Gerar código para aparelho infantil** e ajuda a digitá-lo no aparelho infantil. Código aleatório de 128 bits, válido por dez minutos, resgatável uma vez; gerar outro invalida o anterior. A sessão infantil dura até 90 dias, persiste após reiniciar o computador e permite consultar, concluir e desfazer; não cria, altera ou exclui atividades, não altera nome e não autoriza outros aparelhos.

**Sair deste aparelho** revoga a sessão atual. **Revogar todos os aparelhos infantis** nas preferências revoga sessões infantis e códigos pendentes. Esta versão faz revogação em lote; não há lista nominal nem revogação individual remota. O código é uma autorização temporária: entregar apenas ao aparelho desejado. Não cadastrar a senha do responsável no navegador infantil. Não salvar a senha infantilmente; não existe senha infantil a memorizar.

Login e resgate compartilham limite persistente de cinco tentativas por IP em janela de 15 minutos, mais teto global de 50 na mesma janela. Tentativas bem-sucedidas também contam. Reinício não limpa os limites. Vários aparelhos usando o mesmo IP compartilham o limite; aguarde a janela, sem apagar tabelas reais para contornar.

Mutações exigem Origin exata; POST/PUT exigem JSON. Sessões autenticadas exigem também token CSRF, recebido em `/api/me`. Host é validado em toda requisição, sem confiar no Host enviado arbitrariamente. Não habilitar CORS. Política CSP local, bloqueio de frames, `nosniff`, `no-store` e ausência de referências externas são mantidos. O navegador de um aparelho autorizado pode consultar todas as datas da agenda familiar única; não há separação entre várias crianças.

## Rede, DNS e Deco

1. Usar os valores confirmados: `Ethernet 5`, `192.168.2.10`, gateway `192.168.2.1`, perfil `Private`. Antes da implantação, reconferir no diagnóstico somente leitura e verificar a reserva DHCP para o MAC dessa interface no MikroTik. O gateway confirmado não comprova que o serviço DNS esteja habilitado; verificar isso separadamente.
2. Confirmar Deco M4 em modo ponto de acesso. Usar a rede doméstica, não rede de visitantes com isolamento. Se clientes não alcançam o PC, investigar isolamento de clientes, VLAN e roteamento antes de ampliar permissões.
3. Após autorização de rede, criar registro DNS estático no MikroTik. Exemplo a revisar no RouterOS, **não executado nesta entrega**:

```routeros
/ip dns static add name=davi.home.arpa address=192.168.2.10 comment="Agenda interna Davi"
```

4. Verificar se os clientes recebem o MikroTik como DNS via DHCP. Se o roteador precisar responder DNS, revisar `allow-remote-requests` e as regras existentes para UDP/TCP 53: permitir apenas LAN e bloquear WAN. Não ativar resolução recursiva acessível pela internet. A [documentação DNS do MikroTik](https://manual.mikrotik.com/docs/network-management/dns/) explica o registro estático e o alcance dessa opção.
5. Testar `nslookup davi.home.arpa 192.168.2.1`, depois `nslookup davi.home.arpa` em cada cliente. DNS privado/DoH no aparelho pode ignorar DNS local: configurar exceção ou usar o IP HTTPS autorizado. Não desligar validação TLS para resolver DNS.

O gerador prepara **https://davi.home.arpa** e **https://192.168.2.10**. Ambos recebem certificado interno válido para o respectivo nome/IP. As sessões são independentes entre hostname e IP; prefira um endereço estável. Alterar IP requer revisar DHCP, DNS, Caddyfile, origens e regra de firewall. Não adicionar port forwarding, DMZ, UPnP ou abertura WAN no MikroTik. Não registrar domínio externo.

## HTTPS e confiança na CA

O Caddy usa [`tls internal`](https://caddyserver.com/docs/caddyfile/directives/tls), sem ACME público. Não há redirecionador HTTP, porta 80, QUIC/UDP ou API administrativa do Caddy. O proxy escuta somente no IPv4 escolhido, TCP 443 por padrão. `skip_install_trust` impede instalação automática de confiança. Certificados de servidor são renovados automaticamente enquanto serviço e armazenamento estão disponíveis.

Na primeira inicialização **autorizada**, a raiz fica em `publicacao/caddy-data/caddy/pki/authorities/local/root.crt`. Copiar somente esse certificado público para os dispositivos que o responsável aprovar, preferencialmente por cabo ou meio local já confiável. Inspecionar a identidade com `certutil -dump <arquivo>`. Calcular a impressão digital SHA-256 do certificado DER no PC e compará-la com os detalhes exibidos no aparelho:

```powershell
python -c "import ssl,hashlib,pathlib; print(hashlib.sha256(ssl.PEM_cert_to_DER_cert(pathlib.Path(r'publicacao/caddy-data/caddy/pki/authorities/local/root.crt').read_text())).hexdigest())"
```
 Um hash do arquivo PEM não é a mesma coisa que o fingerprint DER do certificado. Não baixar a raiz por uma página com aviso de certificado e presumir que é autêntica.

**Nunca distribuir `root.key`, chaves intermediárias, diretório inteiro da CA, `config.json`, XMLs privados ou Caddyfile com segredo.** Uma CA instalada pode emitir certificados confiáveis pelo aparelho: só instalar a CA sob controle do responsável. Guardar cópia privada da CA em armazenamento restrito e criptografado para continuidade; é separada do backup da agenda. Se perder ou comprometer a chave, gerar nova CA, remover a antiga de todos os dispositivos e distribuir a nova após verificação.

- **Windows:** abrir o certificado e instalar em **Usuário Atual → Autoridades de Certificação Raiz Confiáveis**; confirmar nome/fingerprint. Não usar Computador Local sem necessidade e aprovação. Reabrir Edge/Chrome. Firefox pode usar armazenamento próprio; importar a raiz nele, se necessário. Remoção pelo `certmgr.msc` do usuário, identificando a raiz correta.
- **Android:** Configurações → Segurança e privacidade → Mais configurações → Criptografia e credenciais → Instalar certificado → Certificado de CA (nomes variam). Confirmar origem e fingerprint. A [orientação oficial do Android/Pixel](https://support.google.com/pixelphone/answer/2844832) descreve instalação e remoção. Alguns aparelhos gerenciados bloqueiam CAs de usuário; não contornar política.
- **iPhone/iPad:** transferir `root.crt`, instalar o perfil em Ajustes → Geral → VPN e Gerenciamento de Dispositivo; depois Ajustes → Geral → Sobre → Ajustes de Confiança de Certificado e habilitar confiança total para a raiz aprovada. A [Apple exige esse passo adicional para SSL](https://support.apple.com/en-us/102390). Remover perfil/confiança ao desautorizar a CA.

Abrir o endereço exato e confirmar ausência de aviso TLS **antes** de digitar senha ou código. Se houver erro, parar e conferir nome/IP, relógio, CA e certificado. Não usar `--insecure`, exceções permanentes ou validação TLS desabilitada.

## Serviços, conta e permissões

São dois serviços WinSW: `DaviApp` e `DaviProxy`, início automático, com o proxy dependente do app. Falhas de processo solicitam reinício após dez segundos. O proxy iniciado antes de a aplicação aceitar conexões pode retornar 502 brevemente; repetir após inicialização.

Ambos usam explicitamente **NT AUTHORITY\LocalService**, não LocalSystem nem uma conta pessoal. Essa conta tem poucos privilégios, mas é compartilhada por outros serviços locais; não oferece isolamento entre os dois componentes. Para um host compartilhado com software não confiável, adotar contas dedicadas e revisar XMLs/ACLs antes da implantação. Não usar senha pessoal em XML.

`Permissoes` exige **SID explícito de uma conta local habilitada do responsável** e **caminho de snapshot em um diretório novo**, fora de `dados/` e `publicacao/`. Não presume que a conta elevada do instalador seja a conta usada pela família. O SID é resolvido com `Get-LocalUser`; grupos amplos, contas de serviço e SID inválido são recusados. Para identificar a conta local apropriada, o responsável consulta `Get-LocalUser | Select-Object Name,SID,Enabled` no seu próprio PC e escolhe a conta que fará manutenção. Não registrar esse resultado privado no GitHub.

A política de menor privilégio é:

| Local | Administradores / SYSTEM | LocalService | Conta local de manutenção |
| --- | --- | --- | --- |
| `dados/`, agenda, autenticação e backups | Controle total | Modificar | Modificar |
| `publicacao/logs/` e `publicacao/caddy-data/` | Controle total | Modificar | Ler/executar |
| Configuração, XMLs e binários da publicação | Controle total | Ler/executar | Ler/executar |
| Raiz e arquivos de código do projeto | ACEs anteriores preservadas | Acrescenta ler/executar, sem propagação | ACEs anteriores preservadas |

Modificar dados permite backup/restauração dos arquivos e manutenção da agenda sem conceder controle de ACLs, propriedade, código ou executáveis à conta familiar. Atualização de binários/configuração e operações de ACL continuam elevadas. A conta familiar escolhida é confiável: poderá ler agenda, hash de senha e material privado da CA. Não usar conta compartilhada com pessoas sem autorização. Owner/group são preservados; o Windows permite ao proprietário administrar a DACL. O preflight recusa proprietário de dados/publicação fora de manutenção, operador atual, Administradores, SYSTEM ou LocalService; não toma posse silenciosamente. O teste verifica as ACEs do serviço e o acesso real da conta executora aos arquivos sintéticos; não executa LocalService por impersonação nem instala serviços.

O módulo `scripts/Acl-Lan.psm1` enumera todos os alvos antes de mudar DACLs e recusa reparse points sem entrar neles. Inclui no snapshot **também a raiz e os arquivos de código** que receberão leitura para LocalService. Salva SDDL de DACL/ACEs, flags de herança, proprietário e grupo de cada item, com caminhos e tipos, em `*.acl.json`, payload e checksum SHA-256. O arquivo é fechado com flush, relido, validado e comparado com as ACLs atuais **antes da primeira alteração nos alvos**. Não salva SACL de auditoria: ela não é alterada. O diretório novo do snapshot é protegido na criação, com acesso apenas ao operador que o criou, Administradores e SYSTEM. Esse ajuste protege o backup e não altera as ACLs dos alvos.

Somente depois do snapshot verificável substitui as DACLs de dados/publicação pela política acima. Não preserva ACEs amplas nesse conteúdo privado; elas ficam no snapshot para restauração. Verifica cada ACL aplicada. A verificação da aplicação normaliza apenas o indicador Windows `AutoInherited`, que o sistema pode acrescentar ao persistir; não ignora ACEs nem o bloqueio de herança. A restauração compara o SDDL original completo de DACL/owner/group. O checksum detecta corrupção acidental; não é assinatura contra alteração maliciosa por alguém que já controla o backup. Aceitar somente snapshots locais protegidos e conhecidos.

Se uma aplicação falhar parcialmente, tenta automaticamente restaurar **todos os itens do snapshot**, dos pais para os filhos, e verifica o resultado. Preserva o snapshot tanto no sucesso quanto na falha. Se a recuperação falhar, informa **rollback incompleto**, não inicia serviços e exige recuperação administrativa pelo comando explícito abaixo. Não há promessa de transação atômica de ACL do Windows nem de recuperação automática após queda de energia; nesse caso usar o snapshot persistido.

Aplicação e restauração recusam serviços Davi em execução e exigem janela sem processos manuais, gravações ou alterações na árvore. A restauração valida checksum, versão, raízes, tipos e escopo de todos os caminhos antes de escrever qualquer DACL, rejeitando caminho fora do projeto/publicação, duplicatas, links ou item ausente. Restaura os itens capturados; não apaga arquivos e não é restauração de conteúdo do banco. Arquivos criados após o snapshot exigem revisão separada. Preserve o snapshot original da primeira aplicação mesmo se gerar novos snapshots em reaplicações.

Não colocar dados em compartilhamento SMB, pasta pública, nuvem sincronizada ou unidade sem ACL NTFS adequada. O preflight recusa escrita preexistente no código por LocalService ou grupos amplos comuns (incluindo Everyone, Authenticated Users e Users), sem corrigi-la automaticamente. Rever também permissões do Python, grupos locais personalizados e o contexto efetivo do serviço na homologação autorizada para impedir substituição de código por contas não confiáveis. Backups de ACL contêm caminhos/SIDs privados: `acl-snapshots/` e `*.acl.json` estão no `.gitignore`; não versioná-los ou usar `git add -f`.

### Snapshot obrigatório e restauração explícita das permissões

Exemplo **para execução futura somente após aprovação**, em PowerShell elevado. Substituir o SID pelo da conta local do responsável e escolher um diretório novo para cada aplicação:

```powershell
$backupAcl = 'D:\davi-missoes\acl-snapshots\primeira-aplicacao\snapshot.acl.json'
.\scripts\Publicacao-Lan.ps1 -Acao Permissoes -SidManutencao '<SID-da-conta-local-do-responsavel>' -BackupAcl $backupAcl -Aprovado
```

O objeto retornado identifica o snapshot e o número de itens verificados. Guardar o caminho fora do Git. Para restaurar exatamente as permissões anteriores, com serviços e instâncias manuais parados:

```powershell
.\scripts\Publicacao-Lan.ps1 -Acao RestaurarPermissoes -BackupAcl 'D:\davi-missoes\acl-snapshots\primeira-aplicacao\snapshot.acl.json' -Aprovado -WhatIf
.\scripts\Publicacao-Lan.ps1 -Acao RestaurarPermissoes -BackupAcl 'D:\davi-missoes\acl-snapshots\primeira-aplicacao\snapshot.acl.json' -Aprovado
```

Restaurar ACLs pode restabelecer acessos amplos que existiam antes: manter a aplicação parada e avaliar o estado restaurado antes de publicar novamente. A restauração não modifica o SQLite, não reverte firewall/DNS e não remove serviços. Caso mude `-Pasta` na preparação, usar o mesmo valor em aplicação/restauração; snapshots de outra raiz são rejeitados. As operações usam [Get-Acl/Set-Acl e descritores Windows](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/set-acl?view=powershell-5.1).


No PowerShell elevado, **somente depois da autorização expressa para implantação**, revisar primeiro:

```powershell
.\scripts\Publicacao-Lan.ps1 -Acao Instalar -Aprovado -WhatIf
.\scripts\Publicacao-Lan.ps1 -Acao FirewallAdicionar -Aprovado -WhatIf
```

Depois, usando os caminhos dos binários já verificados e hashes SHA-256 desses executáveis:

```powershell
.\scripts\Publicacao-Lan.ps1 -Acao Instalar -WinSW <caminho-WinSW.exe> -Caddy <caminho-caddy.exe> -WinSWHash <SHA256-WinSW-exe> -CaddyHash <SHA256-Caddy-exe> -Aprovado
.\scripts\Publicacao-Lan.ps1 -Acao Permissoes -SidManutencao '<SID-da-conta-local-do-responsavel>' -BackupAcl 'D:\davi-missoes\acl-snapshots\primeira-aplicacao\snapshot.acl.json' -Aprovado
.\scripts\Publicacao-Lan.ps1 -Acao FirewallAdicionar -Aprovado
.\scripts\Publicacao-Lan.ps1 -Acao Iniciar -Aprovado
.\scripts\Publicacao-Lan.ps1 -Acao Status
```

Os comandos mutáveis também pedem confirmação via `ShouldProcess`; `-Aprovado` indica a autorização expressa, não a presume. Instalar configura início automático, mas não inicia nessa operação. Se houver falha parcial, consultar Status e remover os serviços criados via Desinstalar antes de tentar novamente. Não reiniciar o computador com preparação parcial.

Operações posteriores, também sujeitas a aprovação:

```powershell
.\scripts\Publicacao-Lan.ps1 -Acao Reiniciar -Aprovado
.\scripts\Publicacao-Lan.ps1 -Acao Parar -Aprovado
.\scripts\Publicacao-Lan.ps1 -Acao Desinstalar -Aprovado
.\scripts\Publicacao-Lan.ps1 -Acao FirewallRemover -Aprovado
```

Parar/desinstalar ignora serviços já parados/ausentes. Desinstalação remove apenas serviços, preservando banco, backups, CA, configurações e arquivos locais; a regra de firewall tem reversão separada. Não apagar `dados/`. ACLs protetoras são mantidas pela desinstalação; para revertê-las, usar `RestaurarPermissoes` com o snapshot correspondente e manter a aplicação parada.

## Firewall Windows

Regra única `Davi-LAN-HTTPS-v04`: entrada TCP, porta lida do `network.json`, endereço local específico, `RemoteAddress=192.168.2.0/24`, executável `publicacao/bin/caddy.exe` e `EdgeTraversalPolicy=Block`. `Profile=Any` mantém funcionamento tanto com perfil Windows Público quanto Privado, mantendo restrição por endereço e origem. O perfil confirmado é `Private`; o script não o altera. A abrangência de perfis não amplia a sub-rede ou o endereço local da regra. O script não muda o perfil, não desliga firewall e não abre a porta do backend.

A ação exige `-Aprovado`, confirmação e administrador; oferece `-WhatIf`. Recusa ampliar a sub-rede pelo arquivo gerado. Reversão remove somente a regra nomeada. Revisar regras anteriores amplas para Python/Caddy e confirmar bloqueio padrão de entrada: a nova regra restrita não neutraliza regras permissivas preexistentes. Não modificar essas regras automaticamente. A validação do proxy e da aplicação continua restringindo rede e autorização mesmo diante de uma regra ampla.

## Backup, integridade e restauração

Em modo de publicação, o backend faz backup na inicialização e a cada 24 horas em `dados/backups/`, com retenção dos 14 snapshots mais recentes. Usa a API SQLite `backup`, não cópia de arquivo ativo, e `PRAGMA integrity_check` na origem e no snapshot. Publica o arquivo só depois de verificá-lo; a rotação só ocorre após sucesso e limita-se aos arquivos `davi-*.sqlite3` da pasta escolhida. Não usar essa pasta para outros arquivos com o mesmo prefixo. Falha de espaço/permissão/integridade é registrada sem dados da agenda, mas não há alerta remoto.

O backup da agenda inclui o hash do responsável: tratar como dado particular. Sessões e códigos **não são copiados** para os snapshots da agenda. A restauração revoga sessões/códigos no `auth.sqlite3`; dispositivos precisam de nova autorização. Sessões persistem em reinícios normais, não em restauração. Cópia no mesmo disco não protege contra falha do disco: manter cópia periódica fora do PC, em mídia local protegida/criptografada, sob responsabilidade familiar.

Operações manuais (executar elevadas quando as ACLs já estiverem aplicadas):

```powershell
python maintenance.py backup --database D:\davi-missoes\dados\agenda.sqlite3 --directory D:\davi-missoes\dados\backups --keep 14
python maintenance.py integrity --database D:\davi-missoes\dados\agenda.sqlite3
```

Para restaurar, com aprovação:

1. Parar proxy e aplicação e verificar Status. Encerrar também instâncias manuais. `--confirm-stopped` é confirmação operacional, não detecta todos os processos externos.
2. Escolher snapshot, conferir integridade e manter cópia restrita do estado atual.
3. Executar:

```powershell
python maintenance.py restore --database D:\davi-missoes\dados\agenda.sqlite3 --source <snapshot.sqlite3> --confirm-stopped
```

4. O comando valida o snapshot, salva o banco atual em `dados/antes-restauracao/` e substitui por um snapshot consistente verificado. Se houver `-wal`, `-shm` ou `-journal`, recusa: não apagar esses arquivos; investigar parada/recuperação antes de continuar.
5. Reaplicar `Permissoes` após a substituição, informando SID e **novo** diretório de snapshot, para verificar ACL do novo arquivo; preservar snapshots anteriores. Iniciar serviços, entrar como responsável, conferir uma data conhecida e reautorizar aparelhos. Não enviar agenda ou logs privados ao GitHub.

Logs da aplicação registram somente estado de backup e erros genéricos, sem URLs/IPs/cookies/senhas/códigos ou conteúdo da agenda. Access log do Caddy não está habilitado. WinSW mantém logs de processo com rotação por tamanho: cinco arquivos de até aproximadamente 1 MiB por fluxo. Logs de erro do Caddy podem conter metadados técnicos de conexão: não publicá-los sem revisão. Evitar modo debug em produção.

## Atalhos de acesso

Depois de validar HTTPS e autorizar o dispositivo:

- Android/Chrome: menu → Adicionar à tela inicial → criar atalho.
- iPhone/Safari: Compartilhar → Adicionar à Tela de Início.
- Windows: criar atalho para `https://davi.home.arpa` ou usar a opção de instalar/abrir como aplicativo do Edge, quando disponível.

Não há service worker nem agenda offline: o PC precisa estar disponível. Atalho não substitui autorização; se o navegador usar armazenamento separado para o atalho, autorizar esse contexto também. Não usar navegação privada para sessões duradouras. Dados não são gravados em localStorage.

## Atualização e rollback

Antes de atualizar: aprovação de revisão, backup verificado, anotar commit em uso e versões de Python/Caddy/WinSW, preservar configurações e CA fora do Git. Parar ambos os serviços, atualizar somente código revisado, executar testes em diretório temporário, revalidar Caddyfile e ACLs, então iniciar e testar login, dispositivo infantil, conclusão/desfazer e status. Não usar `git clean -xfd`, não copiar uma pasta `dados/` de outro ambiente e não regenerar a CA em cada atualização.

Rollback: parar serviços, retornar ao commit anterior revisado e manter dados/CA. Nesta etapa não há migração do schema da agenda; `auth.sqlite3` é separado. Se o código anterior for v0.3, ele não tem proteção LAN: manter proxy parado e remover a regra de firewall; eventual execução deve ser só local e com acesso físico controlado. Para corrupção de dados, usar o procedimento de restauração, não sobrescrever arquivos com o servidor aberto. Se desistir da publicação, desinstalar serviços, remover regra e retirar a raiz dos aparelhos; preservar banco/backups. DNS estático no MikroTik pode ser removido manualmente depois de confirmar que corresponde a esta instalação.

## Passos de publicação e aceitação — pendentes de autorização

1. Aprovar as PRs na ordem de dependência; nenhuma foi mesclada nesta entrega.
2. Autorizar janela de manutenção. Diagnosticar portas, rede, espaço, Python e permissões; fazer backup consistente do banco existente.
3. Definir IP reservado e DNS interno; confirmar Deco/AP e ausência de encaminhamento WAN. Revisar firewall do MikroTik sem presumir configuração existente.
4. Preparar arquivos privados, conferir configurações e binários; usar senha existente ou criar primeira senha offline se ausente.
5. Instalar serviços, aplicar ACLs e regra restrita com aprovação; iniciar serviços.
6. Verificar Status e logs; distribuir somente raiz pública aos dispositivos aprovados, comparar fingerprint e validar HTTPS por hostname/IP.
7. Em dispositivo novo, confirmar que a agenda não aparece; entrar como responsável em aparelho próprio, autorizar aparelho infantil, testar isolamento, conclusão/desfazer e logout.
8. Testar com aparelhos físicos Android/iPhone/Windows, perfil de rede atual e uma origem fora da sub-rede. Não ampliar regras se algo falhar sem identificar causa.
9. Em janela autorizada, reiniciar o Windows e verificar início automático, HTTPS e persistência infantil. Confirmar integridade e produção do backup. Registrar evidência sem dados pessoais.

## Testes executados e evidências

Em Windows/Python 3.13.5, em 17/11/2026, exclusivamente com dados sintéticos:

| Verificação | Evidência |
| --- | --- |
| Calendário anterior + segurança, CRUD, feriados, recorrências, concluir/desfazer, backup/restauração, rotação e reinício real do processo | `tests/test_calendar.py` e `tests/test_lan.py` (21 testes) |
| Caddy 2.11.9 real, adaptação do Caddyfile original, HTTPS em loopback, CA não confiável rejeitada, CA explícita aceita, cookie Secure, login e logout | `tests/test_tls.py` (1 teste; total Python: 22 aprovados) |
| Sintaxe PowerShell, ordem de reinício proxy/app, bloqueio sem aprovação, WhatIf sem mutações e diagnóstico da Ethernet 5 com dados simulados corretos/divergentes | `tests/test_service.ps1` |
| ACLs reais, snapshot, ACEs antigas e herança, acesso de manutenção, privilégios do serviço, falha parcial e rollback, corrupção/escopo/junction recusados | `tests/test_acl.ps1`, em árvore temporária no Windows |
| Regressões visuais de categoria, horário, datas e progresso | `tests/test_visual.cjs`: 9 testes |
| Fluxos completos do redesign + dispositivo novo, autorização infantil persistente, isolamento e logout | `tests/browser_redesign.cjs`: 8 grupos |
| Responsável e criança em 360, 390, 768, 1366 e 1920 px | [10 capturas e relatório](evidencias-v04/validation.json), sem overflow, sobreposição ou erros JS |
| Acessibilidade automatizada | 10 auditorias Axe A/AA sem violações nas áreas existentes; auditoria adicional da tela de autorização sem violações |

O teste TLS adapta o listener **somente no arquivo temporário** para 127.0.0.1 e simula IP LAN no cabeçalho interno. Não escuta no endereço real da rede e não instala confiança no Windows. O cliente Python carrega a raiz temporária explicitamente, mantendo verificação de cadeia e nome. Os testes de API também simulam origens HTTPS e os cabeçalhos do proxy, incluindo Host/IP/segredo inválidos, expiração, CSRF, código de uso único, limitação persistente e acesso direto bloqueado.

O teste de reinício encerra e inicia **duas vezes o processo real da aplicação** em pasta temporária, confirmando persistência da sessão e da agenda. O teste PowerShell substitui o executor de serviços para validar ordem e bloqueios. **Não houve instalação/reinício real no SCM nem reinicialização do Windows.** A aceitação desses pontos depende de ambiente Windows de homologação autorizado, porque a governança proíbe instalá-los neste desenvolvimento.

Para repetir:

```powershell
# Caminho de um caddy.exe oficial verificado; opcional só para testes TLS.
$env:DAVI_TEST_CADDY = '<caminho-caddy.exe>'
python -m unittest discover -s tests -v
node --test tests/test_visual.cjs
powershell -NoProfile -File tests/test_service.ps1
powershell -NoProfile -File tests/test_acl.ps1
$env:NODE_PATH = Join-Path $env:TEMP 'davi-redesign-tools/node_modules'
$env:PYTHON = (Get-Command python).Source
node tests/browser_redesign.cjs
```

As dependências opcionais de navegador continuam sendo Playwright 1.65.1 e `@axe-core/playwright` 4.14.0, instaladas fora do projeto conforme README. Sem `DAVI_TEST_CADDY`, o teste TLS é explicitamente pulado; isso não comprova HTTPS real. O navegador gera evidências em `docs/evidencias-v04/`, preservando as capturas da PR #1.

## Limitações

- Sem avaliação física em Android/iPhone, Wi-Fi, DNS MikroTik ou perfil Público/Privado real; revisar na implantação. Sem teste real de SCM, reboot ou falha elétrica. Não afirmar homologação desses pontos a partir da simulação.
- O servidor Python da biblioteca padrão não é plataforma para internet ou usuários hostis. Há timeout de conexão e tamanho máximo de corpo; ainda não há monitoramento, limite global de conexões ou testes de carga. Caddy e firewall restringem a superfície à LAN.
- Não protege contra administrador Windows, malware local, aparelho autorizado desbloqueado ou comprometimento da CA. Login persistente exige cuidado físico com o dispositivo.
- Revogação infantil é em lote; validade absoluta não se renova automaticamente. Sessões do responsável também persistem no SQLite por até oito horas após reinício.
- Banco e backups não são criptografados pela aplicação; usar permissões e proteção de disco/mídia. Backup no mesmo disco é insuficiente para desastre.
- Atalhos não são aplicativo offline. Acessibilidade automatizada não substitui leitor de tela, toque e avaliação familiar.
- Nenhuma alteração de horários, recorrências, feriados, medicações ou conclusão automática. O jogo guiado continua independente.

Referência para configuração dos serviços: [WinSW 2.12 — XML e conta de serviço](https://github.com/winsw/winsw/blob/v2.12.0/doc/xmlConfigFile.md). Revisar versões e binários antes da instalação; atualização de binários é uma operação separada e aprovada.

## Correção da revisão de ACL/rollback

Atende à [pendência bloqueante da PR #2](https://github.com/nellipe/davi-missoes/pull/2#issuecomment-6957920901): snapshot verificável antes das mudanças, comando de restauração, conta de manutenção explícita e testes reais de ACL no Windows com falha parcial. Os testes criam somente pastas/arquivos sintéticos no TEMP, aplicam e restauram ACLs usando as APIs reais do Windows e removem a árvore temporária após validar seu caminho absoluto. Nenhuma ACL foi aplicada nas pastas reais do projeto/dados/publicação; nenhum SQLite real foi modificado. A PR #1 permanece independente e precisa de aprovação/merge separado antes de rebase ou revisão final da #2. Não houve rebase, merge, instalação, firewall, DNS ou trust CA.
