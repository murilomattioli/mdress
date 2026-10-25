# mdress — Governança e orçamento de CI

Issue → branch → PR → checks → revisão → merge → exclusão da branch.

## Regras
- Nenhum commit direto em master. Ativar branch protection e exigir `quality-gate` quando a configuração estiver disponível.
- Todo PR deve vincular uma issue; fechar apenas depois da entrega completa.
- Exclusão automática de branches após merge deve ser habilitada nas configurações do repositório.
- Um relatório canônico de UX por execução/PR; sem abertura de issues duplicadas.
- Testes funcionais verdes não certificam UX. Capturas precisam de revisão visual.
- Nenhum release enquanto houver P0 de UI aberta.

## Otimização
- Workflows apenas em pull_request (sem duplicação por push).
- Concurrency cancela execuções obsoletas do mesmo PR.
- Quality gate único e estável; verificações pesadas só quando arquivos relevantes mudam.
- Timeouts curtos, dependências via cache e sem actions/upload-artifact por padrão.
- Browser Smoke contém Component UX Audit no mesmo runner para não instalar Chromium duas vezes.
- Evidências visuais: publicar em comentário único no PR por workflow com permissões isoladas, em entrega posterior. Não declarar publicação implementada antes de validar.
- Evitar cron diário até medir consumo e cobertura; usar workflow_dispatch inicialmente.

## Migração
O novo repositório é público e o legado é privado. Auditar segredos e licenças antes de importar o snapshot da v0.1.0. Não importar histórico Git.
