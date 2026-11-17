[CmdletBinding(SupportsShouldProcess, ConfirmImpact='High')]
param(
    [Parameter(Mandatory)][ValidateSet('Diagnostico','Preparar','Permissoes','RestaurarPermissoes','Instalar','Status','Iniciar','Reiniciar','Parar','Desinstalar','FirewallAdicionar','FirewallRemover')][string]$Acao,
    [string]$Pasta = (Join-Path (Split-Path $PSScriptRoot) 'publicacao'),
    [string]$Endereco = '192.168.2.10',
    [string]$InterfaceAlias = 'Ethernet 5',
    [string]$GatewayEsperado = '192.168.2.1',
    [ValidateSet('Private','Public')][string]$PerfilEsperado = 'Private',
    [string]$Hostname = 'davi.home.arpa',
    [ValidateRange(1,65535)][int]$Porta = 443,
    [string]$Python = 'C:\Program Files\Python313\python.exe',
    [string]$WinSW,
    [string]$Caddy,
    [string]$WinSWHash,
    [string]$CaddyHash,
    [string]$SidManutencao,
    [string]$BackupAcl,
    [switch]$Aprovado
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projeto = Split-Path $PSScriptRoot
$Pasta = [IO.Path]::GetFullPath($Pasta)
$regra = 'Davi-LAN-HTTPS-v04'
function Executar-Nativo([string]$Exe, [string[]]$Argumentos) {
    & $Exe @Argumentos
    if ($LASTEXITCODE -ne 0) { throw "Comando falhou: $Exe" }
}
function Exigir-Admin {
    $identidade = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identidade)
    if (!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Abra PowerShell como administrador.' }
}
function Exigir-ServicosParados {
    $ativos = @(Get-Service -Name DaviApp,DaviProxy -ErrorAction SilentlyContinue | Where-Object Status -ne 'Stopped')
    if ($ativos.Count) { throw 'Pare os serviços antes de aplicar/restaurar ACLs. Feche também instâncias manuais.' }
}
function Conferir-Binario([string]$Arquivo, [string]$HashEsperado) {
    if ($HashEsperado -notmatch '^[a-fA-F0-9]{64}$' -or (Get-FileHash -LiteralPath $Arquivo -Algorithm SHA256).Hash -ne $HashEsperado) {
        throw 'Hash ausente ou diferente. Confira o SHA256 obtido da distribuição oficial.'
    }
}
function Conferir-AmbienteRede {
    # Somente leitura. Divergência exige revisão, nunca reconfiguração automática.
    $ips = @(Get-NetIPAddress -InterfaceAlias $InterfaceAlias -AddressFamily IPv4 -ErrorAction SilentlyContinue)
    $rotas = @(Get-NetRoute -InterfaceAlias $InterfaceAlias -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue)
    $perfis = @(Get-NetConnectionProfile -InterfaceAlias $InterfaceAlias -ErrorAction SilentlyContinue)
    [pscustomobject]@{
        Interface = $InterfaceAlias
        IPv4Esperado = $Endereco
        GatewayEsperado = $GatewayEsperado
        PerfilEsperado = $PerfilEsperado
        IPConfere = (@($ips | ForEach-Object { $_.IPAddress }) -contains $Endereco)
        GatewayConfere = (@($rotas | ForEach-Object { $_.NextHop }) -contains $GatewayEsperado)
        PerfilConfere = (@($perfis | ForEach-Object { [string]$_.NetworkCategory }) -contains $PerfilEsperado)
    }
}
function Ler-Rede {
    $rede = Get-Content -LiteralPath (Join-Path $Pasta 'network.json') -Raw | ConvertFrom-Json
    if ($rede.subnet -ne '192.168.2.0/24' -or $rede.address -notmatch '^192\.168\.2\.(?:[1-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-4])$' -or $rede.port -lt 1 -or $rede.port -gt 65535) {
        throw 'Configuração da rede inválida.'
    }
    return $rede
}
function Adicionar-RegraFirewall {
    $rede = Ler-Rede
    if (Get-NetFirewallRule -Name $regra -ErrorAction SilentlyContinue) { throw 'Regra já existe. Revise antes de substituir.' }
    New-NetFirewallRule -Name $regra -DisplayName 'Davi HTTPS somente LAN domestica' -Direction Inbound -Action Allow -Enabled True -Protocol TCP -LocalPort $rede.port -LocalAddress $rede.address -RemoteAddress $rede.subnet -Profile Any -Program (Join-Path $Pasta 'bin/caddy.exe') -EdgeTraversalPolicy Block
}
function Operar-Servico([string]$Nome, [string]$Comando) {
    Executar-Nativo (Join-Path $Pasta "$Nome.exe") @($Comando)
}
function Parar-Servicos {
    foreach ($nome in @('DaviProxy','DaviApp')) {
        $servico = Get-Service -Name $nome -ErrorAction SilentlyContinue
        if ($servico -and $servico.Status -ne 'Stopped') { Operar-Servico $nome 'stopwait' }
    }
}
function Reiniciar-Servicos {
    Operar-Servico 'DaviProxy' 'stopwait'
    Operar-Servico 'DaviApp' 'restart'
    Operar-Servico 'DaviProxy' 'start'
}

if ($Acao -eq 'Diagnostico') {
    Executar-Nativo $Python @('--version')
    Executar-Nativo $Python @('-c', 'import sqlite3,ssl; print(1)')
    Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full' -Name Release -ErrorAction SilentlyContinue | Select-Object Release
    Conferir-AmbienteRede
    Get-NetConnectionProfile -InterfaceAlias $InterfaceAlias | Select-Object InterfaceAlias,NetworkCategory
    Get-NetIPAddress -InterfaceAlias $InterfaceAlias -AddressFamily IPv4 | Select-Object InterfaceAlias,IPAddress
    Get-NetTCPConnection -State Listen | Where-Object LocalPort -in @($Porta,8765) | Select-Object LocalAddress,LocalPort
    Get-Service -Name DaviApp,DaviProxy -ErrorAction SilentlyContinue | Select-Object Name,Status,StartType
    Write-Output "Banco existente: $(Test-Path -LiteralPath (Join-Path $projeto 'dados/agenda.sqlite3'))"
    return
}
if ($Acao -eq 'Preparar') {
    if (!$Endereco) { throw 'Informe -Endereco com o IP reservado do computador.' }
    Executar-Nativo $Python @((Join-Path $projeto 'prepare_lan.py'),'--output',$Pasta,'--address',$Endereco,'--hostname',$Hostname,'--port',"$Porta")
    return
}
if ($Acao -eq 'Status') {
    Get-Service -Name DaviApp,DaviProxy -ErrorAction SilentlyContinue | Select-Object Name,Status,StartType
    Get-NetFirewallRule -Name $regra -ErrorAction SilentlyContinue | Select-Object Name,Enabled,Profile
    return
}
if (!$Aprovado) { throw 'Alteração bloqueada. A autorização expressa é indicada por -Aprovado; use -WhatIf para revisar.' }
if (!$PSCmdlet.ShouldProcess($Pasta, $Acao)) { return }
Exigir-Admin
switch ($Acao) {
    'Permissoes' {
        Exigir-ServicosParados
        if (!$SidManutencao -or !$BackupAcl) { throw 'Informe -SidManutencao da conta local responsável e -BackupAcl em diretório novo.' }
        Import-Module (Join-Path $PSScriptRoot 'Acl-Lan.psm1') -Force
        Set-DaviPermissions -ProjectRoot $projeto -PublicationRoot $Pasta -SnapshotPath $BackupAcl -MaintenanceSid $SidManutencao
    }
    'RestaurarPermissoes' {
        Exigir-ServicosParados
        if (!$BackupAcl) { throw 'Informe -BackupAcl do snapshot a restaurar.' }
        Import-Module (Join-Path $PSScriptRoot 'Acl-Lan.psm1') -Force
        Restore-DaviAcl -ProjectRoot $projeto -PublicationRoot $Pasta -SnapshotPath $BackupAcl
    }
    'Instalar' {
        $null = Ler-Rede
        $framework = Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full' -Name Release -ErrorAction SilentlyContinue
        if (!$framework -or $framework.Release -lt 528040) { throw '.NET Framework 4.8 necessário para o wrapper NET461 recomendado.' }
        if ((Get-Service DaviApp,DaviProxy -ErrorAction SilentlyContinue)) { throw 'Serviço já existe; use atualização documentada.' }
        if (!(Test-Path -LiteralPath (Join-Path $projeto 'dados/agenda.sqlite3'))) { throw 'Banco existente ausente.' }
        Conferir-Binario $WinSW $WinSWHash
        Conferir-Binario $Caddy $CaddyHash
        Copy-Item -LiteralPath $WinSW -Destination (Join-Path $Pasta 'DaviApp.exe')
        Copy-Item -LiteralPath $WinSW -Destination (Join-Path $Pasta 'DaviProxy.exe')
        Copy-Item -LiteralPath $Caddy -Destination (Join-Path $Pasta 'bin/caddy.exe')
        # Adaptar valida sintaxe sem iniciar listener ou instalar confiança TLS.
        Executar-Nativo (Join-Path $Pasta 'bin/caddy.exe') @('adapt','--config',(Join-Path $Pasta 'Caddyfile'),'--adapter','caddyfile')
        Operar-Servico 'DaviApp' 'install'
        Operar-Servico 'DaviProxy' 'install'
        Write-Output 'Instalados com início automático. Não iniciados; confira permissões e firewall antes de Iniciar.'
    }
    'Iniciar' { Operar-Servico 'DaviApp' 'start'; Operar-Servico 'DaviProxy' 'start' }
    'Reiniciar' { Reiniciar-Servicos }
    'Parar' { Parar-Servicos }
    'Desinstalar' {
        Parar-Servicos
        foreach ($nome in @('DaviProxy','DaviApp')) {
            if (Get-Service -Name $nome -ErrorAction SilentlyContinue) { Operar-Servico $nome 'uninstall' }
        }
        Write-Output 'Serviços removidos. Banco, backups, configuração e CA preservados. Firewall tem reversão separada.'
    }
    'FirewallAdicionar' { Adicionar-RegraFirewall }
    'FirewallRemover' { Remove-NetFirewallRule -Name $regra }
}
