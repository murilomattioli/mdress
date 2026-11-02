# mdress — instruções de interface

Antes de modificar UI, leia [docs/component-patterns.md](docs/component-patterns.md). Ele define os componentes compartilhados, dimensões, estados, ordem das ações e critérios de verificação aprovados como direção nesta conversa.

- Reutilize os componentes de `app/design-system`; não recrie selects, pickers, confirmações ou ações de accordion em cada tela.
- Não use confirm/prompt/alert do navegador, select nativo visível ou caracteres como substitutos de ícones.
- Preserve a separação entre a interface e os estilos do documento/PDF.
- Verifique alterações de layout por renderização e screenshot no container real, além dos testes relevantes.
- Não instale dependências. Commit e push somente quando solicitados. Preserve alterações locais existentes.
- Comunicação em pt-BR; commits, quando autorizados, em inglês com gitmoji e sem trailers de coautoria.
