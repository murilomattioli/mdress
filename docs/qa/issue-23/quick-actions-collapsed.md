# UX-023 — quick actions em galerias recolhidas

**Bug:** as ações Anterior/Próximo/Aleatório aparecem no cabeçalho de `.ds-accordion`, mas a galeria de origem fica em `.ds-accordion-body[hidden]` quando o painel está recolhido. Antes, `actionable()` bloqueava o clique por encontrar qualquer ancestral `[hidden]` da fonte, apesar de os botões permanecerem habilitados. Resultado: ações visíveis que não faziam nada, inclusive no estado inicial das galerias.

**Correção:** a visibilidade é verificada em ambas as árvores. Somente o `.ds-accordion-body[hidden]` da **mesma accordion** do grupo de ações é uma exceção; uma fonte em outro painel oculto, um ancestral `aria-hidden="true"`, uma subárvore explicitamente oculta ou o próprio cabeçalho indisponível continuam bloqueando a ação. Mudanças de permissão sincronizam `disabled` e preservam a transferência de foco.

**Regressão obrigatória:** `node scripts/choice-actions-qa.mjs` agora cobre uma fixture com cinco estados (colapsado navegável, `aria-hidden` explícito, restauração, ancestral `hidden` interno e restauração após reparenting) e as galerias reais nos temas Graphite e Studio em 1440px e 390px. O teste confirma que o preset muda **sem expandir** o accordion.

**Evidências:** `quick-collapsed-fixture-1024.png` e `quick-gallery-collapsed-{graphite,studio}-{1440,390}.png` são adicionadas a `test-results/ux-audit/` e ao artifact temporário do Browser Smoke. A revisão visual humana deve confirmar a legibilidade dos controles recolhidos, feedback de seleção e alvos de toque; testes verdes não homologam UX.

**PowerShell (sem merge):**

```powershell
git fetch origin
git switch feat/23-property-controls-ux-qa
git pull --ff-only origin feat/23-property-controls-ux-qa
npm install --include=dev
npx playwright install chromium
npm run dev
# Em outro PowerShell:
node scripts/choice-actions-qa.mjs
npm run qa:supervised
```

**Gate:** PR #27 permanece draft e issue #23 aberta até homologação visual/interativa explícita. Não publicar, fazer merge ou release.
