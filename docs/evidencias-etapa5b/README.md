# Bosque das Bainhas · Acabamento da descoberta

O quadro inicial mostra uma bacia molhada, outra seca e um besouro junto à margem seca. Ao tocar na folha, ela inclina. O fio claro muda de borda, cai na outra bacia e forma um respingo. A primeira poça encolhe. Em seguida, o besouro ergue a telha, atravessa sobre as patas e se acomoda ao lado da bacia que ficou seca. A volta reproduz esse estado a partir da posição da folha já salva. [Vídeo contínuo, sem áudio nem instruções](descoberta-390.mp4)

## A mesma câmera em 390 px

| Antes | Folha em movimento | Goteira no outro lado | Besouro carregando a telha | Novo abrigo | Revisita |
|---|---|---|---|---|---|
| [Encontro](encontro-390-low.png) | [Virada](virada-390-low.png) | [Água](goteira-390-low.png) | [Transporte](transporte-390-low.png) | [Abrigo](abrigo-390-low.png) | [Retorno](revisita-390-low.png) |

O primeiro enquadramento permanece fixo do encontro ao novo abrigo. Na revisita, Davi volta a pé ao mesmo ponto do recanto. O vídeo tem 13,25 segundos contínuos e foi gravado no perfil econômico a 390 px, com recorte da área 3D. Durante a captura, a automação oculta os controles e os textos do cenário só na página do ensaio. O toque acerta a própria folha. No jogo, a ação contextual e o teclado continuam disponíveis.

Com movimento reduzido, a troca mostra de imediato a inclinação, o fio completo, a bacia molhada e o besouro do lado seco. Os gestos de transporte e o respingo animado param. [Estado reaberto com movimento reduzido](reduzido-390-low.png)

## Capturas nos dois perfis

| Largura | Bifurcação | Recanto detalhado | Recanto econômico |
|---|---|---|---|
| 360 px | [Detalhado](bifurcacao-360-high.png) · [Econômico](bifurcacao-360-low.png) | [Antes](encontro-360-high.png) · [Depois](abrigo-360-high.png) | [Antes](encontro-360-low.png) · [Depois](abrigo-360-low.png) |
| 390 px | [Detalhado](bifurcacao-390-high.png) · [Econômico](bifurcacao-390-low.png) | [Antes](encontro-390-high.png) · [Depois](abrigo-390-high.png) | [Antes](encontro-390-low.png) · [Depois](abrigo-390-low.png) |
| 1366 px | [Detalhado](bifurcacao-1366-high.png) · [Econômico](bifurcacao-1366-low.png) | [Antes](encontro-1366-high.png) · [Depois](abrigo-1366-high.png) | [Antes](encontro-1366-low.png) · [Depois](abrigo-1366-low.png) |

A referência original orientou o trabalho nos contornos recortados das copas, nas manchas de musgo das ardósias e no cascalho que se perde na borda irregular do caminho. As frondes reforçam a moldura baixa. A escala do vale da referência segue além do recorte desta cena. As duas entradas continuam acessíveis e visíveis na câmera inicial de 360 e 390 px. [Comparação da Etapa 5](../evidencias-etapa5/README.md) · [Revisão do responsável](https://github.com/nellipe/davi-missoes/pull/17#issuecomment-6979425007)

## Custo e validação

O cenário usa duas bacias modeladas, fios de água de malha simples e três gotas de respingo reaproveitadas. Os dois perfis usam a mesma sequência visual. O detalhado mantém sombras dinâmicas e mais folhas de primeiro plano. No econômico, a borda das bacias e o contraste da água continuam visíveis sem sombra dinâmica.

| Largura e perfil | Bifurcação, chamadas / triângulos | Abrigo, chamadas / triângulos | Maior p95 dos dois pontos |
|---|---:|---:|---:|
| 360 px · Detalhado | 125 / 225.236 | 153 / 224.826 | 16,8 ms |
| 360 px · Econômico | 56 / 97.618 | 85 / 98.000 | 16,8 ms |
| 390 px · Detalhado | 126 / 226.028 | 153 / 224.826 | 16,8 ms |
| 390 px · Econômico | 57 / 98.410 | 85 / 98.000 | 16,8 ms |
| 1366 px · Detalhado | 140 / 231.028 | 159 / 229.150 | 16,8 ms |
| 1366 px · Econômico | 71 / 103.410 | 91 / 102.324 | 16,8 ms |

Medições em Chromium com RTX 2060 SUPER e ANGLE/D3D11, 36 intervalos por ponto, relação de pixels 1. A 390 px, durante a sequência, o econômico chegou a 86 chamadas e 98.224 triângulos e o detalhado chegou a 154 chamadas e 225.050 triângulos. O abrigo estável ficou cerca de 10% acima da Etapa 5 em triângulos nos dois perfis. O econômico usou 56% menos triângulos que o detalhado. O p95 mede intervalos entre quadros, incluindo a cadência da tela. [360 detalhado](besouro-360-high.json) · [360 econômico](besouro-360-low.json) · [390 detalhado](besouro-390-high.json) · [390 econômico](besouro-390-low.json) · [1366 detalhado](besouro-1366-high.json) · [1366 econômico](besouro-1366-low.json)

Passaram 62 testes Python e quatro casos unitários de navegação. Os seis ensaios de navegador conferiram os alvos da bifurcação, o toque na folha, a ordem dos gestos e a posição da câmera. Em 390 px econômico, o ensaio longo também passou pela garganta, voltou ao recanto, abriu **Agora**, recarregou com movimento reduzido, devolveu a folha à posição inicial e alternou para o 2D. Saldo, inventário e ocorrência permaneceram iguais na comparação com o início. Também passaram os ensaios de teclado e fallback de WebGL. [Ensaio de navegador](../../tests/browser_shelter.cjs)

As capturas são do jogo no Chromium, com dados sintéticos em loopback. A família ainda precisa verificar se a criança consegue apontar o lado novo da água e prever onde o besouro vai parar. A leitura e o desempenho físicos no Fire HD 8, Redmi 8 e LG All in One seguem pendentes.
