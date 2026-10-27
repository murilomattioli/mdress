# SDD — Document Design, AI Theme Agent e Fundos de PDF

Status: contrato proposto para implementação incremental. É uma extensão de F-007 e F-009; não comprova conformidade do PDF.

## Objetivo
O produto estiliza **documentos Markdown** e gera PDFs. A aparência do app é uma preferência global em Configurações e **não** modifica o PDF. O tema do documento pertence ao próprio documento e é editado ao lado do preview (Design > Temas / Tipografia / Página / Fundo / Avançado / IA). O Markdown permanece byte a byte intacto.

## Fluxo
1. Criar documento (em branco, starter ou importação MD): escolher preset inicial opcional.
2. Editor Markdown e prévia lado a lado.
3. Na prévia, selecionar **Design** abre um inspector contextual. A troca de preset reflete no preview e na impressão; configurar tema não abre rota global.
4. Tema pode ser duplicado, salvo como novo preset local, compartilhado por código/JSON e reutilizado em outros documentos.
5. **Criar com IA**: escrever briefing, enviar somente briefing + versão do schema + tema base para um provedor LLM autorizado (nenhum dado do currículo por padrão), receber JSON, validar, aplicar como prévia temporária, aprovar ou descartar. Não persistir sem confirmação.
6. Exportar: escolher **Visual** ou **Legibilidade/ATS**; nenhuma opção pode rasterizar texto. Verificar o PDF após gerar antes de declarar ATS-safe.

## Contrato de tema v2 (proposta)
- metadata: id, name, description, version, author opcional, source=manual|import|agent
- typography: fontFamily (whitelist/offline), bodySizePt, lineHeight, weights, headingScale, letterSpacing
- colors: page, text, secondaryText, accent, divider, link
- page: A4/Letter, margens em mm, bleed (visual opcional), orientation
- layout: sectionGap, itemGap, alignment, headingDecoration, headerStyle, separators, listIndent, columnPolicy
- backgrounds: solid, linear-gradient, radial-gradient, pattern-vector (dots/lines/grid), image
- layers: background, ornaments, content; preservar o texto na camada de conteúdo
- exportPolicy: qualityMode, includeBackground, ATS simplification, image compression/maxBytes

Schema rejeita CSS/JS/HTML arbitrários, URL remota e chaves inesperadas. Migração sem perda dos temas RST1 legados. Imagens devem ser locais/importadas, com limites de tamanho, dimensão e processamento; jamais aceitar SVG não sanitizado. O agente não recebe código executável nem escreve arquivos sem autorização.

## Fundo do PDF: capacidades e trade-offs
| Tipo | Peso esperado | Compatibilidade |
|---|---|---|
| Cor sólida | muito pequeno | alto; atenção ao consumo de tinta/contraste |
| Formas vetoriais / linhas | baixo | alto com PDF vetorial |
| Gradientes | geralmente baixo, mas depende do renderer | verificar flattening/transparência |
| Padrão procedural/vector | baixo/moderado | monitorar complexidade e quantidade de objetos |
| Foto/imagem de fundo | moderado/alto | compressão e limites obrigatórios |
| PDF rasterizado integral | proibido | destrói texto selecionável/pesquisável |

Fundo é **decoração** e, quando exportador suportar Tagged PDF, deve ser marcado como Artifact fora da ordem lógica. Texto do currículo: Unicode recuperável, texto selecionável e pesquisável, links funcionais, hierarquia e ordem de leitura. Um PDF bonito não garante parsing correto.

No fluxo atual de window.print(), print-color-adjust: exact não obriga o navegador a imprimir fundos. O usuário pode precisar habilitar gráficos de fundo. Exigimos aviso e auditoria do PDF final antes de prometer correspondência perfeita.

### Orçamentos *iniciais* (não garantias)
- ideal texto+vetor: menor que 500 KiB, aviso acima de 500 KiB;
- foto opcional: exibir estimativa; tentar redução de pixels, JPEG/WebP fonte onde aplicável, compressão compatível;
- atenção a fontes incorporadas e transformações que rasterizem elementos;
- rejeitar arte que incorpore informação essencial como pixel.

### Validações obrigatórias
T-01 Exportar fundo vetorial + texto e obter texto completo via extrator.
T-02 Garantir ordem lógica, links e Unicode no PDF final.
T-03 Comparar PDF Visual vs PDF Legibilidade (conteúdo semântico igual).
T-04 Medir tamanho do PDF e apontar principais recursos.
T-05 Testar backgrounds em Chromium/PWA/Tauri; avisar sobre configurações de impressão quando necessário.
T-06 Exportar com texto escuro/claro e verificar contraste.
T-07 Verificar que decorativos não aparecem na árvore de leitura quando Tagged PDF disponível.
T-08 Rejeitar JSON AI com scripts, CSS arbitrary, URLs e props fora de schema.
T-09 LLM erro/timeout/offline → editor continua operacional sem perda; revisão manual.
T-10 Recusar envio de dados pessoais do currículo sem consentimento explícito.

## ADR
A IA trabalha com **schema de apresentação**, não HTML. A separação App Appearance ≠ Document Design ≠ Export Profile é uma invariante arquitetural. Implementação por etapas: primeiro UI e edição semântica, depois bridge LLM, depois renderizador PDF estruturado com verificação independente.
