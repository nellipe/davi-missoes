# Windows PowerShell 5.1. All Git/SCM/HTTP mutations are simulated.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.ServiceProcess
$scriptPath = Join-Path (Split-Path $PSScriptRoot) 'scripts/Publicar-Revisao.ps1'
$tokens = $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($scriptPath,[ref]$tokens,[ref]$errors)
if ($errors.Count) { throw ($errors | Out-String) }
$ShaPiloto = '5' * 40
$ShaAnterior = 'a' * 40
foreach ($acaoTeste in 'Publicar','Voltar') {
    $blocked = $false
    try { & $scriptPath -Acao $acaoTeste -ShaAprovado $ShaPiloto -Confirm:$false }
    catch { $blocked = $_.Exception.Message -match 'Alteracao bloqueada' }
    if (!$blocked) { throw "Acao sem -Aprovado foi aceita: $acaoTeste." }
    & $scriptPath -Acao $acaoTeste -ShaAprovado $ShaPiloto -Aprovado -WhatIf
}

$funcoes = $ast.FindAll({ param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] },$true)
foreach ($fn in $funcoes) {
    if ($fn.Name -notin @('Ler-Instalacao','Git-Instalado','Nativo','Ler-Build','Executar-Sonda')) {
        Invoke-Expression $fn.Extent.Text
    }
}
$temp = Join-Path ([IO.Path]::GetFullPath($env:TEMP)) ('publicacao-revisao-test-' + [guid]::NewGuid().ToString('N'))
$Raiz = Join-Path $temp 'checkout'
$RaizBackups = Join-Path $temp 'backups'
$Publicacao = Join-Path $Raiz 'publicacao'
$Publicador = Join-Path $temp 'publicador.ps1'
$Verificador = 'mock.py'
$Navegador = 'mock.cjs'
$NomeHttps = 'example.test'
$Origem = 'https://example.test/repo.git'
$RefPiloto = 'refs/pull/19/head'
$ArquivosFixos = @('config.json','root.crt')
$script:events = New-Object 'System.Collections.Generic.List[string]'
$script:states = @{DaviApp='Running'; DaviProxy='Running'}
$script:head = $ShaAnterior
$script:scenario = $null
$script:backendPid = 100

function Ler-Instalacao { [pscustomobject]@{Python='mock'; IP='127.0.0.2'} }
function Git-Instalado {
    switch ($args[0]) {
        'rev-parse' {
            if ($args -contains '--is-inside-work-tree') { return 'true' }
            if ($args -contains 'FETCH_HEAD^{commit}') { return $ShaPiloto }
            return $script:head
        }
        'remote' { return $Origem }
        'ls-remote' { return ($ShaPiloto + [char]9 + $RefPiloto) }
        'fetch' { $script:events.Add('fetch') }
        '-c' {
            Conferir-Estado Stopped
            if ($args -notcontains '--no-overwrite-ignore') { throw 'Checkout aceita sobrescrever ignorados.' }
            $script:head = $args[-1]
            $script:events.Add("switch:$($script:head)")
        }
        { $_ -in @('status','merge-base','ls-tree') } { return }
        default { throw 'Git inesperado.' }
    }
}
function Get-Service {
    param($Name)
    $mock = [pscustomobject]@{ Name=$Name; Status=$script:states[$Name] }
    $mock | Add-Member ScriptMethod WaitForStatus {
        param($esperado, $timeout)
        if ($timeout.TotalSeconds -ne 30) { throw 'Espera inesperada.' }
        $script:states[$this.Name] = [string]$esperado
        $script:events.Add("$($this.Name):$esperado")
    }
    $mock
}
function Get-CimInstance {
    param($Class,$Filter)
    if ($Class -eq 'Win32_Service') {
        [pscustomobject]@{Name='DaviApp'; State=$script:states.DaviApp; ProcessId=10}
        [pscustomobject]@{Name='DaviProxy'; State=$script:states.DaviProxy; ProcessId=20}
    } elseif ($Filter -eq 'ProcessId=200') {
        [pscustomobject]@{Name='caddy.exe'; ProcessId=200; ParentProcessId=20; CreationDate=[DateTime]'2026-11-19'}
    } else {
        [pscustomobject]@{Name='python.exe'; ProcessId=$script:backendPid; ParentProcessId=10; CreationDate=[DateTime]'2026-11-19'}
    }
}
function Get-NetTCPConnection {
    param($State,$LocalPort,$ErrorAction)
    if ($script:states.DaviApp -eq 'Running') {
        [pscustomobject]@{LocalAddress='127.0.0.1'; LocalPort=8765; OwningProcess=$script:backendPid}
    }
    if ($script:states.DaviProxy -eq 'Running') {
        [pscustomobject]@{LocalAddress='127.0.0.2'; LocalPort=443; OwningProcess=200}
    }
}
function Ler-Build {
    $script:events.Add('build')
    $sha = if ($script:head -eq $ShaPiloto -and $script:scenario -eq 'sha') { 'b'*40 } else { $script:head }
    [pscustomobject]@{commit=$sha; version='synthetic'}
}
function Nativo([string]$Exe,[string[]]$Argumentos) {
    if ($Exe -eq 'node.exe' -and $Argumentos[-1] -eq '--check') { return }
    if ($Exe -ne 'mock' -or $Argumentos[2] -ne 'snapshot' -or $Argumentos[3] -ne $Raiz) { throw 'Executor inesperado.' }
    Conferir-Estado Stopped
    $c = $Argumentos[4]
    if (!(Get-Acl -LiteralPath $c).AreAccessRulesProtected) { throw 'A copia nao tem ACL privada.' }
    Copy-Item -LiteralPath $Publicacao -Destination (Join-Path $c 'publicacao') -Recurse
    $script:events.Add('backup')
}
function Executar-Sonda([string]$Exe,[string[]]$Argumentos,[string]$Relatorio) {
    if ($Exe -eq 'mock') {
        $script:events.Add('https')
        [pscustomobject]@{seconds=12; requests=240}
    } else {
        $script:events.Add('chromium')
        if ($script:scenario -eq 'pid') { $script:backendPid++ }
        if ($script:scenario -eq 'abort') {
            '{"issues":[{"path":"/assets/forest/sight.mjs","status":502}]}' | Set-Content -LiteralPath $Relatorio
            $log = Join-Path $Publicacao 'logs\DaviProxy.err.log'
            $record = @{ts=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()/1000; status=502; msg='connection refused';
                request=@{uri='/assets/forest/sight.mjs?synthetic=private'; headers=@{Cookie='synthetic-private'}}}
            $record | ConvertTo-Json -Compress -Depth 4 | Add-Content -LiteralPath $log
            throw 'Sonda Chromium falhou.'
        }
        [pscustomobject]@{commit=$script:head; openings=3; agora=$true}
    }
}

$source = Get-Content -Raw -LiteralPath $scriptPath
$marker = '$Instalacao = Ler-Instalacao'
$fluxo = [scriptblock]::Create($source.Substring($source.IndexOf($marker)))
try {
    New-Item -ItemType Directory -Path $Publicacao,$RaizBackups,(Join-Path $Publicacao 'logs') | Out-Null
    foreach ($arquivo in $ArquivosFixos) { 'fixture' | Set-Content -LiteralPath (Join-Path $Publicacao $arquivo) }
    'synthetic-progress' | Set-Content -LiteralPath (Join-Path $Raiz 'agenda-guard.txt')
    @'
param($Acao,$Pasta,[switch]$Aprovado,[switch]$Confirm)
if (!$Aprovado) {throw 'Faltou -Aprovado.'}
$global:PublicarRevisaoTestEvents.Add($Acao)
'@ | Set-Content -LiteralPath $Publicador
    $global:PublicarRevisaoTestEvents=$script:events

    foreach ($case in 'abort','pid','sha','ok') {
        $script:events.Clear()
        $script:head = $ShaAnterior
        $script:scenario = $case
        $Acao = 'Publicar'
        $reports = New-Object 'System.Collections.Generic.List[string]'
        $failure = $null
        try { & $fluxo | ForEach-Object { $reports.Add([string]$_) } }
        catch { $failure = $_.Exception.Message }
        $sequence = $script:events -join '|'
        if ($sequence -notmatch "Parar\|DaviProxy:Stopped\|DaviApp:Stopped\|backup\|switch:$ShaPiloto\|Iniciar\|DaviApp:Running\|DaviProxy:Running\|build") {
            throw "Sequencia incorreta: $sequence. $failure"
        }
        if ($case -eq 'ok') {
            if ($failure -or $script:head -ne $ShaPiloto -or !($reports -match 'Publicacao verificada') -or
                $sequence -notmatch 'build\|https\|chromium\|build$') {
                throw "Resultado de sucesso incorreto: $failure. $sequence"
            }
        } else {
            if (!$failure -or $script:head -ne $ShaAnterior -or $reports -match '^Publicacao verificada' -or
                !($reports -match 'Rollback de codigo verificado por HTTPS') -or
                $sequence -notmatch "switch:$ShaAnterior\|Iniciar\|DaviApp:Running\|DaviProxy:Running\|build$") {
                throw "O gate aceitou a falha ou nao reverteu: $case. $failure. $sequence"
            }
            if ($case -eq 'abort') {
                $copia = (Get-ChildItem -LiteralPath $RaizBackups -Directory).FullName
                $trace = Get-Content -Raw -LiteralPath (Join-Path $copia 'falha-publicacao.json')
                if ($trace -notmatch 'sight\.mjs' -or $trace -notmatch '502' -or $trace -match 'synthetic-private|synthetic=') {
                    throw 'Registro de falha ausente ou contem dados nao permitidos.'
                }
            }
        }
        if ((Get-Content -LiteralPath (Join-Path $Raiz 'agenda-guard.txt')) -ne 'synthetic-progress') {
            throw 'Rollback modificou progresso.'
        }
    }
    'PASS: aprovacao, backup fechado, estabilidade, 502, PID divergente, SHA incorreto e rollback automatico.'
} finally {
    Remove-Variable -Name PublicarRevisaoTestEvents -Scope Global -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $temp) {
        $resolved = (Resolve-Path -LiteralPath $temp).ProviderPath
        $parent = (Resolve-Path -LiteralPath $env:TEMP).ProviderPath
        if ((Split-Path $resolved) -ne $parent -or (Split-Path $resolved -Leaf) -notmatch '^publicacao-revisao-test-[0-9a-f]{32}$') {
            throw 'Diretorio de teste inesperado.'
        }
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
