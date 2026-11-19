# Etapa 7C · Rochas, enquadramento e movimento

Amostras do jogo no Chromium em loopback com SQLite sintético. A comparação usa a base `0af9973`, as mesmas posições na Soleira `(28, 13,35)` e no Bosque `(30,68, 6,50)`, e a câmera centralizada. As gravações usam os controles do jogo.

## Objetos identificados antes da alteração

A sonda lançou raios a partir da câmera e registrou o primeiro elemento visível em cada ponto amostrado, com nome da malha, material, cor, coordenadas e escala. Os JSON registram também as instâncias das copas e da calha. A rocha que invadia a ponta da calha e o segundo volume ao lado pertenciam ao lote de rochas do Bosque. O formato, o pigmento e a escala explicavam as massas observadas. As copas eram objetos separados.

| Elemento | Instância e material na base | Posição global X/Y/Z | Escala X/Y/Z |
|---|---|---|---|
| Ardósia sobre o início da calha | Malha individual `Bosque:Ardosia`, `Pigmentos do Bosque` | 27,10 / −0,02 / 8,50 | 1,57 / 1,41 / 1,13 |
| Seixo ao lado | Malha individual `Bosque:Seixo_musgo`, `Pigmentos do Bosque` | 24,70 / −0,02 / 8,90 | 1,10 / 1,70 / 1,18 |
| Bloco alto atrás da bifurcação | Malha individual `Bosque:Pedra_fendida`, `Pigmentos do Bosque` | 28,10 / 2,45 / 0,10 | 2,02 / 1,62 / 1,73 |
| Outra ardósia atrás do varal | Malha individual `Bosque:Ardosia`, `Pigmentos do Bosque` | 30,00 / 2,04 / −0,60 | 1,55 / 1,76 / 1,49 |
| Copa próxima à bifurcação | `Carvalho_Copa_economica` #0, `Pigmentos do Bosque` | 25,80 / −0,03 / 7,50 | 1,08 / 1,08 / 1,08 |
| Superfície da calha | `Trilha:slab` #2, `MeshStandardMaterial`, cor `#76b9af` | 26,62 / 0,21 / 11,15 | 0,82 / 0,12 / 5,70 |
| Pedra dispersa da Soleira | `Trilha:Ardosia_centrada` #10, `MeshStandardMaterial`, cor `#739269` | 22,17 / 0,27 / 16,14 | 0,65 / 0,52 / 0,55 |

Na revisão, a ardósia da calha passa a ser a instância #0 de `Bosque:Ardosia`, em **25,10 / −0,03 / 8,48**, escala **0,94 / 0,72 / 0,67**. O seixo fica mais baixo e deslocado para o lado. Os volumes atrás do varal foram rebaixados. Tons minerais, um veio baixo na malha e pequenas manchas de musgo separam pedra de folhagem. O lote de ardósia dispersa usa a pintura por vértice. As pedras e arbustos cedem espaço quando cruzam a linha de visão de Davi, Pipo, roda, calha ou entradas próximas das trilhas. A visibilidade retorna com a mudança do ângulo. O terreno navegável e as zonas de colisão continuam definidos pelos mesmos mapas.

## Capturas e vídeo

| Largura e perfil | Soleira | Bosque | Inventário de malhas, três ângulos |
|---|---|---|---|
| 390 px · Econômico | [Antes](base-390-low-soleira-0.png) · [Depois](atual-390-low-soleira-0.png) | [Antes](base-390-low-bosque-0.png) · [Depois](atual-390-low-bosque-0.png) | [Antes](inventario-base-390-low.json) · [Depois](inventario-atual-390-low.json) |
| 390 px · Detalhado | [Antes](base-390-high-soleira-0.png) · [Depois](atual-390-high-soleira-0.png) | [Antes](base-390-high-bosque-0.png) · [Depois](atual-390-high-bosque-0.png) | [Antes](inventario-base-390-high.json) · [Depois](inventario-atual-390-high.json) |
| 1366 px · Econômico | [Antes](base-1366-low-soleira-0.png) · [Depois](atual-1366-low-soleira-0.png) | [Antes](base-1366-low-bosque-0.png) · [Depois](atual-1366-low-bosque-0.png) | [Antes](inventario-base-1366-low.json) · [Depois](inventario-atual-1366-low.json) |
| 1366 px · Detalhado | [Antes](base-1366-high-soleira-0.png) · [Depois](atual-1366-high-soleira-0.png) | [Antes](base-1366-high-bosque-0.png) · [Depois](atual-1366-high-bosque-0.png) | [Antes](inventario-base-1366-high.json) · [Depois](inventario-atual-1366-high.json) |

[Percurso curto da Soleira ao Bosque](percurso-rochas.mp4) · [Giros de câmera nos dois pontos](giro-da-camera.mp4)

## Animações

**Seguir o aparelho** é o padrão. **Ativar neste navegador** e **Reduzir neste navegador** são escolhas manuais persistentes. Um navegador com a opção antiga em `full` segue o aparelho até a nova escolha manual, porque a opção anterior ainda respeitava a restrição do sistema. Quem reduziu explicitamente as animações mantém essa escolha. A mensagem nas opções e o indicador no cenário mostram quando a seleção manual ativa animações mesmo com movimento reduzido no aparelho.

O ensaio conferiu passos e apoio de Pipo, rotações das duas rodas, deslocamento dos barquinhos e quadros da corrente da Soleira. Em movimento reduzido, a água fica estática e o barquinho mostra partida e chegada. A ativação manual com a preferência do sistema em redução voltou a mover a roda, a água e o barco. A escolha persistiu após recarregar e alternar entre 2D e 3D.

[Vídeo do controle de animações e da calha](movimento-390.mp4) · [Seguir a preferência do aparelho](movimento-390-preferencia-do-aparelho.png) · [Ativação manual](movimento-390-escolha-manual-ativada.png) · [Transformações e teste dos quadros de água](movimento-390.json)

## Orçamento e regressões

As pedras do Bosque passam a compartilhar três lotes instanciados. As marcas da corrente usam o lote da calha. A amostra da **passagem em 1366 px Detalhado** baixou de **302 para 289 chamadas** e passou de **475.788 para 476.632 triângulos**. O teste tem limite de 302 chamadas nessa posição e nesse ângulo. A mediana do quadro nesse ponto foi de 16,7 ms no Chromium com RTX 2060 SUPER. Os aparelhos familiares ainda precisam ser medidos para esta revisão.

| Largura e perfil | Soleira, chamadas antes → depois | Bosque, chamadas antes → depois |
|---|---:|---:|
| 390 px · Econômico | 78 → 73 | 79 → 73 |
| 390 px · Detalhado | 155 → 141 | 157 → 142 |
| 1366 px · Econômico | 96 → 87 | 101 → 92 |
| 1366 px · Detalhado | 174 → 156 | 180 → 162 |

Passaram 64 testes Python e quatro de navegação. O navegador exercitou a volta contínua, o apoio e as colisões, as duas trilhas, os dez destinos, a revisita ao besouro, a agenda, missões, compras, personalização, os 30 ciclos 2D/3D e o fallback WebGL. O ensaio dirigido verificou Davi e Pipo em 24 enquadramentos na Soleira e no Bosque, com pelo menos dois pontos visíveis de cada personagem em cada cena. [Volta contínua](volta-1366-high.json) · [Alternâncias 2D/3D](alternancias.json) · [Personalização](personalizacao-390.json)

Para repetir a sonda, use `node tests/browser_forest_rocks.cjs 390` ou `1366` em uma cópia de desenvolvimento com Playwright e Chromium. `FOREST_PROFILE=low` ou `high` escolhe o perfil. `FOREST_RECORD=1` habilita vídeo com FFmpeg. Para repetir a conferência de animações, execute `node tests/browser_forest_refinement.cjs movimento 390`.
