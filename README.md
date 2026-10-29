# mdress

**Seu Markdown, bem vestido.**

Editor visual de Markdown com pré-visualização, personalização de estilos e exportação.

> **v0.1.0 — migração em andamento.** O snapshot original foi importado; a evolução de UX está no PR #27, empilhado no PR #4. Homologação humana e decisões de licença/escopo legado continuam pendentes antes da integração.

## Padrões de interface

Consulte [o catálogo de componentes e regras de UX](docs/component-patterns.md) antes de alterar formulários, controles, menus ou diálogos.

## Desenvolvimento

Requer Node.js 20+.

```bash
npm run dev
npm run check
npm test
```

O servidor local usa a porta 4173. Testes de navegador dependem do Playwright já disponível. Veja [evidências e comandos de homologação](docs/qa/issue-23/README.md) e [estado da migração](docs/migration-status.md).

## Governança

Todas as mudanças devem partir de uma issue, seguir por branch e PR, passar pelos checks obrigatórios e ter a branch removida após merge. Qualidade funcional não equivale à aprovação visual.

Consulte [a issue de importação](https://github.com/murilomattioli/mdress/issues/3) e [a issue de CI](https://github.com/murilomattioli/mdress/issues/1).

## Estado da importação

O repositório anterior é privado; esta nova base pública não inclui histórico Git. A publicação do snapshot só será considerada concluída após revisão de segurança, assets e testes.
