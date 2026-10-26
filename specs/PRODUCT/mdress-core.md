# mdress — Core de publicação Markdown

**Tagline:** Seu Markdown, bem vestido.

## Enquadramento correto

mdress é uma ferramenta de edição, composição e exportação de documentos Markdown genéricos. O usuário não precisa fornecer nome, cargo, experiências ou currículo para começar. Exemplos: artigo, documentação, README, proposta, relatório, portfólio, documentação de produtos, material didático e currículo opcional. O conteúdo permanece editável em Markdown e o PDF é uma representação textual estilizada.

### Separação de conceitos

- Conteúdo: Markdown puro, importável e exportável sem tags de apresentação embutidas
- Documento: título, conteúdo, aparência, preferências de paginação e metadados adicionais
- Visualização: HTML semântico paginado e preservando texto selecionável
- Tema: presets, cores, fundo CSS, tipografia, espaçamentos e travas de randomização
- App: Design System do editor, independente do conteúdo e dos estilos PDF
- Publicação: PDF/Markdown/backup com opções transparentes e requisitos de legibilidade
- Análise: estrutura genérica de Markdown; ATS não é fluxo obrigatório

### Quebras de página por seção

- Regra explícita breakBefore associada a identificador de título (nível, conteúdo normalizado, ocorrência)
- Configurável no preview, no outline do editor e no inspector Página
- Salva como metadado pagination, não inserida no Markdown
- Preservada na duplicação e nos backups mdress; importação aceita backups legados
- A próxima seção ocupa nova página física; não criar folha vazia se a página atual ainda estiver vazia
- IDs que perdem correspondência ao renomear títulos são sinalizados; não aplicar em seção diferente silenciosamente

### Descoberta visual

- Galeria editorial com exemplos visuais, sem tela vazia como ponto de partida
- Randomização por receitas com 4 travas: paleta, tipografia, espaçamento e fundo
- A combinação deve continuar com contraste normal de texto recomendado de no mínimo 4,5:1 em superfícies sólidas
- Direções de IA de um clique preenchem o briefing; não afirmar que há provedor LLM conectado

### Identidade visual

A identidade aprovada usa Íris intensa e mantém o M em fitas, o vestido no espaço negativo e a seta externa com recorte compartilhado do brilho. SVGs são planos; PNGs de app têm acabamento dimensional. A marca não determina o tema do editor nem dos documentos. Fontes, variantes e regras estão em [BRAND-001](../BRAND-001/identity-and-app-icons.md) e no [guia da marca](../../branding/README.md).

### Compatibilidade

O banco IndexedDB permanece temporariamente no identificador legado resume-studio para não perder documentos existentes. O identificador de backup exportado passa a mdress-backup; importações aceitam tanto ele quanto resume-studio-backup. O URL do repositório não é alterado automaticamente. IDs internos históricos poderão ser migrados separadamente sem ruptura.

### Lacunas

Renderização ainda parcial frente a CommonMark/GFM; SourceMaps Markdown incompletos; títulos repetidos podem mudar de âncora após reordenação e regras podem ficar órfãs. Integração com LLM requer provedor e política explícita de privacidade. Não prometer certificação ATS ou PDF/A.
