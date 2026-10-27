# F-007C — Surpreenda-me: Só cores

## Objetivo

Uma ação de **um clique** para descobrir paletas de cor sem perder o layout já organizado. Separa experimentação visual geral da cromática.

## UI

Em Estilo > Tema > Surpreenda-me:
- Visual completo usa a randomização anterior.
- Só cores aplica paletas curadas sem mexer na composição.
- Swatches mostram Papel, Texto, Destaque e Detalhes atuais.
- Quando Paleta e Fundo estão travados, Só cores é desabilitado.

## Invariantes

Só cores pode alterar as cores de destaque/texto/papel, a cor secundária do fundo e cores dos pontos Mesh existentes.

Não altera Markdown, fonte, tamanho, papel físico, margens, entrelinhas, títulos, espaçamento de seção, regras de quebra, tipo de fundo, ângulo, padrão, opacidade, softness, posição/raio/intensidade dos pontos Mesh.

Trava Paleta protege Destaque e Texto. Trava Fundo protege base de papel, cor secundária e cada ponto Mesh. As duas juntas bloqueiam a operação.

## Legibilidade

- 16 paletas cromáticas locais e sem recursos externos.
- Algoritmo exclui combinações com contraste texto/base inferior a 4,5:1 ou destaque/base inferior a 3:1.
- Não promete contraste pixel-a-pixel sobre gradientes e Mesh: recomenda verificação visual real.
- Usa o motor de temas existente e não adiciona imagens ao PDF.

## QA

Testes de invariantes, imutabilidade, valores limites, locks, contraste, persistência e navegador em testes/color-surprise.test.mjs e scripts/e2e.mjs. O CI inclui exportação PDF com texto extraível.

## Futuro

Favoritar cores, controles de intensidade/temperatura, galeria clicável de paletas, histórico de tema e análise de contraste local sobre Mesh.
