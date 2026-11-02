# UX-023 — quick actions em galerias recolhidas

**Bug:** as ações Anterior/Próximo/Aleatório aparecem no cabeçalho de `.ds-accordion`, mas a galeria de origem fica em `.ds-accordion-body[hidden]` quando o painel está recolhido. Antes, `actionable()` bloqueava o clique por encontrar qualquer ancestral `[hidden]` da fonte, apesar de os botões permanecerem habilitados. Resultado: ações visíveis que não faziam nada, inclusive no estado inicial das galerias.

**Correção:** a visibilidade é verificada em ambas as árvores. Somente o `.ds-accordion-body[hidden]` da **mesma accordion** do grupo de ações é uma exceção; uma fonte em outro painel oculto, um ancestral `aria-hidden="true"`, uma subárvore explicitamente oculta ou o próprio cabeçalho indisponível continuam bloqueando a ação. Mudanças de permissão sincronizam `disabled` e preservam a transferência de foco.

**Regressão obrigatória:** `node scripts/choice-actions-qa.mjs` agora cobre uma fixture com cinco estados (colapsado navegável, `aria-hidden` explícito, restauração, ancestral `hidden` interno e restauração após reparenting) e as galerias reais nos temas Graphite e Studio em 1440px e 390px. O teste confirma que o preset muda **sem expandir** o accordion.

**Evidências:** `quick-collapsed-fixture-1024.png` e `quick-gallery-collapsed-{graphite,studio}-{1440,390}.png` são adicionadas a `test-results/ux-audit/` e ao artifact temporário do Browser Smoke. A revisão visual humana deve confirmar a legibilidade dos controles recolhidos, feedback de seleção e alvos de toque; testes verdes não homologam UX.

**Regressão adicional — ocultação direta e CSS:** além do accordion recolhido, o botão deve ficar indisponível quando a **própria galeria** recebe `hidden`, `aria-hidden="true"`, `display:none` ou `visibility:hidden`, ou quando um ancestral usa `content-visibility:hidden`. A remoção da restrição deve restaurar a ação sem remontagem. O `aria-hidden="true"` do `select` nativo aprimorado é intencional: seu trigger customizado é o controle acessível e as quick actions continuam operacionais. O teste Chromium cobre esses estados e gera `quick-direct-source-hidden-1024.png`. Esses cenários não substituem a revisão humana das capturas.

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

**Regressão de ancestrais ocultos por CSS (02/11/2026):** um wrapper intermediário com `display:none` ou `visibility:hidden` deve desabilitar imediatamente Anterior/Próximo/Aleatório, inclusive quando o corpo do accordion já está recolhido. O `display:none` causado somente por `[hidden]` no corpo do mesmo accordion permanece permitido; uma restrição `style.display='none'` aplicada explicitamente ao corpo não é isenta. A restauração do estilo reabilita as ações sem remontagem. `choice-actions-qa.mjs` valida cliques sintéticos e `disabled` antes/depois da mutação; a revisão visual humana continua obrigatória.
