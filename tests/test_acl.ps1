# ACLs reais somente em árvore temporária criada por este teste. Sem serviços/SQLite real.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Import-Module (Join-Path (Split-Path $PSScriptRoot) 'scripts/Acl-Lan.psm1') -Force -DisableNameChecking
$taskRoot = [IO.Path]::GetFullPath((Join-Path $env:TEMP ('davi-acl-synthetic-' + [guid]::NewGuid())))
$tempPrefix = [IO.Path]::GetFullPath($env:TEMP).TrimEnd('\') + '\'
if (!$taskRoot.StartsWith($tempPrefix,[StringComparison]::OrdinalIgnoreCase)) { throw 'Destino de teste fora do TEMP.' }
$project = Join-Path $taskRoot 'project'
$publication = Join-Path $project 'publicacao'
$data = Join-Path $project 'dados'
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$sections = [Security.AccessControl.AccessControlSections]'Access,Owner,Group'
function Descriptor([string]$Path) { (Get-Acl -LiteralPath $Path).GetSecurityDescriptorSddlForm($sections) }
function Assert-Original {
    foreach ($pair in $script:before.GetEnumerator()) {
        if ((Descriptor $pair.Key) -ne $pair.Value) { throw 'ACL original não foi restaurada integralmente.' }
    }
}
function Assert-Rights([string]$Path,[string]$Identity,[string]$Expected) {
    $acl = Get-Acl -LiteralPath $Path
    $rules = @($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]) | Where-Object { $_.IdentityReference.Value -eq $Identity })
    if ($rules.Count -ne 1 -or $rules[0].AccessControlType -ne 'Allow' -or [int]$rules[0].FileSystemRights -ne ([int][Security.AccessControl.FileSystemRights]$Expected -bor [int][Security.AccessControl.FileSystemRights]::Synchronize)) { throw "Privilégio inesperado: $Expected" }
}
try {
    foreach ($p in @($project,$data,$publication,(Join-Path $data 'backups'),(Join-Path $publication 'logs'),(Join-Path $publication 'caddy-data'),(Join-Path $publication 'bin'))) {
        New-Item -ItemType Directory -Path $p -Force | Out-Null
    }
    $files = @((Join-Path $project 'server.py'),(Join-Path $data 'agenda.sqlite3'),(Join-Path $data 'auth.sqlite3'),(Join-Path $data 'backups/synthetic.txt'),(Join-Path $publication 'config.json'),(Join-Path $publication 'bin/caddy.exe'),(Join-Path $publication 'logs/synthetic.log'),(Join-Path $publication 'caddy-data/synthetic.txt'))
    foreach ($file in $files) { [IO.File]::WriteAllText($file,'SYNTHETIC ACL FIXTURE - not a database or executable') }
    # O TEMP deste Windows pode herdar escrita ampla; a fixture do código começa restrita.
    $initial = New-Object Security.AccessControl.DirectorySecurity
    $initial.SetAccessRuleProtection($true,$false)
    foreach ($identity in @('S-1-5-32-544','S-1-5-18',$sid) | Select-Object -Unique) {
        $initial.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier($identity)),'FullControl','ContainerInherit,ObjectInherit','None','Allow')))
    }
    $initial.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier('S-1-5-32-545')),'ReadAndExecute','ContainerInherit,ObjectInherit','None','Allow')))
    $acl = Get-Acl -LiteralPath $project
    $acl.SetSecurityDescriptorSddlForm($initial.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access),[Security.AccessControl.AccessControlSections]::Access)
    Set-Acl -LiteralPath $project -AclObject $acl
    # ACE prévia e herança para verificar perda/restituição; não dá acesso a dados reais.
    $acl = Get-Acl -LiteralPath $data
    $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier('S-1-5-32-545')),'ReadAndExecute','ContainerInherit,ObjectInherit','None','Allow')))
    Set-Acl -LiteralPath $data -AclObject $acl
    $deniedFile = Join-Path $publication 'config.json'
    $acl = Get-Acl -LiteralPath $deniedFile
    $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier('S-1-5-32-546')),'Write','Deny')))
    Set-Acl -LiteralPath $deniedFile -AclObject $acl
    $script:before = @{}
    @(Get-Item -LiteralPath $project) + @(Get-ChildItem -LiteralPath $project -Recurse -Force) | ForEach-Object { $script:before[$_.FullName] = Descriptor $_.FullName }
    # Falha de preflight: não sobrescrever snapshot nem modificar qualquer alvo.
    $existing = Join-Path $taskRoot 'snapshots/existing'
    New-Item -ItemType Directory -Path $existing -Force | Out-Null
    $blocked = $false
    try { Set-DaviPermissions $project $publication (Join-Path $existing 'snapshot.acl.json') $sid } catch { $blocked = $true }
    if (!$blocked) { throw 'Destino existente de snapshot foi aceito.' }
    Assert-Original
    $snapshot = Join-Path $taskRoot 'snapshots/success/snapshot.acl.json'
    $result = Set-DaviPermissions -ProjectRoot $project -PublicationRoot $publication -SnapshotPath $snapshot -MaintenanceSid $sid
    if ($result.Result -ne 'AppliedAndVerified' -or !(Test-Path -LiteralPath $snapshot)) { throw 'Aplicação/snapshot não verificáveis.' }
    foreach ($path in @($data,(Join-Path $data 'agenda.sqlite3'),(Join-Path $data 'auth.sqlite3'),(Join-Path $data 'backups/synthetic.txt'),(Join-Path $publication 'logs/synthetic.log'),(Join-Path $publication 'caddy-data/synthetic.txt'))) {
        Assert-Rights $path 'S-1-5-19' 'Modify'
    }
    foreach ($path in @((Join-Path $publication 'config.json'),(Join-Path $publication 'bin/caddy.exe'),(Join-Path $project 'server.py'))) { Assert-Rights $path 'S-1-5-19' 'ReadAndExecute' }
    Assert-Rights (Join-Path $data 'agenda.sqlite3') $sid 'Modify'
    Assert-Rights (Join-Path $publication 'config.json') $sid 'ReadAndExecute'
    foreach ($root in @($data,$publication)) {
        foreach ($item in (@(Get-Item -LiteralPath $root) + @(Get-ChildItem -LiteralPath $root -Recurse -Force))) {
            Assert-Rights $item.FullName 'S-1-5-32-544' 'FullControl'
            Assert-Rights $item.FullName 'S-1-5-18' 'FullControl'
            $acl = Get-Acl -LiteralPath $item.FullName
            if (!$acl.AreAccessRulesProtected) { throw 'Herança não foi protegida.' }
            foreach ($ace in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])) {
                if ($ace.IdentityReference.Value -notin @('S-1-5-18','S-1-5-19','S-1-5-32-544',$sid)) { throw 'Acesso amplo indevido nos dados/publicação.' }
            }
        }
    }
    # A conta de manutenção atual realmente consegue ler/escrever o arquivo sintético.
    [IO.File]::AppendAllText((Join-Path $data 'agenda.sqlite3'),' maintenance access confirmed')
    if (![IO.File]::ReadAllText((Join-Path $data 'agenda.sqlite3')).Contains('maintenance access confirmed')) { throw 'Conta de manutenção perdeu acesso.' }
    # Arquivo futuro/sidecar herda direitos mínimos da pasta protegida.
    $sidecar = Join-Path $data 'synthetic-sidecar.tmp'
    [IO.File]::WriteAllText($sidecar,'synthetic future file')
    Assert-Rights $sidecar 'S-1-5-19' 'Modify'
    Assert-Rights $sidecar $sid 'Modify'
    Remove-Item -LiteralPath $sidecar
    $applied = @{}
    foreach ($path in $script:before.Keys) { $applied[$path] = Descriptor $path }
    $envelope = Get-Content -LiteralPath $snapshot -Raw | ConvertFrom-Json
    $envelope.Sha256 = '0' * 64
    $corrupt = Join-Path (Split-Path $snapshot) 'corrupt.acl.json'
    [IO.File]::WriteAllText($corrupt,($envelope | ConvertTo-Json))
    $rejected = $false
    try { Restore-DaviAcl $project $publication $corrupt } catch { $rejected = $true }
    if (!$rejected) { throw 'Snapshot corrompido aceito.' }
    foreach ($path in $applied.Keys) { if ((Descriptor $path) -ne $applied[$path]) { throw 'Snapshot inválido modificou ACL.' } }
    # Mesmo com checksum recalculado, um registro fora do escopo é recusado antes de alterar ACL.
    $envelope = Get-Content -LiteralPath $snapshot -Raw | ConvertFrom-Json
    $payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($envelope.PayloadBase64)) | ConvertFrom-Json
    $outside = Join-Path $taskRoot 'outside.txt'
    [IO.File]::WriteAllText($outside,'synthetic outside scope')
    $outsideAcl = Descriptor $outside
    $payload.Records[1].Path = $outside
    $payload.Records[1].Directory = $false
    $bytes = [Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Depth 8 -Compress))
    $envelope.PayloadBase64 = [Convert]::ToBase64String($bytes)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $envelope.Sha256 = [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','').ToLowerInvariant() } finally { $sha.Dispose() }
    $outOfScope = Join-Path (Split-Path $snapshot) 'out-of-scope.acl.json'
    [IO.File]::WriteAllText($outOfScope,($envelope | ConvertTo-Json))
    $rejected = $false
    try { Restore-DaviAcl $project $publication $outOfScope } catch { $rejected = $true }
    if (!$rejected -or (Descriptor $outside) -ne $outsideAcl) { throw 'Escopo inválido não foi bloqueado.' }
    foreach ($path in $applied.Keys) { if ((Descriptor $path) -ne $applied[$path]) { throw 'Snapshot fora de escopo modificou ACL.' } }
    $restored = Restore-DaviAcl $project $publication $snapshot
    if ($restored.Result -ne 'RestoredAndVerified') { throw 'Rollback não foi verificado.' }
    Assert-Original
    # Falha após alterações reais: o callback não substitui Set-Acl/Get-Acl.
    $partialSnapshot = Join-Path $taskRoot 'snapshots/partial/snapshot.acl.json'
    $failed = $false
    try {
        Set-DaviPermissions -ProjectRoot $project -PublicationRoot $publication -SnapshotPath $partialSnapshot -MaintenanceSid $sid -AfterApply {
            param($count,$verifiedSnapshot)
            if (!(Test-Path -LiteralPath $verifiedSnapshot)) { throw 'Snapshot não existia antes da mudança.' }
            if ($count -eq 4) { throw 'INJECTED PARTIAL FAILURE' }
        }
    } catch { $failed = $_.Exception.Message -match 'rollback verificado' -and $_.Exception.Message -match 'INJECTED PARTIAL FAILURE' }
    if (!$failed) { throw 'Falha parcial não foi revertida/verificada.' }
    Assert-Original
    if (!(Test-Path -LiteralPath $partialSnapshot)) { throw 'Snapshot foi removido após falha.' }
    $refused = $false
    try { Set-DaviPermissions $project $publication (Join-Path $taskRoot 'snapshots/broad/snapshot.acl.json') 'S-1-1-0' } catch { $refused = $true }
    if (!$refused) { throw 'Conta ampla aceita para manutenção.' }
    Assert-Original
    # Código já gravável por grupo amplo deve bloquear, sem tentar corrigir silenciosamente.
    $code = Join-Path $project 'server.py'
    $codeAcl = Get-Acl -LiteralPath $code
    $codeAcl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier('S-1-5-11')),'Write','Allow')))
    Set-Acl -LiteralPath $code -AclObject $codeAcl
    $weakCodeAcl = Descriptor $code
    $rejected = $false
    try { Set-DaviPermissions $project $publication (Join-Path $taskRoot 'snapshots/weak-code/snapshot.acl.json') $sid } catch { $rejected = $_.Exception.Message -match 'escrita preexistente' }
    if (!$rejected -or (Descriptor $code) -ne $weakCodeAcl) { throw 'Código gravável não foi bloqueado sem mutação.' }
    $codeAcl = Get-Acl -LiteralPath $code
    $codeAcl.SetSecurityDescriptorSddlForm($script:before[$code], [Security.AccessControl.AccessControlSections]::Access)
    Set-Acl -LiteralPath $code -AclObject $codeAcl
    Assert-Original
    # Junction sintética: recusar antes de enumerar conteúdo ou alterar alvos.
    $outsideDir = Join-Path $taskRoot 'outside-directory'
    New-Item -ItemType Directory -Path $outsideDir | Out-Null
    $junction = Join-Path $data 'synthetic-junction'
    New-Item -ItemType Junction -Path $junction -Target $outsideDir | Out-Null
    $rejected = $false
    try { Set-DaviPermissions $project $publication (Join-Path $taskRoot 'snapshots/junction/snapshot.acl.json') $sid } catch { $rejected = $true }
    if (!$rejected) { throw 'Junction foi aceita.' }
    if (!$junction.StartsWith($taskRoot + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Limpeza de junction fora do teste.' }
    Remove-Item -LiteralPath $junction -Force
    Assert-Original
    Write-Output 'PASS: ACL real em TEMP; snapshot SHA256; manutenção; menor privilégio; rollback SDDL/herança/owner/group; corrupção/escopo/junction rejeitados; falha parcial revertida; conta ampla rejeitada; herança de arquivo futuro verificada.'
} finally {
    # Alvo absoluto verificado antes de qualquer remoção recursiva.
    if ($taskRoot.StartsWith($tempPrefix,[StringComparison]::OrdinalIgnoreCase) -and (Split-Path $taskRoot -Leaf) -like 'davi-acl-synthetic-*') {
        Remove-Item -LiteralPath $taskRoot -Recurse -Force -ErrorAction Stop
    } else { throw 'Limpeza recusada: destino fora da árvore temporária de teste.' }
}
