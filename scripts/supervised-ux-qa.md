# UX-023 — revisão supervisionada do inspetor e toolbar

O runner automatiza as interações e gera evidências, **não aprova a UX visual**. A revisão humana das capturas e dos estados interativos continua obrigatória antes de qualquer merge ou publicação.

## Preparar uma instalação nova (PowerShell)

```powershell
cd F:\\Projects\\lumu\\tools\\mdress
git status --short # preserve alterações locais antes de trocar de branch
git fetch origin
git switch feat/23-property-controls-ux-qa
git pull --ff-only origin feat/23-property-controls-ux-qa
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

Abra um segundo terminal na mesma pasta:

```powershell
pnpm qa:supervised
```

**Enter** avança ao próximo checkpoint, **m** libera o navegador para intervenção manual e **q** interrompe o ciclo com código de saída não zero. A auditoria salva as capturas em `test-results/ux-audit/supervised/` e o relatório em `test-results/supervised-ux-qa.json` (ignorados pelo Git). Se o servidor usar outra porta, configure `$env:MDRESS_AUDIT_URL='http://127.0.0.1:4174'` antes de executar o runner.

## Execução automática (CI ou terminal)

```powershell
pnpm qa:automatic
```

O CI executa Chromium headless, sem interação humana. Checks verdes indicam apenas que as assertivas automatizadas passaram. Avalie screenshots de foco, erros, controles desabilitados, overflow e legibilidade em todos os tamanhos testados. Registre problemas na issue #23, com tema, largura e estado. Não faça merge antes da homologação.
