# Issue #23 — evidências duráveis

> **Estado atual (30/10/2026):** a matriz UX-023 exige **91 estados × 2 temas × 4 larguras = 728 screenshots**. Os números menores abaixo são registros históricos de execuções anteriores, não o contrato vigente. A implementação e os testes automatizados não substituem a revisão visual/interativa do usuário. PR #27 continua draft, sem merge, release ou publicação.


Capturadas localmente em 29/10/2026, sobre a integração de `7d2688b`, `c341201`, `7e2e19f` e `0a0870c`. Documento sintético padrão; nenhum documento pessoal do usuário.

- [Desktop graphite, 1440 × 900](desktop-fonts.png): busca de fonte, painel e editor.
- [Mobile studio, 390 × 900](mobile-fonts.png): listbox dentro do viewport e foco visível.
- [PDF Soft Mesh](pdf-mesh.png): primeira página renderizada do PDF real, após corrigir a regra responsiva que ocultava o canvas na impressão com o inspetor aberto.

Estas três imagens foram inspecionadas pelo agente. Não representam aprovação humana das 544 capturas. A matriz automática completa passou em 8/8 cenários, sem findings, e está em `test-results/ux-audit/supervised/index.html` (gerada localmente, não versionada). Os artefatos de CI expiram em dois dias; estas imagens permanecem no Git.

## Reproduzir sem instalar dependências

Com Node e Playwright já disponíveis:

```powershell
$env:PORT='4174'
npm run dev
# Outro terminal:
$env:MDRESS_AUDIT_URL='http://127.0.0.1:4174'
npm run check
npm test
node scripts/e2e.mjs
node scripts/component-ux-audit.mjs
npm run qa:automatic
node scripts/ux-qa-gallery-smoke.mjs
npm run qa:supervised
```

No runner headed: ENTER avança, `m` permite intervenção no navegador, ENTER retoma, `q` interrompe sem aprovar. Para não sobrescrever outra sessão, configure `MDRESS_QA_DIRECTORY` e `MDRESS_QA_REPORT`. Exporte a revisão na galeria e use `npm run qa:resume-review -- CAMINHO_DO_JSON` para retomar a homologação vinculada às capturas.

`node scripts/pdf-quality.mjs` requer `pdfinfo` e `pdftotext` existentes. Alternativamente, `MDRESS_PDF_PYTHON` pode apontar para um Python existente com pypdf, sem instalação. A suíte verifica texto extraível, tamanho, paginação física, títulos/primeiro parágrafo e quebras explícitas; não certifica acessibilidade PDF/UA.

## F-013 — peso e sorteio harmônico

Integração de 29/10/2026: [desktop](pdf-weight-1440.png), [mobile](pdf-weight-390.png), [24 medições reais](pdf-weight-calibration.json). Capturas inspecionadas pelo agente; homologação do usuário pendente. `npm run qa:pdf-weight` valida abertura do detalhe, largura, alteração de custo ao aplicar Glass e persistência após recarregar. `node scripts/pdf-weight-calibrate.mjs` gera a calibração sob demanda. Ambos aceitam `MDRESS_AUDIT_URL`.

## UX-023 — troca de Color Picker e foco assíncrono (30/10/2026)

O Color Picker não pode devolver o foco ao campo anterior quando outro seletor já está aberto. Cada instância possui IDs próprios para tabs, painéis e erros durante o fechamento assíncrono. O gate Chromium cobre Destaque → Texto → Destaque em 1440/768/390/320px, com capturas `switch-text-*.png` e `switch-back-*.png`. A matriz supervisionada exige **83 estados × 2 temas × 4 larguras = 664 capturas**. Checks verdes não substituem a revisão visual humana.


### Conta-gotas inline e amostras obsoletas
A captura nativa no inspetor mantém o foco do botão durante a espera e usa `aria-busy`/`aria-disabled`, sem abrir requisições concorrentes. Desabilitar/reabilitar a origem ou alterar a cor invalida a amostra pendente; respostas antigas não sobrescrevem edições recentes. O botão tem alvo de toque de 44px no mobile. A matriz supervisionada inclui três estados de foco, cancelamento e amostra obsoleta, sem homologação automática.


## UX-023 — slider auxiliar e rascunhos inválidos (30/10/2026)

Scrub desabilitado durante edição numérica inválida ou vazia, com posição anterior preservada e reativação após Escape/correção. E2E Chromium e matriz supervisionada exigem **86 estados × 2 temas × 4 larguras = 688 capturas**. Revisão visual humana continua obrigatória.
