# mdress — Governança e orçamento de CI

Fluxo obrigatório: issue no **mdress** → branch → PR pequeno → checks → revisão → merge → exclusão da branch, quando possível.

Este documento consolida a política iniciada no [PR #2](https://github.com/murilomattioli/mdress/pull/2). O acompanhamento de critérios pendentes permanece na [issue #1](https://github.com/murilomattioli/mdress/issues/1); a migração v0.1.0 é acompanhada na [issue #3](https://github.com/murilomattioli/mdress/issues/3).

## Regras de integração

- Não fazer commits diretamente na `master`. A proteção da branch e a exigência de `quality-gate` precisam ser **configuradas e verificadas**; um workflow verde, sozinho, não impede merge manual.
- Cada PR deve referenciar uma issue existente. Fechar a issue apenas após todos os critérios de aceite e a limpeza da branch.
- Habilitar exclusão automática de branches após merge; enquanto não estiver disponível, registrar a limpeza pendente.
- Manter um único acompanhamento canônico de UX, sem issues ou relatórios duplicados.
- Testes funcionais e auditorias automáticas verdes **não** aprovam a UX. Screenshots exigem revisão visual humana ou visual efetivamente realizada e documentada.
- Não criar release final enquanto houver bloqueios críticos de UX ou de segurança/licenças.

## Workflows presentes na branch de migração

- `Quality`: executa em PRs para `master` e `chore/3-import-v0-snapshot`. `changes` filtra caminhos relevantes; `quality` executa checks, testes e auditoria de credenciais quando aplicável; `quality-gate` é um job estável, inclusive para PRs apenas de documentação.
- `Browser Smoke`: executa em PRs com mudanças relevantes e pode ser iniciado manualmente. Executa E2E e Component UX Audit no mesmo runner. Capturas permanecem locais ao runner; **não há publicação automática das imagens para revisão visual**.
- Ambos utilizam `concurrency` para cancelar execuções anteriores do mesmo PR, sem gatilho `push` duplicado. Os timeouts são limitados.
- As dependências do GitHub Actions estão fixadas em SHAs; o Playwright é instalado na execução. **Não declarar cache npm ou lockfile como implementados** sem verificá-los.

## Evidências e segurança

- A revisão visual deve identificar o commit, os tamanhos de viewport, os temas testados e a decisão sobre cada problema crítico/aviso relevante.
- Publicar screenshots em um comentário único por PR, com permissões isoladas e sem depender de retenção prolongada de Actions Artifacts, continua sendo uma **entrega futura**, não uma capacidade atual.
- A auditoria `scripts/publication-audit.mjs` identifica apenas padrões conhecidos de credenciais em arquivos de texto rastreados. Não substitui revisão de privacidade, dependências, direitos autorais ou licenças.

## Migração v0.1.0

O repositório legado serve apenas como referência histórica; não importar seu histórico Git nem tratar seus IDs de issues/PRs como IDs do mdress. A importação e a publicação final são etapas diferentes. O PR de migração deve permanecer em draft enquanto os bloqueios da [issue #3](https://github.com/murilomattioli/mdress/issues/3) não forem resolvidos.
