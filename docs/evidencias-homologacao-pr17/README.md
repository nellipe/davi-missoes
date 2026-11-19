# Evidências automatizadas — PR #17

Dados exclusivamente sintéticos. Base artística `21e0aa1`, preparação em `test/floresta-homologacao-lan`.

- [resultado.json](resultado.json): navegador, GPU, primeira abertura, tempos de frames, verificações e erros.
- [isolamento.json](isolamento.json): verificação TLS real da instância LAN, autorização e preservação durante parada/reinício.
- [gameplay.mp4](gameplay.mp4): gravação contínua de teclado, missão/retorno e construção de ponte/casa.
- [Celular 390](floresta-390.png), [360](floresta-360.png), [tablet 768](floresta-768.png), [1024](floresta-1024.png), [desktop 1366](floresta-1366.png), [fallback 2D](fallback-2d-390.png).

Chromium automatizado no Windows, RTX 2060 SUPER / D3D11. Larguras móveis e toque são **emulados na GPU desktop**. Fluxos de navegador usam HTTP loopback com bancos/processos temporários; o teste TLS separado e a verificação da instância LAN usam HTTPS com CA validada. Não foi usado `ignoreHTTPSErrors`.

O tempo `firstWorldReadyMs` é a primeira abertura do contexto automatizado em loopback; não mede transferência por Wi-Fi nem significa cache frio do sistema operacional. `assetLoadMs` de retornos pode ser zero por reutilização de modelos. O p95 de frames registrado é do desktop, não dos aparelhos da família.

O painel tem testes de exportação JSON, qualidade econômica persistente, perda/recuperação de contexto e continuação 2D quando a perda persiste. O relatório não contém credenciais, cookies, chaves ou banco.

Homologação física de celular, tablet e computador familiar: **PENDENTE**. Use o [roteiro](../homologacao-floresta-pr17.md) e o [modelo de registro](../registro-pr17-homologacao.md). Nenhum resultado de aparelho físico foi inventado ou enviado à PR.
