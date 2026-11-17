# Aventuras do Davi na LAN

> Referência histórica do HTTP provisório. A publicação definitiva usa o [procedimento HTTPS V0.5](publicacao-v05.md). Não execute este inicializador junto dos serviços.

O modo LAN simples publica HTTP diretamente em **http://192.168.2.10:8765**, somente para clientes da rede **192.168.2.0/24**. Exige Windows com esse IPv4 e Python 3.10+. Não usa proxy, DNS, certificados, serviços Windows ou alterações de permissões NTFS.

## Iniciar e encerrar

Na pasta existente `D:\davi-missoes`, dê dois cliques em `Iniciar-Davi-LAN.bat`. Ele usa `dados` ao lado do inicializador, mantém o servidor em primeiro plano e não instala nem configura nada no Windows. Abra o endereço acima no próprio computador ou em outro dispositivo da rede doméstica. Mantenha a janela aberta e pressione **Ctrl+C** para encerrar.

Se o IP não estiver configurado no computador ou a porta já estiver em uso, o servidor falha; não troca para `0.0.0.0` nem escolhe outro banco. Não execute dois servidores simultâneos na mesma porta.

Alternativa no PowerShell, em uma janela dedicada:

```powershell
cd D:\davi-missoes
$env:DAVI_LAN_SIMPLE = '1'
$env:DAVI_HOST = '192.168.2.10'
$env:DAVI_PORT = '8765'
$env:DAVI_LAN_CIDR = '192.168.2.0/24'
$env:DAVI_ORIGINS = 'http://192.168.2.10:8765'
Remove-Item Env:DAVI_PROXY_KEY -ErrorAction SilentlyContinue
$env:DAVI_DATA_DIR = Join-Path (Get-Location) 'dados'
py -3 .\server.py
```

Sem `DAVI_LAN_SIMPLE=1`, a configuração padrão continua em loopback com autorização por aparelho. O modo simples rejeita outra rede, IP de escuta, origem adicional ou chave de proxy. Ele verifica o IP real da conexão; `X-Forwarded-For`, `X-Davi-Client` e outros cabeçalhos não autorizam clientes.

## Firewall limitado à LAN

O inicializador **não altera o firewall**. Confira o perfil da conexão:

```powershell
Get-NetConnectionProfile -InterfaceAlias 'Ethernet 5'
```

Para uma conexão doméstica já configurada como `Private`, execute uma única vez no PowerShell **como administrador**:

```powershell
New-NetFirewallRule -DisplayName 'Davi-LAN-Simples-8765' `
  -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8765 `
  -LocalAddress 192.168.2.10 -RemoteAddress 192.168.2.0/24 `
  -InterfaceAlias 'Ethernet 5' -Profile Private -EdgeTraversalPolicy Block
```

Use a regra restrita acima caso o Windows ofereça uma liberação genérica do Python. Não habilite acesso no perfil público. Não configure encaminhamento de portas, DMZ, túnel ou publicação externa no roteador. Não são necessárias portas 80 ou 443. Mesmo com cabeçalhos forjados, o servidor recusa clientes fora da sub-rede.

Para remover apenas essa regra:

```powershell
Get-NetFirewallRule -DisplayName 'Davi-LAN-Simples-8765' | Remove-NetFirewallRule
```

## Dados e acesso

O SQLite existente, a senha, o calendário, as recorrências, as exceções e as conclusões são preservados. Nenhuma migração ou redefinição de senha é necessária. Não apague nem substitua `dados/agenda.sqlite3`. As sessões continuam separadas em `dados/auth.sqlite3`.

Qualquer dispositivo da sub-rede pode consultar a agenda e os feriados. Ao abrir a interface, recebe automaticamente cookie HttpOnly/SameSite=Strict e token CSRF para marcar ou desmarcar conclusões. Não existe aprovação individual de aparelhos nesse modo. O token é exigido junto à sessão, à origem HTTP exata e ao Host esperado nas escritas; requisições POST/PUT também exigem JSON. A sessão automática é renovada ao reabrir a página se expirar e só é aceita enquanto o modo LAN simples estiver ativo.

Cadastrar, editar ou excluir atividades, excluir ocorrências, mudar preferências e administrar autorizações continuam exigindo sessão do responsável obtida com a senha existente. A limitação persistente de tentativas de senha permanece ativa. Sair da área do responsável revoga a sessão administrativa e retorna ao acesso infantil da rede.

HTTP não cifra a agenda, os cookies ou a senha em trânsito. A escolha deste modo pressupõe confiança nos dispositivos da rede doméstica autorizada. Não há liberação para a internet nem suporte a clientes de outras sub-redes.

Para voltar ao padrão local: encerre com Ctrl+C, feche a janela e use `Iniciar-Davi.bat` em outra janela sem as variáveis LAN. O inicializador LAN usa `setlocal`, portanto não deixa sua configuração no ambiente de quem o chamou. Remova a regra de firewall se não for mais necessária.

## Validação com dados sintéticos

```powershell
py -3 -m unittest discover -s tests -v
node --test tests/test_visual.cjs
```

Os testes usam diretórios temporários e sockets loopback, simulando os IPs dos clientes no handler. Cobrem entrada automática de dois dispositivos sem pareamento, consulta, conclusão e desfazer, bloqueio administrativo, senha legada, logout, preservação das linhas do SQLite no reinício, Host/Origin/CSRF, JSON, limitação de tentativas e recusa de IPs externos mesmo com cabeçalhos forjados. Também verificam que a sessão automática deixa de funcionar ao desabilitar o modo LAN.

O teste Windows do inicializador usa uma cópia em pasta temporária com um servidor substituto que somente imprime a configuração; não inicia a aplicação real. A suíte original de calendário e autenticação permanece ativa. O teste TLS histórico é opcional e não requer instalar Caddy para este procedimento.

Não foram aplicadas regras de firewall nem iniciada a aplicação com o banco real durante a implementação. Os testes simulados não comprovam conectividade física entre o Windows e um celular; após iniciar e configurar a regra, a conferência operacional é abrir `http://192.168.2.10:8765` no dispositivo da mesma rede.

Resultado em Windows / Python 3.13: 26 testes Python aprovados e 1 teste TLS histórico ignorado; 9 testes JavaScript aprovados. O SHA-256 do banco real permaneceu idêntico antes e depois dos testes.
