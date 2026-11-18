# Piloto da Etapa 7 na instalação familiar

Execute a publicação em PowerShell elevado depois que o responsável aprovar visualmente a revisão e indicar o SHA aprovado da PR #17. O piloto usa o DNS, o HTTPS, o Caddy, o SQLite e os serviços Windows existentes. A [publicação V0.5](publicacao-v05.md) descreve a instalação da raiz pública nos aparelhos.

## Conferência que já foi feita

O checkout familiar em `D:\davi-missoes` estava no commit `39114a8a5d541fc9598481d26238c593521802f8`, sem mudanças rastreadas. `DaviApp` e `DaviProxy` estavam em execução a partir de `publicacao`. A resposta HTTPS para os arquivos públicos `app.js` e `app.css` coincidiu byte a byte com o checkout local, usando a raiz Caddy existente e validação de nome. A versão anterior carece de um identificador de build na resposta HTTP. O piloto acrescenta `/api/build`, que identifica o SHA lido na partida do processo.

A leitura imutável dos arquivos principais de `agenda.sqlite3` e `auth.sqlite3` devolveu `quick_check = ok`. Esse exame era preliminar e observou os arquivos principais. A cópia fechada abaixo inclui quaisquer arquivos auxiliares do SQLite e tem sua própria verificação. A Etapa 7 usa o esquema da Etapa 6. O caminho desde instalações antigas continua passando pelas rotinas aditivas existentes, que fazem backup antes de aplicar alterações pendentes.

## Atualizar para o SHA aprovado

1. Feche sessões de teste, confira o SHA aprovado e reserve uma janela breve com a família. Abra PowerShell elevado no computador que hospeda o jogo.
2. Execute o bloco abaixo. O diretório de cópia deve ficar privado. Guarde o caminho exibido e uma cópia protegida fora do PC.

```powershell
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath 'D:\davi-missoes'
$aprovado = Read-Host 'SHA completo da PR 17 aprovado pelo responsável'
if ($aprovado -cnotmatch '^[0-9a-f]{40}$') { throw 'Informe o SHA completo.' }
function Conferir-Nativo {
    if ($LASTEXITCODE -ne 0) { throw "Comando nativo falhou ($LASTEXITCODE)." }
}
git fetch origin '+refs/pull/17/head:refs/remotes/origin/pr17-piloto'
Conferir-Nativo
$cabecaPr = git rev-parse refs/remotes/origin/pr17-piloto
Conferir-Nativo
if ($cabecaPr -ne $aprovado) { throw 'A cabeça da PR mudou. Revise o novo SHA.' }
git diff --quiet HEAD --
Conferir-Nativo
$anterior = git rev-parse HEAD
Conferir-Nativo
git merge-base --is-ancestor $anterior $aprovado
Conferir-Nativo
if (@(git ls-tree --name-only $aprovado -- dados publicacao).Count) { throw 'A revisão contém dados ou publicação versionados.' }
$python = (Get-Command python.exe).Source
$pub = Join-Path (Get-Location) 'publicacao'
$ops = Join-Path (Get-Location) 'scripts\Publicacao-Lan.ps1'
$copia = Join-Path 'D:\davi-backups' ('antes-etapa7-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -Path $copia -ItemType Directory | Out-Null
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
icacls.exe $copia /inheritance:r /grant:r "*${sid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F'
Conferir-Nativo
$anterior | Set-Content -LiteralPath (Join-Path $copia 'commit-anterior.txt') -Encoding ascii
$aprovado | Set-Content -LiteralPath (Join-Path $copia 'commit-piloto.txt') -Encoding ascii
Write-Host "Cópia privada em $copia"

& $ops -Acao Parar -Pasta $pub -Python $python -Confirm:$false
if (@(Get-Service DaviApp,DaviProxy | Where-Object Status -ne 'Stopped').Count) { throw 'Os dois serviços precisam estar parados.' }
foreach ($pasta in 'dados','publicacao') {
    robocopy.exe (Join-Path (Get-Location) $pasta) (Join-Path $copia $pasta) /E /COPY:DAT /DCOPY:DAT /XJ /R:1 /W:1 /NFL /NDL /NP
    if ($LASTEXITCODE -ge 8) { throw "Backup falhou em $pasta. Reinicie o commit anterior." }
}
@'
import sqlite3, sys
from pathlib import Path

for name in ("agenda.sqlite3", "auth.sqlite3"):
    db = Path(sys.argv[1]) / "dados" / name
    with sqlite3.connect(db.resolve().as_uri() + "?mode=ro", uri=True) as conn:
        if conn.execute("PRAGMA quick_check").fetchall() != [("ok",)]:
            raise SystemExit("Falha na integridade do backup de " + name)
    print(name + " ok")
'@ | & $python - $copia
Conferir-Nativo
git switch --detach $aprovado
Conferir-Nativo
if ((git rev-parse HEAD) -ne $aprovado) { throw 'Checkout inesperado. Faça rollback.' }
& $ops -Acao Iniciar -Pasta $pub -Python $python -Confirm:$false
Get-Service DaviApp,DaviProxy
```

3. Confirme os dois serviços em execução e o SHA realmente servido. Valide o endereço com a raiz pública existente. Este comando imprime apenas a versão e o commit.

```powershell
@'
import json, ssl, sys, urllib.request
from pathlib import Path

ca = Path("publicacao/caddy-data/pki/authorities/local/root.crt")
ctx = ssl.create_default_context(cafile=str(ca.resolve()))
with urllib.request.urlopen("https://aventuras.davi.costa/api/build", context=ctx, timeout=10) as response:
    build = json.load(response)
if build["commit"] != sys.argv[1]:
    raise SystemExit("SHA servido diferente do aprovado")
print(build["version"], build["commit"])
'@ | & $python - $aprovado
Conferir-Nativo
```

Se qualquer etapa falhar depois da parada, use o rollback abaixo. Confirme também que a página abre na LAN com HTTPS válido, que a senha existente abre o painel e que as atividades e a floresta carregam na mesma sessão. Os testes de confirmação e compras que alteram dados já são exercitados em bancos sintéticos.

## Rollback de código

Informe o diretório privado exibido pelo bloco anterior. Este caminho restaura o código, mantendo os dados e a CA atuais. Se um problema exigir restaurar dados, faça uma cópia fechada do estado posterior para preservar mudanças feitas durante o piloto e siga a restauração da documentação V0.5. Restaurar arquivos antigos pode perder progresso recente e revogar sessões.

```powershell
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath 'D:\davi-missoes'
$copia = Read-Host 'Pasta privada antes-etapa7'
$anterior = (Get-Content -Raw -LiteralPath (Join-Path $copia 'commit-anterior.txt')).Trim()
if ($anterior -cnotmatch '^[0-9a-f]{40}$') { throw 'SHA de rollback inválido.' }
$python = (Get-Command python.exe).Source
$pub = Join-Path (Get-Location) 'publicacao'
$ops = Join-Path (Get-Location) 'scripts\Publicacao-Lan.ps1'
& $ops -Acao Parar -Pasta $pub -Python $python -Confirm:$false
if (@(Get-Service DaviApp,DaviProxy | Where-Object Status -ne 'Stopped').Count) { throw 'Os dois serviços precisam estar parados.' }
git switch --detach $anterior
if ($LASTEXITCODE -ne 0 -or (git rev-parse HEAD) -ne $anterior) { throw 'O código anterior não foi restaurado.' }
& $ops -Acao Iniciar -Pasta $pub -Python $python -Confirm:$false
Get-Service DaviApp,DaviProxy
```

Confira o HTTPS novamente. Se o commit anterior não tiver `/api/build`, compare `app.js` servido com o checkout anterior via SHA-256, usando a raiz pública existente.

## Testes da família

1. No Wi-Fi doméstico, abra `https://aventuras.davi.costa` sem avisos de certificado. Use Silk no Fire HD 8 (2022), Chrome no Redmi 8 e o navegador da família no LG All in One. Anote o modelo exato do Redmi e o navegador de cada aparelho.
2. Entre como responsável e toque em **Medir desempenho**. Comece com **Automático**. No Fire e no Redmi, repita no **Econômico**. No LG, compare também o **Detalhado**. Percorra a margem, o recanto do besouro, a Garganta, o Pátio e a roda alta. Faça uma volta de aproximadamente dez minutos.
3. Abra **Agora** no caminho, volte à floresta, recarregue e alterne para 2D. Confira a mesma posição e os mesmos destinos. Teste toque no Fire e no Redmi e clique e teclado no LG. Compare FPS, p95 e travadas na passagem e no recanto. A meta inicial móvel é cerca de 25 a 30 FPS sustentáveis.
4. Abra **Diagnóstico em andamento**, selecione **Aparelho**, baixe o JSON e encerre a sessão de medição. Registre a largura, o ponto da floresta mais lento e se a criança percebeu as duas trilhas. Guarde os relatórios localmente. Compartilhe-os após conferir os metadados técnicos de aparelho e navegador.
