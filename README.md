# mdress

**Seu Markdown, bem vestido.**

Editor visual de Markdown com pré-visualização, personalização de estilos e exportação.

> **v0.1.0 — migração em andamento.** Este branch é um snapshot parcial de desenvolvimento e ainda não está pronto para merge ou release.

## Padrões de interface

Consulte [o catálogo de componentes e regras de UX](docs/component-patterns.md) antes de alterar formulários, controles, menus ou diálogos.

## Desenvolvimento

Requer Node.js 20+.

```bash
npm run dev
npm run check
npm test
```

O servidor local usa a porta 4173. Testes de navegador e auditoria de componentes dependem do Playwright e de uma importação completa dos assets.

## Governança

Todas as mudanças devem partir de uma issue, seguir por branch e PR, passar pelos checks obrigatórios e ter a branch removida após merge. Qualidade funcional não equivale à aprovação visual.

Consulte [a issue de importação](https://github.com/murilomattioli/mdress/issues/3) e [a issue de CI](https://github.com/murilomattioli/mdress/issues/1).

## Estado da importação

O repositório anterior é privado; esta nova base pública não inclui histórico Git. A publicação do snapshot só será considerada concluída após revisão de segurança, assets e testes.
