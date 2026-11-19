#Requires -Version 5.1
[CmdletBinding(SupportsShouldProcess, ConfirmImpact='High')]
param(
    [ValidateSet('Conferir','Publicar','Voltar')][string]$Acao = 'Conferir',
    [Parameter(Mandatory)][ValidatePattern('^[0-9a-f]{40}$')][string]$ShaAprovado,
    [string]$Copia,
    [switch]$Aprovado
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Raiz = 'D:\davi-missoes'
$RaizBackups = 'D:\davi-backups'
$ShaPiloto = $ShaAprovado
$RefPiloto = 'refs/pull/19/head'
$Origem = 'https://github.com/nellipe/davi-missoes.git'
$NomeHttps = 'aventuras.davi.costa'
$Publicacao = Join-Path $Raiz 'publicacao'
$Publicador = Join-Path $Raiz 'scripts\Publicacao-Lan.ps1'
$Verificador = Join-Path $PSScriptRoot 'publicacao_revisao.py'
$Navegador = Join-Path $PSScriptRoot 'verificar-floresta.cjs'
$ArquivosFixos = @('config.json','network.json','Caddyfile','DaviApp.xml','DaviProxy.xml',
    'DaviApp.exe','DaviProxy.exe','bin/caddy.exe','caddy-data/pki/authorities/local/root.crt')

function Nativo([string]$Exe, [string[]]$Argumentos) {
    $saida = & $Exe @Argumentos
    if ($LASTEXITCODE -ne 0) { throw "$([IO.Path]::GetFileName($Exe)) falhou ($LASTEXITCODE)." }
    $saida
}

function Git-Instalado {
    Nativo 'git.exe' (@('-C',$Raiz,'--no-optional-locks') + $args)
}

function Diretorio-Local([string]$Caminho) {
    $item = Get-Item -LiteralPath $Caminho -Force
    if (!$item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "Esperado diretorio local: $Caminho"
    }
    $item.FullName
}

function Ler-Instalacao {
    $null = Diretorio-Local $Raiz
    $null = Diretorio-Local (Join-Path $Raiz 'dados')
    $null = Diretorio-Local $Publicacao
    foreach ($nome in 'DaviApp','DaviProxy') {
        $servico = Get-CimInstance Win32_Service -Filter "Name='$nome'"
        $exe = Join-Path $Publicacao "$nome.exe"
        if (!$servico -or $servico.PathName.Trim('"') -ne $exe) {
            throw "Caminho de servico inesperado: $nome."
        }
    }
    $dados = Get-Content -LiteralPath (Join-Path $Publicacao 'config.json') -Raw | ConvertFrom-Json
    $rede = Get-Content -LiteralPath (Join-Path $Publicacao 'network.json') -Raw | ConvertFrom-Json
    [xml]$xml = Get-Content -LiteralPath (Join-Path $Publicacao 'DaviApp.xml') -Raw
    if ($dados.DAVI_DATA_DIR -ne (Join-Path $Raiz 'dados') -or $dados.DAVI_HOST -ne '127.0.0.1' -or
        $dados.DAVI_PORT -ne '8765' -or $xml.service.workingdirectory -ne $Raiz -or
        $xml.service.arguments -ne ('-u "{0}\run_service.py" "{0}\publicacao\config.json"' -f $Raiz) -or
        $rede.port -ne 443 -or $rede.address -notmatch '^192\.168\.2\.[0-9]{1,3}$' -or
        $rede.origins -notcontains "https://$NomeHttps") {
        throw 'Configuracao instalada diverge do procedimento revisado.'
    }
    foreach ($arquivo in 'agenda.sqlite3','auth.sqlite3') {
        if (!(Test-Path -LiteralPath (Join-Path $dados.DAVI_DATA_DIR $arquivo) -PathType Leaf)) {
            throw "Banco esperado ausente: $arquivo."
        }
    }
    if (!(Test-Path -LiteralPath $xml.service.executable -PathType Leaf)) { throw 'Python do servico ausente.' }
    [pscustomobject]@{ Python = [string]$xml.service.executable; IP = [string]$rede.address }
}

function Checkout-Limpo {
    if ((Git-Instalado rev-parse --is-inside-work-tree) -ne 'true' -or
        (Git-Instalado remote get-url origin) -ne $Origem) { throw 'Checkout ou origem inesperados.' }
    if (@(Git-Instalado status --porcelain=v1 --untracked-files=no).Count) {
        throw 'Existem alteracoes rastreadas na instalacao.'
    }
    $sha = Git-Instalado rev-parse --verify HEAD
    if ($sha -cnotmatch '^[0-9a-f]{40}$') { throw 'HEAD instalado invalido.' }
    $sha
}

function Conferir-PrivadosForaDoGit([string]$Sha) {
    if (@(Git-Instalado ls-tree --name-only $Sha -- dados publicacao).Count) {
        throw 'A revisao contem caminhos privados versionados.'
    }
}

function Ler-CabecaPr {
    $linha = @(Git-Instalado ls-remote --exit-code origin $RefPiloto)
    if ($linha.Count -ne 1 -or $linha[0] -cne ("$ShaPiloto" + "`t" + $RefPiloto)) {
        throw 'A PR 19 diverge do SHA aprovado. Interrompa e revise.'
    }
    $ShaPiloto
}

function Ler-Build([string]$PastaPublicada) {
    $ca = Join-Path $PastaPublicada $ArquivosFixos[-1]
    $json = Nativo $Instalacao.Python @('-B',$Verificador,'https',$NomeHttps,$Instalacao.IP,'443',$ca)
    $json | ConvertFrom-Json
}

function Conferir-Build([string]$Esperado, [string]$PastaCA) {
    $build = Ler-Build $PastaCA
    if ($build.commit -cne $Esperado) { throw "HTTPS serviu $($build.commit); esperado $Esperado." }
    $build
}

function Conferir-Estado([string]$Estado) {
    foreach ($nome in 'DaviApp','DaviProxy') {
        if ((Get-Service -Name $nome).Status -ne $Estado) { throw "$nome fora do estado $Estado." }
    }
}

function Aguardar-Servicos([System.ServiceProcess.ServiceControllerStatus]$Estado) {
    $ordem = if ($Estado -eq 'Stopped') { 'DaviProxy','DaviApp' } else { 'DaviApp','DaviProxy' }
    foreach ($nome in $ordem) {
        $servico = Get-Service -Name $nome
        $servico.WaitForStatus($Estado, [TimeSpan]::FromSeconds(30))
    }
    Conferir-Estado $Estado
}

function Conferir-Parada {
    Conferir-Estado Stopped
    $ativos = @(Get-NetTCPConnection -State Listen | Where-Object {
        $_.LocalPort -eq 8765 -or ($_.LocalPort -eq 443 -and $_.LocalAddress -in @($Instalacao.IP,'0.0.0.0','::'))
    })
    if ($ativos.Count) { throw 'Ainda existe listener do aplicativo ou proxy. Investigue antes de continuar.' }
}

function Parar-Publicacao {
    & $Publicador -Acao Parar -Pasta $Publicacao -Aprovado -Confirm:$false | Out-Null
    Aguardar-Servicos Stopped
    Conferir-Parada
}

function Iniciar-E-Conferir([string]$Esperado, [string]$PastaCA) {
    & $Publicador -Acao Iniciar -Pasta $Publicacao -Aprovado -Confirm:$false | Out-Null
    Aguardar-Servicos Running
    $limite = [DateTime]::UtcNow.AddSeconds(30)
    do {
        $estado = Ler-Processos
        if ($estado.ListenerApp -and $estado.ListenerProxy) { break }
        Start-Sleep -Milliseconds 500
    } while ([DateTime]::UtcNow -lt $limite)
    if (!$estado.ListenerApp -or !$estado.ListenerProxy) {
        throw 'Listeners esperados indisponiveis apos Running.'
    }
    $build = Conferir-Build $Esperado $PastaCA
    Conferir-Estado Running
    $build
}

function Ler-Processos {
    $servicos = @(Get-CimInstance Win32_Service -Filter "Name='DaviApp' OR Name='DaviProxy'")
    $app = $servicos | Where-Object Name -eq DaviApp
    $proxy = $servicos | Where-Object Name -eq DaviProxy
    $escutas = @(Get-NetTCPConnection -State Listen -LocalPort 8765,443 -ErrorAction SilentlyContinue)
    $listeners = @($escutas | Where-Object {
        ($_.LocalPort -eq 8765 -and $_.LocalAddress -eq '127.0.0.1') -or
        ($_.LocalPort -eq 443 -and $_.LocalAddress -eq $Instalacao.IP)
    })
    $processos = foreach ($listener in $listeners) {
        $item = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
        if ($item) {
            [pscustomobject]@{
                Porta=$listener.LocalPort; Pid=$item.ProcessId; Pai=$item.ParentProcessId
                Inicio=$item.CreationDate; Nome=$item.Name
            }
        }
    }
    [pscustomobject]@{
        Utc=[DateTime]::UtcNow.ToString('o')
        Servicos=@($servicos | Select-Object Name, State, ProcessId)
        Portas=@($processos | Sort-Object Porta)
        ListenerApp=($app -and $app.State -eq 'Running' -and @($processos | Where-Object {
            $_.Porta -eq 8765 -and $_.Pai -eq $app.ProcessId -and $_.Nome -eq 'python.exe'
        }).Count -eq 1)
        ListenerProxy=($proxy -and $proxy.State -eq 'Running' -and @($processos | Where-Object {
            $_.Porta -eq 443 -and $_.Pai -eq $proxy.ProcessId -and $_.Nome -eq 'caddy.exe'
        }).Count -eq 1)
    }
}

function Executar-Sonda([string]$Exe, [string[]]$Argumentos, [string]$Relatorio) {
    $saida = & $Exe @Argumentos
    $codigo = $LASTEXITCODE
    $saida | Set-Content -LiteralPath $Relatorio -Encoding UTF8
    if ($codigo -ne 0) { throw "Sonda $([IO.Path]::GetFileName($Relatorio)) falhou ($codigo)." }
    $saida | ConvertFrom-Json
}

function Conferir-Estabilidade([string]$Sha, [string]$Copia) {
    $inicio = Ler-Processos
    $inicio | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $Copia 'processos-inicio.json') -Encoding UTF8
    if (!$inicio.ListenerApp -or !$inicio.ListenerProxy) { throw 'Listeners ausentes no inicio do ensaio.' }
    $ca = Join-Path (Join-Path $Copia 'publicacao') $ArquivosFixos[-1]
    $httpsArgs = @('-B',$Verificador,'stable',$NomeHttps,$Instalacao.IP,'443',$ca,$Sha)
    $browserArgs = @($Navegador,$NomeHttps,$Instalacao.IP,'443',$Sha,'3')
    $carga = Executar-Sonda $Instalacao.Python $httpsArgs (Join-Path $Copia 'estabilidade-https.json')
    $browser = Executar-Sonda 'node.exe' $browserArgs (Join-Path $Copia 'estabilidade-chromium.json')
    $fim = Ler-Processos
    $fim | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $Copia 'processos-fim.json') -Encoding UTF8
    if ($browser.commit -cne $Sha -or $browser.openings -ne 3 -or !$browser.agora -or
        $carga.seconds -lt 12 -or !$fim.ListenerApp -or !$fim.ListenerProxy -or
        (ConvertTo-Json -InputObject $inicio.Portas -Compress) -cne (ConvertTo-Json -InputObject $fim.Portas -Compress)) {
        throw 'Evidencia incompleta ou PID/listener alterado durante o ensaio.'
    }
    if (@(Ler-ErrosProxy ([DateTime]::Parse($inicio.Utc).ToUniversalTime())).Count) {
        throw 'O proxy registrou HTTP 502 durante o ensaio.'
    }
    Conferir-Build $Sha (Join-Path $Copia 'publicacao')
}

function Ler-ErrosProxy([DateTime]$Inicio) {
    foreach ($linha in (Get-Content -LiteralPath (Join-Path $Publicacao 'logs\DaviProxy.err.log') -Tail 500 -ErrorAction SilentlyContinue)) {
        try { $registro = $linha | ConvertFrom-Json } catch { continue }
        if ($registro.PSObject.Properties.Name -notcontains 'status' -or $registro.status -ne 502) { continue }
        $hora = [DateTimeOffset]::FromUnixTimeMilliseconds([long]($registro.ts * 1000))
        if ($hora.UtcDateTime -lt $Inicio) { continue }
        $rota = ($registro.request.uri -split '\?')[0]
        if ($rota -notin @('/','/app.js','/forest.js','/api/build','/api/me','/api/forest/map','/api/calendar') -and
            $rota -notmatch '^/(assets/forest|vendor/three)/[a-zA-Z0-9_./-]+\.(m?js|glb|webp|png|woff2)$') {
            $rota = '<outra-rota>'
        }
        [pscustomobject]@{
            Utc=$hora.UtcDateTime.ToString('o'); HTTP=502; Rota=$rota
            Erro=$(if ($registro.msg -match 'actively refused|connection refused') {'conexao upstream recusada'}
                   elseif ($registro.msg -match 'timeout|deadline exceeded') {'tempo limite upstream'}
                   else {'outra falha upstream'})
        }
    }
}

function Registrar-Falha([string]$Copia, [DateTime]$Inicio, [string]$Fase) {
    $estado = Ler-Processos
    $eventos = @(Ler-ErrosProxy $Inicio)
    [pscustomobject]@{ Fase=$Fase; Estado=$estado; Caddy=@($eventos) } |
        ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $Copia 'falha-publicacao.json') -Encoding UTF8
}

function Nova-CopiaPrivada {
    $pai = Diretorio-Local $RaizBackups
    $pasta = Join-Path $pai ('antes-etapa8c1-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N'))
    $acl = New-Object System.Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    $operador = [Security.Principal.WindowsIdentity]::GetCurrent().User
    foreach ($sid in @($operador.Value,'S-1-5-18','S-1-5-32-544') | Select-Object -Unique) {
        $id = New-Object System.Security.Principal.SecurityIdentifier($sid)
        $regra = New-Object System.Security.AccessControl.FileSystemAccessRule(
            $id, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        $acl.AddAccessRule($regra)
    }
    $null = [IO.Directory]::CreateDirectory($pasta, $acl)
    $pasta
}

function Hashes-Publicacao([string]$Base) {
    $hashes = [ordered]@{}
    foreach ($arquivo in $ArquivosFixos) {
        $hashes[$arquivo] = (Get-FileHash -LiteralPath (Join-Path $Base $arquivo) -Algorithm SHA256).Hash
    }
    $hashes
}

function Conferir-Configuracao($Esperada) {
    $atual = Hashes-Publicacao $Publicacao
    foreach ($chave in $ArquivosFixos) {
        if ($atual[$chave] -cne $Esperada.$chave) { throw "Arquivo publicado divergiu: $chave." }
    }
}

function Trocar-Checkout([string]$Sha) {
    Git-Instalado -c core.hooksPath=NUL switch --no-overwrite-ignore --no-recurse-submodules --detach $Sha | Out-Null
    if ((Checkout-Limpo) -cne $Sha) { throw 'Checkout efetivo diferente do solicitado.' }
}

function Voltar-Codigo([string]$Pasta, [string]$Atual) {
    $Pasta = Diretorio-Local $Pasta
    if ((Split-Path $Pasta) -ne (Diretorio-Local $RaizBackups) -or
        (Split-Path $Pasta -Leaf) -notmatch '^antes-etapa8c1-\d{8}-\d{6}-[0-9a-f]{32}$') {
        throw 'Pasta de recuperacao fora do local esperado.'
    }
    $registro = Get-Content -LiteralPath (Join-Path $Pasta 'recuperacao.json') -Raw | ConvertFrom-Json
    if ($registro.raiz -ne $Raiz -or $registro.piloto -cne $ShaPiloto -or
        $registro.anterior -cnotmatch '^[0-9a-f]{40}$' -or $registro.anterior -ceq $ShaPiloto -or
        $Atual -cnotin @($registro.anterior,$registro.piloto)) { throw 'Registro de recuperacao incompativel.' }
    Git-Instalado merge-base --is-ancestor $registro.anterior $ShaPiloto | Out-Null
    Conferir-PrivadosForaDoGit $registro.anterior
    Conferir-Configuracao $registro.configuracao
    Parar-Publicacao
    if ($Atual -cne $registro.anterior) { Trocar-Checkout $registro.anterior }
    $build = Iniciar-E-Conferir $registro.anterior $Publicacao
    Conferir-Configuracao $registro.configuracao
    Write-Output "Rollback de codigo verificado por HTTPS: $($build.version) $($build.commit)."
}

if ($Acao -ne 'Conferir') {
    if (!$Aprovado) { throw 'Alteracao bloqueada. Aguarde autorizacao expressa e informe -Aprovado.' }
    if (!$PSCmdlet.ShouldProcess($Raiz, $Acao)) { return }
    $operador = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (!$operador.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Abra Windows PowerShell como administrador.'
    }
}

$Instalacao = Ler-Instalacao
$Instalado = Checkout-Limpo
Conferir-PrivadosForaDoGit $Instalado

if ($Acao -eq 'Conferir') {
    Conferir-Estado Running
    $processos = Ler-Processos
    if (!$processos.ListenerApp -or !$processos.ListenerProxy) { throw 'Listeners da instalacao inesperados.' }
    $build = Conferir-Build $Instalado $Publicacao
    [pscustomobject]@{
        Checkout = $Instalado; ServidoHttps = $build.commit; Versao = $build.version
        Pr19 = Ler-CabecaPr; IP = $Instalacao.IP; Python = (Nativo $Instalacao.Python @('--version'))
        DaviApp = (Get-Service -Name DaviApp).Status
        DaviProxy = (Get-Service -Name DaviProxy).Status
        Listeners = $processos.Portas
    }
    return
}

if ($Acao -eq 'Publicar') {
    if ($Instalado -ceq $ShaPiloto) { throw 'A revisao ja esta no checkout. Use Conferir.' }
    Conferir-Estado Running
    Nativo 'node.exe' @($Navegador,'--check') | Out-Null
    $null = Conferir-Build $Instalado $Publicacao
    $null = Ler-CabecaPr
    Git-Instalado fetch --no-tags --no-recurse-submodules origin $RefPiloto | Out-Null
    if ((Git-Instalado rev-parse --verify 'FETCH_HEAD^{commit}') -cne $ShaPiloto) {
        throw 'O SHA recebido diverge da aprovacao.'
    }
    Git-Instalado merge-base --is-ancestor $Instalado $ShaPiloto | Out-Null
    Conferir-PrivadosForaDoGit $ShaPiloto
    $Copia = Nova-CopiaPrivada
    $registro = [pscustomobject]@{
        raiz = $Raiz; anterior = $Instalado; piloto = $ShaPiloto; configuracao = (Hashes-Publicacao $Publicacao)
    }
    $registro | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $Copia 'recuperacao.json') -Encoding UTF8
    Write-Host "Pasta privada para recuperacao: $Copia"
    $inicio = [DateTime]::UtcNow
    try {
        $fase = 'parada e backup'
        Parar-Publicacao
        Nativo $Instalacao.Python @('-B',$Verificador,'snapshot',$Raiz,$Copia) | Out-Null
        Conferir-Parada
        'Agenda, autenticacao e publicacao verificadas' |
            Set-Content -LiteralPath (Join-Path $Copia 'backup-validado.txt') -Encoding Ascii
        if ((Checkout-Limpo) -cne $Instalado) { throw 'HEAD mudou durante a copia.' }
        $fase = 'checkout e inicio'
        Trocar-Checkout $ShaPiloto
        $null = Iniciar-E-Conferir $ShaPiloto (Join-Path $Copia 'publicacao')
        $fase = 'estabilidade'
        $build = Conferir-Estabilidade $ShaPiloto $Copia
        Conferir-Configuracao $registro.configuracao
        Write-Output "Publicacao verificada por HTTPS e Chromium: $($build.version) $($build.commit). Backup: $Copia"
    } catch {
        $falha = $_
        try { Registrar-Falha $Copia $inicio $fase }
        catch { Write-Warning 'Falha ao gravar o diagnostico. O rollback ainda sera tentado.' }
        Write-Warning "Publicacao sem verificacao completa. Tentando rollback do codigo com $Copia."
        Voltar-Codigo $Copia (Checkout-Limpo)
        throw $falha
    }
    return
}

if (!$Copia) { throw 'Informe -Copia com a pasta de recuperacao da publicacao.' }
Voltar-Codigo $Copia $Instalado
