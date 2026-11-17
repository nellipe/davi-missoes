# Comparação visual V0.7 B

Somente dados sintéticos. Cenas capturadas de WebGL real no Chromium, sem imagem pronta servindo como cenário. Viewports 360, 390 e 1366 px. A ilha anterior continua como fallback.

| Cena | Desktop | Celular 390 | Celular 360 |
| --- | --- | --- | --- |
| Floresta Encantada | [1366](forest-1366.png) | [390](forest-390.png) | [360](forest-360.png) |
| Ilhas das Nuvens | [1366](clouds-1366.png) | [390](clouds-390.png) | [360](clouds-360.png) |
| Cidade dos Robôs | [1366](robots-1366.png) | [390](robots-390.png) | [360](robots-360.png) |
| Ilha dos Tesouros | [1366](treasure-1366.png) | [390](treasure-390.png) | [360](treasure-360.png) |
| Montanhas de Cristal | [1366](crystal-1366.png) | [390](crystal-390.png) | [360](crystal-360.png) |
| Construções e acessório comprados | [1366](construcoes-1366.png) | [390](construcoes-390.png) | [360](construcoes-360.png) |

Compare [ilha 2D preservada](comparacao-2d-360.png) com [mundo 3D com as mesmas compras](construcoes-360.png): o terreno agora tem volume, câmera móvel em perspectiva, personagens articulados e construções com malhas e sombras. Os cinco cenários têm marcos e caminhos distintos; não apenas mudança de paleta.

[Portais](portais-360.png), [atividades](atividades-390.png), [editor desktop](editor-form-1366.png), [editor celular](editor-form-390.png), [lista após criação](editor-1366.png), [fallback sem WebGL](sem-webgl-390.png).

[Resultado dos fluxos e métricas](resultado.json). As métricas usam WebGL por software em Windows; não prometem o mesmo FPS em um aparelho físico. Verificações axe WCAG A/AA e overflow complementam, sem substituir, testes com leitor de tela, toque físico e uso pela família.
