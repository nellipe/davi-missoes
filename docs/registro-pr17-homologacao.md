## Homologação LAN — Floresta Encantada

**Estado: aguardando aparelhos físicos. Sem merge ou deploy de produção.**

Base artística `21e0aa1`, preparação local no ramo `test/floresta-homologacao-lan`. Instância HTTPS isolada em `192.168.2.10:18443`, backend loopback 18765, banco exclusivamente sintético, CA e processos próprios. Produção permanece em 443/8765. Guia: `docs/homologacao-floresta-pr17.md`.

### Validação automatizada concluída

- Python: 60 testes da suíte (59 passaram, TLS opcional separado); teste TLS real adicional passou com verificação de CA, operações autenticadas e restrição de rede.
- JavaScript: 9 passaram.
- Playwright em Chromium desktop com RTX 2060 SUPER/D3D11: teclado, toque emulado, câmera, missão/retorno, compras, ponte/casa, persistência em recarga e segundo contexto, econômica persistente, fallback sem WebGL e perda/restauração de contexto. Exportação de JSON baixada e validada.
- Viewports 360, 390, 768, 1024 e 1366: sem overflow ou violações axe nos cenários avaliados. Sem erros JS ou requisições externas inesperadas. Consulte `docs/evidencias-homologacao-pr17/resultado.json` para métricas e limitações.
- FPS no desktop não comprova desempenho de celular/tablet. Perda WebGL foi simulada; calor, bateria, toque físico e suspensão real continuam pendentes.
- Correção encontrada nesta homologação: floresta agora respeita vestir/tirar acessórios, incluindo lenço do Pipo; teste verifica visibilidade da malha e persistência. Painel mede abertura completa e permite exportar diagnóstico; cache de assets com erro pode ser tentado novamente.
- Ciclo de parada/reinício testado: banco sintético conservado, nove hashes de arquivos de produção inalterados no intervalo, serviços de produção nos mesmos processos. CA de teste não foi instalada globalmente.

### Preencher depois dos testes físicos

Data/hora: ___ · revisão local/commit: ___ · responsável pelo teste: ___

| Aparelho/modelo | SO | Navegador/versão | Resolução/orientação | Perfil solicitado → usado | 1ª abertura / cache (ms) | FPS / p95 (ms) | WebGL/falhas | Resultado/evidência |
|---|---|---|---|---|---|---|---|---|
| Celular | Pendente | | | Automática / Econômica | | | | PENDENTE |
| Tablet | Pendente | | | Automática / Econômica | | | | PENDENTE |
| Computador familiar | Pendente | | | Automática / Econômica | | | | PENDENTE |

Por aparelho, preencher:

- [ ] HTTPS confiável e autorização infantil.
- [ ] Toque/teclado, soltar/cancelar, chão, obstáculos e água.
- [ ] Câmera, Pipo, retrato/paisagem e visibilidade.
- [ ] Missões Aprender/Lembrar/Fazer, bloqueio fora do horário e retorno.
- [ ] Oficina, acessórios, ponte/casa, saldo sem cobrança duplicada.
- [ ] Persistência ao recarregar/reabrir, segundo aparelho e reinício da instância de teste.
- [ ] Econômica persistente; 2D funciona e permite voltar à floresta.
- [ ] Suspensão/retorno; dez minutos contínuos; bateria/calor/engasgos registrados.

Anexos: JSON por aparelho/perfil, captura e vídeo curto do problema, se houver. Usar só dados sintéticos.

Falhas: aparelho + passos para reproduzir + esperado/observado + horário + perfil + evidência. Classificar como bloqueante (perda de progresso, fluxo essencial indisponível, travamento sem recuperação/2D) ou ajuste visual/desempenho. Repetir o cenário após correção.

Decisão familiar: **PENDENTE**. Só aprovar após testar os três aparelhos; falhas bloqueantes precisam ser resolvidas. Este registro não autoriza merge/deploy.
