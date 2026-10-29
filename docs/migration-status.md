# Estado da migração — 29/10/2026

Destino exclusivo: `murilomattioli/mdress`. PR #27 → `chore/3-import-v0-snapshot`; PR #4 → `master`. Nenhum merge, release ou deploy realizado nesta rodada.

## Entregue para revisão

- Snapshot original de 120 arquivos importado; alterações locais preservadas em três commits temáticos e integradas ao remoto `0a0870c`.
- Inspetor reorganizado em Documento, Conteúdo, Página e Temas; controles compartilhados, cores com alpha, aparência por tipo/ocorrência, thumbnails, fontes Google sob demanda, alertas, toolbar e análise Markdown.
- Padrões em `component-patterns.md` e instruções em `AGENTS.md`.
- Verificação local: 171 testes Node; E2E; matriz 8 cenários/544 capturas/0 findings; galeria; QA de alertas, cores, controles e Google Fonts. Auditoria de componentes: 0 críticos, 24 avisos informativos de toolbar rolável.
- PDF: corrigida interação de CSS mobile com impressão; cinco perfis/cenários, quebra manual, títulos junto ao conteúdo e fluxo de seções verificados. Evidência renderizada em `qa/issue-23`.
- Proteções de master e exclusão automática pós-merge configuradas; ver `CI-GOVERNANCE.md`.

## Auditoria de publicação e privacidade

O scanner de arquivos rastreados não encontrou padrões conhecidos de credenciais. Markdown escapa HTML e restringe protocolos de links; estado é persistido localmente em IndexedDB/localStorage. Não foi identificado serviço de analytics ou backend LLM na aplicação. Fontes Google selecionadas fazem requisições a Google Fonts/gstatic; imagens remotas contidas no Markdown podem contatar seus respectivos hosts. Portanto, conteúdo externo e fontes não armazenadas em cache dependem de rede. Isso não equivale a auditoria jurídica ou certificação de segurança.

## Pendências explícitas

1. Homologação final do usuário, inclusive a matriz visual e fluxo real de exportação. Checks automáticos não aprovam UX.
2. Escolha de licença pelo titular. Não existe LICENSE; direitos de marca/assets devem ser preservados conforme essa decisão. Não atribuir licença por inferência.
3. F-013 incluída por autorização do usuário: estimador offline, contagem de seções/elementos, detalhes na aba Página e sorteio harmônico com orçamento. Fonte legada `060f320` e ajustes locais relacionados ao estimador foram lidos e portados; o legado não foi alterado. Calibração repetida em 24 PDFs reais. Licença continua deliberadamente pendente, conforme resposta do titular.
4. CI do commit publicado deve ser verificado antes de qualquer integração. PR #27 precisa integrar a base do PR #4 mediante autorização; PR #4 permanece draft até os critérios de migração e licença estarem resolvidos.

A migração não é declarada completa enquanto essas pendências existirem. Não excluir branches com PRs abertos nem importar histórico do repositório legado.
