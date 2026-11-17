# Evidências V0.6D — somente dados sintéticos

Validação Chromium/Playwright em desktop (1366 px) e celular (360 px), redução de movimento habilitada. Sem erros JavaScript, sem overflow horizontal e sem violações axe nas verificações WCAG A/AA executadas. Isso não substitui teste com leitor de tela ou aparelho físico.

- [Mundo desktop](mundo-1366.png) / [celular](mundo-360.png)
- [Todas as atividades desktop](atividades-1366.png) / [celular](atividades-360.png)
- [Controle do responsável desktop](responsavel-1366.png) / [celular](responsavel-360.png)
- [Revogação após compra e saldo negativo](revogacao-360.png)
- [Resultado dos fluxos](resultado.json)

Reprodução: `node tests/browser_parent_controls.cjs`, com Playwright e axe disponíveis no ambiente de desenvolvimento. O processo usa banco e credenciais sintéticos temporários e não modifica a instalação da família. O cenário foi ampliado para também confirmar/desfazer passos no painel protegido.
