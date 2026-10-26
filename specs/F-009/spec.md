# F-009 — Exportação PDF & verificação

Status: **implementação incremental**. Exportação no aplicativo ainda utiliza diálogo de impressão do navegador. O pipeline automatizado do CI gera PDFs Chromium reais e mede texto, tamanho, páginas e links; não equivale a garantir compatibilidade com qualquer ATS.

## Produto
- Fonte de verdade: Markdown original, renderizado como elementos HTML textuais.
- Documento deve poder ser salvo usando o navegador em PDF Visual ou Leitura automatizada.
- **Visual**: preserva tema de documento, cores e fundo opcional (incluindo mesh).
- **Leitura automatizada**: remove fundo decorativo e força texto escuro em papel branco.
- Nunca rasterizar texto por escolha do app; não embutir o documento como screenshot.
- A aparência do site não interfere no documento exportado.
- Conteúdo idêntico nos dois perfis; mudanças de CSS não podem reescrever Markdown.
- Em qualquer perfil, mostrar claramente as limitações de print-color-adjust e a necessidade de selecionar Salvar como PDF.

## Contratos
`resolvePDFExport({profile:"visual"|"readable",includeBackground:boolean})` valida argumentos, resolve incompatibilidades e não permite CSS arbitrário. `configurePDFPrint(body, options)` define flags de impressão; `clearPDFPrint(body)` restaura o estado ao terminar. CSS de impressão deve ignorar o modo de workspace (Editar/Dividido/Visualizar), esconder interface e inspector, aplicar dimensões A4/Letter e evitar cortes conhecidos.

## Quality Gate em CI
Gerar PDF Chromium (Playwright `page.pdf({preferCSSPageSize:true,printBackground:true,tagged:true})`) a partir do app real, usar `pdftotext` para leitura independente e `pdfinfo` para tamanho/páginas; comparar conteúdo extraído, links e Unicode:
- F009-01 PDF Visual em tema minimal mantém texto selecionável.
- F009-02 PDF Visual com Mesh mantém texto selecionável.
- F009-03 PDF de Leitura com Mesh remove decoração sem excluir texto.
- F009-04 Documento longo resulta em múltiplas páginas; primeiro e último trechos preservados.
- F009-05 Medir bytes por cenário, registrar variação entre visual e sem fundo.
- F009-06 Não gerar páginas em branco extras; verificar A4/Letter.
- F009-07 Links mantidos e URLs sem JS.
- F009-08 Preview/app theme permanece independente de export profile.
- F009-09 Nenhum aviso afirmar certificação ATS.

## Orçamentos orientativos (não garantias)
- Meta texto simples e vetorial: < 500 KiB, sujeito ao renderer e fontes.
- Avisar ao ultrapassar 500 KiB; não falhar automaticamente por usar mesh.
- Limite de segurança no CI: 5 MiB para um documento de teste pequeno (evita regressões grosseiras).
- Compatibilidade ATS real exige amostras de parsers externos; tagged PDF e text extraction não garantem parsing semântico.

## Pendências para uma engine PDF completa
- Gerar/download PDF programaticamente no navegador sem depender da janela de impressão.
- Compartilhar PagePlan determinístico entre preview e exportação.
- Verificar o PDF selecionado pelo usuário localmente (tamanho, conteúdo, ordem e assets).
- Medir rasterização interna, embedding/subsetting de fontes, contrast ratio e compatibilidade por browser.
- Mapear decorações de PDF como artifacts em uma estrutura Tagged PDF.
- Exportar comparativo visual pixel-diff em formatos A4/Letter sem clipping.
