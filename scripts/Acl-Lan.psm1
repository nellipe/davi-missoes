Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:Sections = [Security.AccessControl.AccessControlSections]'Access,Owner,Group'

function Caminho-Completo([string]$Path) {
    $full = [IO.Path]::GetFullPath($Path).TrimEnd('\')
    if ($full -eq [IO.Path]::GetPathRoot($full).TrimEnd('\')) { throw 'Raiz de unidade não é um alvo de ACL permitido.' }
    $full
}
function Dentro([string]$Path, [string]$Root) {
    $Path.Equals($Root, [StringComparison]::OrdinalIgnoreCase) -or $Path.StartsWith($Root + '\', [StringComparison]::OrdinalIgnoreCase)
}
function Sem-Link([string]$Path) {
    $atual = $Path
    while ($atual) {
        if ((Test-Path -LiteralPath $atual) -and ((Get-Item -LiteralPath $atual -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'Links/reparse points não são permitidos no caminho de ACL.'
        }
        $atual = Split-Path -Path $atual -Parent
    }
}
function Raizes([string]$ProjectRoot, [string]$PublicationRoot) {
    $project = Caminho-Completo $ProjectRoot
    $publication = Caminho-Completo $PublicationRoot
    $data = Join-Path $project 'dados'
    if ($publication -eq $project -or !(Dentro $publication $project) -or (Dentro $publication $data) -or (Dentro $data $publication)) {
        throw 'Publicação deve ser subpasta do projeto, separada de dados.'
    }
    foreach ($p in @($project,$publication,$data)) {
        Sem-Link $p
        if (!(Test-Path -LiteralPath $p -PathType Container)) { throw 'Pasta de ACL ausente.' }
    }
    [pscustomobject]@{ Project=$project; Publication=$publication; Data=$data }
}
function Escopo-Valido([string]$Path, $Roots) {
    (Dentro $Path $Roots.Data) -or (Dentro $Path $Roots.Publication) -or $Path -eq $Roots.Project -or
        ((Split-Path $Path -Parent) -eq $Roots.Project -and [IO.Path]::GetExtension($Path) -in @('.py','.html','.css','.js'))
}
function Sddl([string]$Path) {
    (Get-Acl -LiteralPath $Path).GetSecurityDescriptorSddlForm($script:Sections)
}
function Politica-Sddl([string]$Value) {
    # Windows pode acrescentar AI ao persistir: é metadado de propagação, não uma ACE.
    $descriptor = New-Object Security.AccessControl.RawSecurityDescriptor($Value)
    $flags = $descriptor.ControlFlags -band (-bnot [int][Security.AccessControl.ControlFlags]::DiscretionaryAclAutoInherited)
    $descriptor.SetFlags([Security.AccessControl.ControlFlags]$flags)
    $descriptor.GetSddlForm($script:Sections)
}
function Hash-Bytes([byte[]]$Bytes) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { [BitConverter]::ToString($sha.ComputeHash($Bytes)).Replace('-','').ToLowerInvariant() }
    finally { $sha.Dispose() }
}
function Regra($Acl, [string]$Sid, [string]$Rights, [bool]$Directory) {
    $inherit = if ($Directory) { 'ContainerInherit,ObjectInherit' } else { 'None' }
    $identity = New-Object Security.Principal.SecurityIdentifier($Sid)
    $rule = New-Object Security.AccessControl.FileSystemAccessRule($identity,$Rights,$inherit,'None','Allow')
    $Acl.AddAccessRule($rule)
}
function Conferir-LeituraServico([string]$Path) {
    # Não ampliar nem mascarar acesso de escrita preexistente por grupos comuns do serviço.
    $commonServiceSids = @('S-1-1-0','S-1-2-0','S-1-5-11','S-1-5-6','S-1-5-32-545','S-1-5-19')
    $write = [int][Security.AccessControl.FileSystemRights]::Write -bor [int][Security.AccessControl.FileSystemRights]::Delete -bor [int][Security.AccessControl.FileSystemRights]::ChangePermissions -bor [int][Security.AccessControl.FileSystemRights]::TakeOwnership -bor [int][Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles
    foreach ($rule in (Get-Acl -LiteralPath $Path).GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])) {
        if ($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -in $commonServiceSids -and ([int]$rule.FileSystemRights -band $write)) {
            throw 'Código com escrita preexistente para LocalService/grupo amplo. Revisar ACL antes de publicar; nenhum alvo alterado.'
        }
    }
}
function Conta-Manutencao([string]$MaintenanceSid) {
    if ($MaintenanceSid -notmatch '^S-1-5-21-\d+-\d+-\d+-\d+$') { throw 'Informe o SID de uma conta local de manutenção, não um grupo amplo ou conta de serviço.' }
    $sid = New-Object Security.Principal.SecurityIdentifier($MaintenanceSid)
    $user = Get-LocalUser -SID $sid -ErrorAction Stop
    if (!$user -or !$user.Enabled) { throw 'Conta local de manutenção ausente ou desabilitada.' }
    $sid.Value
}
function Ler-Snapshot([string]$SnapshotPath, $Roots) {
    Sem-Link $SnapshotPath
    $envelope = [IO.File]::ReadAllText($SnapshotPath) | ConvertFrom-Json
    $bytes = [Convert]::FromBase64String($envelope.PayloadBase64)
    if ((Hash-Bytes $bytes) -ne $envelope.Sha256) { throw 'Checksum do snapshot ACL inválido. Nada será alterado.' }
    $snapshot = [Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json
    if ($snapshot.Version -ne 1 -or $snapshot.Project -ne $Roots.Project -or $snapshot.Publication -ne $Roots.Publication -or @($snapshot.Records).Count -lt 3) {
        throw 'Snapshot não pertence a este projeto/publicação.'
    }
    $seen = @{}
    foreach ($record in $snapshot.Records) {
        $path = Caminho-Completo $record.Path
        if ($path -ne $record.Path -or !(Escopo-Valido $path $Roots) -or $seen.ContainsKey($path)) { throw 'Caminho inválido/duplicado no snapshot ACL.' }
        $seen[$path] = $true
        Sem-Link $path
        $item = Get-Item -LiteralPath $path -Force
        if ([bool]$record.Directory -ne [bool]$item.PSIsContainer) { throw 'Tipo de item mudou desde o snapshot ACL.' }
        $check = if ($record.Directory) { New-Object Security.AccessControl.DirectorySecurity } else { New-Object Security.AccessControl.FileSecurity }
        $check.SetSecurityDescriptorSddlForm($record.Sddl, $script:Sections)
    }
    foreach ($path in @($Roots.Project,$Roots.Data,$Roots.Publication)) {
        if (!$seen.ContainsKey($path)) { throw 'Snapshot incompleto: raiz ausente.' }
    }
    $snapshot
}
function Restore-DaviAcl {
    param([Parameter(Mandatory)][string]$ProjectRoot, [Parameter(Mandatory)][string]$PublicationRoot,
          [Parameter(Mandatory)][string]$SnapshotPath)
    $roots = Raizes $ProjectRoot $PublicationRoot
    $snapshot = Ler-Snapshot (Caminho-Completo $SnapshotPath) $roots
    $failures = New-Object 'System.Collections.Generic.List[string]'
    # Pais antes dos filhos: a propagação de herança não sobrescreve filhos já restaurados.
    foreach ($record in ($snapshot.Records | Sort-Object { $_.Path.Length },Path)) {
        try {
            $acl = Get-Acl -LiteralPath $record.Path
            $acl.SetSecurityDescriptorSddlForm($record.Sddl, [Security.AccessControl.AccessControlSections]::Access)
            Set-Acl -LiteralPath $record.Path -AclObject $acl
        } catch { $failures.Add($record.Path) }
    }
    foreach ($record in $snapshot.Records) {
        try { if ((Sddl $record.Path) -ne $record.Sddl) { $failures.Add($record.Path) } }
        catch { $failures.Add($record.Path) }
    }
    if ($failures.Count) { throw 'Rollback ACL incompleto. Preserve o snapshot e faça recuperação administrativa antes de iniciar serviços.' }
    [pscustomobject]@{ Result='RestoredAndVerified'; Items=@($snapshot.Records).Count }
}
function Set-DaviPermissions {
    param([Parameter(Mandatory)][string]$ProjectRoot, [Parameter(Mandatory)][string]$PublicationRoot,
          [Parameter(Mandatory)][string]$SnapshotPath, [Parameter(Mandatory)][string]$MaintenanceSid,
          [scriptblock]$AfterApply, [string[]]$OnlyPaths)
    $roots = Raizes $ProjectRoot $PublicationRoot
    $sid = Conta-Manutencao $MaintenanceSid
    $snapshotFile = Caminho-Completo $SnapshotPath
    $snapshotDir = Split-Path $snapshotFile -Parent
    Sem-Link $snapshotFile
    if ((Dentro $snapshotFile $roots.Data) -or (Dentro $snapshotFile $roots.Publication) -or (Test-Path -LiteralPath $snapshotDir)) {
        throw 'Use um diretório NOVO de snapshot, fora de dados e publicação.'
    }
    # Enumeração sem -Recurse: rejeita junction antes de entrar em seus filhos.
    $items = New-Object 'System.Collections.Generic.List[object]'
    $items.Add((Get-Item -LiteralPath $roots.Project -Force))
    Get-ChildItem -LiteralPath $roots.Project -File -Force | Where-Object Extension -in @('.py','.html','.css','.js') | ForEach-Object { $items.Add($_) }
    $queue = New-Object 'System.Collections.Generic.Queue[string]'
    $queue.Enqueue($roots.Data); $queue.Enqueue($roots.Publication)
    while ($queue.Count) {
        $path = $queue.Dequeue()
        $item = Get-Item -LiteralPath $path -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse point encontrado antes de salvar/aplicar ACL.' }
        $items.Add($item)
        if ($item.PSIsContainer) {
            foreach ($child in (Get-ChildItem -LiteralPath $path -Force)) { $queue.Enqueue($child.FullName) }
        }
    }
    foreach ($item in $items) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse point de código não é permitido.' }
        if (!(Dentro $item.FullName $roots.Data) -and !(Dentro $item.FullName $roots.Publication)) { Conferir-LeituraServico $item.FullName }
    }
    $records = @($items | ForEach-Object { [pscustomobject]@{ Path=$_.FullName; Directory=[bool]$_.PSIsContainer; Sddl=(Sddl $_.FullName) } })
    if ($OnlyPaths) {
        $OnlyPaths = @($OnlyPaths | ForEach-Object { Caminho-Completo $_ })
        foreach ($target in $OnlyPaths) {
            if ($target -notin $records.Path) { throw 'Alvo fora do escopo de permissões.' }
        }
        # Inclui descendentes no rollback: ACEs de pasta propagam e cobrem arquivos futuros.
        $records = @($records | Where-Object {
            $recordPath = $_.Path
            $selected = $recordPath -in @($roots.Project,$roots.Data,$roots.Publication)
            foreach ($target in $OnlyPaths) { if (Dentro $recordPath $target) { $selected = $true } }
            $selected
        })
    }
    $trustedOwners = @($sid,'S-1-5-32-544','S-1-5-18','S-1-5-19',[Security.Principal.WindowsIdentity]::GetCurrent().User.Value)
    foreach ($record in $records) {
        if ((Dentro $record.Path $roots.Data) -or (Dentro $record.Path $roots.Publication)) {
            $descriptor = New-Object Security.AccessControl.RawSecurityDescriptor($record.Sddl)
            if ($descriptor.Owner.Value -notin $trustedOwners) { throw 'Proprietário de dados/publicação fora das identidades confiáveis. Revisar a conta de manutenção antes de aplicar ACL.' }
        }
    }
    $payload = [ordered]@{ Version=1; Project=$roots.Project; Publication=$roots.Publication; MaintenanceSid=$sid; Records=$records }
    $bytes = [Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Depth 8 -Compress))
    $envelope = @{ PayloadBase64=[Convert]::ToBase64String($bytes); Sha256=(Hash-Bytes $bytes) } | ConvertTo-Json
    New-Item -ItemType Directory -Path $snapshotDir -ErrorAction Stop | Out-Null
    # Snapshot privado: operador que o criou + administradores/SYSTEM. Não muda ACL dos alvos.
    $privateAcl = New-Object Security.AccessControl.DirectorySecurity
    $privateAcl.SetAccessRuleProtection($true,$false)
    foreach ($identity in @('S-1-5-32-544','S-1-5-18',[Security.Principal.WindowsIdentity]::GetCurrent().User.Value) | Select-Object -Unique) {
        Regra $privateAcl $identity 'FullControl' $true
    }
    Set-Acl -LiteralPath $snapshotDir -AclObject $privateAcl
    $stream = New-Object IO.FileStream($snapshotFile,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try { $encoded=[Text.Encoding]::UTF8.GetBytes($envelope); $stream.Write($encoded,0,$encoded.Length); $stream.Flush($true) }
    finally { $stream.Dispose() }
    $verified = Ler-Snapshot $snapshotFile $roots
    foreach ($record in $verified.Records) {
        if ((Sddl $record.Path) -ne $record.Sddl) { throw 'ACL mudou durante o snapshot. Nada aplicado; repita em janela sem escrita.' }
    }
    try {
        $count = 0
        foreach ($record in ($verified.Records | Sort-Object { $_.Path.Length },Path)) {
            if ($OnlyPaths -and $record.Path -notin $OnlyPaths) { continue }
            $acl = Get-Acl -LiteralPath $record.Path
            if ($OnlyPaths) {
                $writeNeeded = (Dentro $record.Path $roots.Data) -or (Dentro $record.Path (Join-Path $roots.Publication 'logs')) -or (Dentro $record.Path (Join-Path $roots.Publication 'caddy-data'))
                $rights = if ($writeNeeded) { 'Modify' } else { 'ReadAndExecute' }
                # Preserva ACEs, proprietário e herança; pasta cobre arquivos futuros.
                Regra $acl 'S-1-5-19' $rights ($record.Directory -and $record.Path -ne $roots.Project)
            } elseif ((Dentro $record.Path $roots.Data) -or (Dentro $record.Path $roots.Publication)) {
                $newAcl = if ($record.Directory) { New-Object Security.AccessControl.DirectorySecurity } else { New-Object Security.AccessControl.FileSecurity }
                $newAcl.SetAccessRuleProtection($true,$false)
                Regra $newAcl 'S-1-5-32-544' 'FullControl' $record.Directory
                Regra $newAcl 'S-1-5-18' 'FullControl' $record.Directory
                $serviceWrite = (Dentro $record.Path $roots.Data) -or (Dentro $record.Path (Join-Path $roots.Publication 'logs')) -or (Dentro $record.Path (Join-Path $roots.Publication 'caddy-data'))
                $serviceRights = if ($serviceWrite) { 'Modify' } else { 'ReadAndExecute' }
                $maintenanceRights = if (Dentro $record.Path $roots.Data) { 'Modify' } else { 'ReadAndExecute' }
                Regra $newAcl 'S-1-5-19' $serviceRights $record.Directory
                Regra $newAcl $sid $maintenanceRights $record.Directory
                $acl.SetSecurityDescriptorSddlForm($newAcl.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access), [Security.AccessControl.AccessControlSections]::Access)
            } else {
                # Código: preserva ACEs prévias, acrescenta leitura sem propagação.
                Regra $acl 'S-1-5-19' 'ReadAndExecute' $false
            }
            Set-Acl -LiteralPath $record.Path -AclObject $acl
            $expected = $acl.GetSecurityDescriptorSddlForm($script:Sections)
            if ((Politica-Sddl (Sddl $record.Path)) -ne (Politica-Sddl $expected)) { throw 'Verificação da ACL aplicada falhou.' }
            $count++
            if ($AfterApply) { & $AfterApply $count $snapshotFile }
        }
    } catch {
        $original = $_
        try { $null = Restore-DaviAcl $roots.Project $roots.Publication $snapshotFile }
        catch { throw "Aplicação falhou e rollback ficou incompleto. Preserve o snapshot: $snapshotFile" }
        throw "Aplicação de ACL falhou; rollback verificado. Snapshot preservado: $snapshotFile. Causa: $($original.Exception.Message)"
    }
    [pscustomobject]@{ Result='AppliedAndVerified'; Snapshot=$snapshotFile; Items=$count }
}
Export-ModuleMember -Function Set-DaviPermissions,Restore-DaviAcl
