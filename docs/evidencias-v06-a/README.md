# Evidências — V0.6 Etapa A

Todas as atividades, nomes, senhas e bancos usados nos testes são sintéticos. Desenvolvimento concluído no worktree isolado `D:\davi-missoes-v06-a`; o diretório servido em `D:\davi-missoes` está na versão `origin/main` da V0.5, sem reinício de serviços ou alteração de infraestrutura. Os SHA-256 dos dois SQLite reais e dos dois backups existentes foram comparados antes/depois e permaneceram iguais; os arquivos reais não foram abertos pela aplicação em teste.

Nota operacional: os primeiros ajustes foram feitos no diretório servido, antes de confirmar que os serviços estavam ativos. Esses arquivos foram restaurados à V0.5 e o trabalho foi transferido para o worktree isolado. Não houve reinício, migração real ou instalação; não se verificou se algum navegador consultou os assets durante esse intervalo.

## Validação automatizada

| Verificação | Resultado |
| --- | --- |
| Python / Windows 3.13.5 | 45 testes da agenda, missões, migração, autenticação, backup e publicação aprovados, sem skips. |
| HTTPS com Caddy 2.11.9 | CA e portas efêmeras somente em loopback; confirma etapa por HTTPS sem concluir o compromisso e nega biblioteca administrativa à criança. Nenhum certificado instalado no Windows. |
| Node | 9 testes de regressão da interface aprovados. |
| PowerShell | Testes de serviços/firewall simulados e ACLs reais somente em TEMP aprovados. |
| Playwright + axe | Jornada completa de edição/vínculo/progresso; sete verificações de acessibilidade em larguras 360, 1366 e 1920, sem violações WCAG A/AA detectadas nem overflow horizontal. |
| Git | `git diff --check` sem erros. |

O [relatório reproduzível](validation.json) registra os passos, larguras e resultados de acessibilidade. Verificações automáticas não substituem leitor de tela, toque físico e homologação familiar supervisionada após aprovação.

## Capturas

- [Vínculo por série/data no celular](vinculo-360.png).
- Editor: [360 px](editor-360.png), [1366 px](editor-1366.png), [1920 px](editor-1920.png).
- Sequência com progresso próprio: [360 px](passos-360.png), [1366 px](passos-1366.png).

## Reproduzir sem dados reais

Execute a partir do worktree de desenvolvimento, **fora do diretório servido pela instalação V0.5**:

```powershell
$env:DAVI_TEST_CADDY = 'D:\davi-ferramentas\caddy\caddy.exe'
python -m unittest discover -s tests -v
node --test tests/test_visual.cjs
& .\tests\test_service.ps1
& .\tests\test_acl.ps1
Remove-Item Env:DAVI_TEST_CADDY

$tools = Join-Path $env:TEMP 'davi-v06-browser-tools'
npm install --prefix $tools --no-audit --no-fund playwright @axe-core/playwright
& (Join-Path $tools 'node_modules/.bin/playwright.cmd') install chromium
$env:NODE_PATH = Join-Path $tools 'node_modules'
$env:PYTHON = (Get-Command python).Source
node tests/browser_missions.cjs
```

O script escolhe porta efêmera, cria SQLite em TEMP, faz login/pareamento somente na fixture, exercita o editor e duas áreas em contextos de navegador separados. Ao final encerra seus processos e remove apenas o diretório sintético, após validar o caminho. Não usa DNS, listeners, serviços ou bancos da publicação real. O teste TLS também inicia exclusivamente sua instância temporária de Caddy.
