# Validação sem privilégios: AST, bloqueios e ordem do reinício com executor substituído.
$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path (Split-Path $PSScriptRoot) 'scripts/Publicacao-Lan.ps1'
$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($scriptPath, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw ($errors | Out-String) }
$functions = $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] }, $true)
foreach ($name in @('Operar-Servico','Reiniciar-Servicos','Ler-Rede','Adicionar-RegraFirewall')) {
    $definition = $functions | Where-Object Name -eq $name
    Invoke-Expression $definition.Extent.Text
}
$script:chamadas = New-Object 'System.Collections.Generic.List[string]'
$Pasta = Join-Path $env:TEMP ('davi-service-test-' + [guid]::NewGuid())
function Executar-Nativo([string]$Exe, [string[]]$Argumentos) {
    $script:chamadas.Add(([IO.Path]::GetFileName($Exe) + ':' + ($Argumentos -join ',')))
}
Reiniciar-Servicos
$esperado = 'DaviProxy.exe:stopwait|DaviApp.exe:restart|DaviProxy.exe:start'
if (($script:chamadas -join '|') -ne $esperado) { throw 'Ordem incorreta de reinício.' }
$bloqueado = $false
try { & $scriptPath -Acao Reiniciar -Pasta $Pasta -Confirm:$false }
catch { $bloqueado = $_.Exception.Message -match 'Alteração bloqueada' }
if (!$bloqueado) { throw 'A operação sem aprovação não foi bloqueada.' }
# WhatIf deve encerrar antes de verificar admin, ler arquivos ou invocar o Windows.
& $scriptPath -Acao FirewallAdicionar -Pasta $Pasta -Aprovado -WhatIf
& $scriptPath -Acao Instalar -Pasta $Pasta -Aprovado -WhatIf
if ($script:chamadas.Count -ne 3) { throw 'WhatIf executou mutações.' }
# Valida os argumentos reais da regra, substituindo somente as APIs Windows.
function Get-NetFirewallRule { [CmdletBinding()]param([string]$Name) }
function New-NetFirewallRule {
    param($Name,$DisplayName,$Direction,$Action,$Enabled,$Protocol,$LocalPort,$LocalAddress,$RemoteAddress,$Profile,$Program,$EdgeTraversalPolicy)
    $script:regraCapturada = $PSBoundParameters
}
$regra = 'Davi-LAN-HTTPS-v04'
$script:redeTeste = [pscustomobject]@{ address='192.168.2.10';port=8443;subnet='192.168.2.0/24' }
function Get-Content { [CmdletBinding()]param($LiteralPath,[switch]$Raw) return ($script:redeTeste | ConvertTo-Json) }
Adicionar-RegraFirewall
foreach ($par in @{ RemoteAddress='192.168.2.0/24'; LocalAddress='192.168.2.10'; LocalPort=8443; Profile='Any'; Protocol='TCP'; EdgeTraversalPolicy='Block'; Direction='Inbound'; Action='Allow' }.GetEnumerator()) {
    if ($script:regraCapturada[$par.Key] -ne $par.Value) { throw "Regra incorreta: $($par.Key)" }
}
$script:redeTeste.subnet = '0.0.0.0/0'
$redeBloqueada = $false
try { Adicionar-RegraFirewall } catch { $redeBloqueada = $true }
if (!$redeBloqueada) { throw 'Sub-rede pública foi aceita.' }
Write-Output 'PASS: sintaxe PowerShell, reinício simulado, bloqueio sem aprovação e WhatIf sem mutações, firewall restrito em qualquer perfil e rede pública rejeitada.'
