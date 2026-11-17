Set-Location -LiteralPath $PSScriptRoot
$python = Get-Command py -ErrorAction SilentlyContinue
if ($python) {
    & py -3 .\server.py
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    & python .\server.py
} else {
    throw 'Python 3.10+ não encontrado. Instale Python e tente novamente.'
}
