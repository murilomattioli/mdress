# mdress — Section Composer / F-006S

## Objetivo

O usuário estiliza visualmente as seções `## Título` e seu conteúdo como se fossem blocos de uma página web, com **zero decoração no Markdown original**. Aplicação direta no preview ou pelo inspector Seções.

## Tipos incluídos

1. Essencial — sem decoração adicional.
2. Cartão suave — superfície tonal com raio e borda discreta.
3. Barra lateral — rail colorido e preenchimento sutil.
4. Quadro — contorno fino.
5. Faixa de título — header destacado com CSS.
6. Editorial — título tipográfico e divisor.
7. Destaque — degradê vetorial e acento superior.
8. Ficha — composição de bloco técnico compacto.

## UX

- Ação de pincel no título H2 do preview abre automaticamente o inspector Seções selecionando o bloco.
- Galeria visual clicável, com preview abstrato de cada estilo.
- Selecionar **Todas as seções** aplica o preset global; escolher uma seção H2 altera só aquele bloco.
- Densidade Compacto/Normal/Amplo ajusta o espaçamento de toda composição.
- Restaurar remove personalização da seleção ou volta todas as seções ao padrão.
- O visual escolhido persiste no IndexedDB, na duplicação e no backup JSON mdress.
- Mudanças de fonte, paleta e página continuam por meio do tema do documento (sem CSS arbitrário injetado por IA).

## Paginação / exportação

O PagePlan primeiro tenta posicionar um bloco de seção inteiro no espaço disponível; caso não caiba, fragmenta o contêiner pelos blocos de texto e cria `section-segment` por folha, mantendo bordas/padding/fundo em cada fragmento. Não há rasterização nem conversão de texto em imagem. Textos excessivamente longos continuam sujeitos à política existente de splitLeaf, sem prometer continuidade perfeita de fundo para cada fragmento de parágrafo.

Invariantes: `previewPages === pdfPages`, 0 folhas vazias, todos os parágrafos preservados e legíveis por `pdftotext`, layout responsivo no inspector.

## Design System / Travas

- Botões de trava usam dois estados explícitos: cadeado aberto (livre) e fechado (protegido), borda/acento/fundo consistente, foco de teclado, `aria-pressed` e title dinâmico.
- Quatro grupos protegidos apenas contra randomização: Paleta, Fonte, Espaços e Fundo. Travas não impedem edição manual.
- A barra do inspector usa ícones complementares aos rótulos curtos: Estilo, Seções, Página, Fundo, IA.
- O acesso por ícones não oculta nomes das tecnologias assistivas.

## Limites assumidos

- Primeiro recorte com seletores semânticos para seções H2. H3/subseções podem receber comportamento no futuro com AST real.
- Identificador derivado de título + ocorrência: renomear pode exigir reaplicar o preset, sem alterar outro bloco por engano.
- Composição funciona com CSS leve, mas não é um mecanismo de grids arbitrários tipo HTML editor. Roadmap: propriedades de borda/radius/padding por bloco, layout de 2 colunas com garantia de paginação, edição por drag no canvas, kits de templates completos e biblioteca de padrões compartilhável entre docs.
- Não suporta transposição perfeita de qualquer CSS de websites para leitores ATS; os blocos continuam semanticamente textuais.
