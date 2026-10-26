# BRAND-001 — Identidade visual e ícones do mdress

**Estado:** identidade aprovada; integração web/PWA implementada; integração Tauri pendente.

[← Índice](../README.md) · [Guia de arquivos da marca](../../branding/README.md)

## Fonte de verdade

O [vetor mestre](../../branding/mdress.svg) preserva o M em fitas largas, as faces internas, a silhueta de vestido no espaço negativo e a seta separada à direita. A [versão do cabeçalho](../../app/assets/brand/mdress.svg) muda somente a área do `viewBox`, sem redesenhar os paths.

O brilho é um único recorte curvo compartilhado. Seu centro está alinhado ao início da ponta clara da seta. O alcance à esquerda tem compensação óptica de 10%; simetria matemática e equilíbrio visual não são a mesma propriedade. O eixo e a geometria aprovados não devem ser substituídos por contornos inferidos de uma renderização.

## Regras de apresentação

1. SVGs: cores sólidas, sem filtros, sombras, halos, degradês ou raster embutido.
2. PNGs de app: acabamento dimensional em roxo e lavanda; a textura não vira fonte geométrica.
3. Ícone: mantém identidade única nos temas claro e escuro; o editor pode continuar oferecendo ambos.
4. PWA: PNGs opacos quadrados; o sistema define a máscara. Declarar `any` e `maskable` separadamente, com composição própria para a zona segura do `maskable`.
5. Android: camadas de frente/fundo e versão monocromática separadas. Os arquivos preparados não equivalem a uma configuração nativa já integrada.
6. Interface: marca no cabeçalho e ícones de instalação não alteram a paleta dos documentos, os temas do editor ou os dados salvos.

Paleta de marca: primary `#7643d0`, secondary `#3d216e`, background `#f8f6fd`, accent `#a879ed`.

## Referências canônicas

- [Logo mestre](../../branding/mdress.svg).
- [App icon de desktop](../../branding/native/desktop/icon.png).
- [App icon quadrado, sem máscara](../../app/assets/icons/app-icon-1024.png).
- [Favicon PNG](../../app/assets/icons/favicon-32.png) e [alternativa SVG plana](../../app/assets/icons/favicon.svg).
- [Manifest PWA](../../app/manifest.webmanifest) e [cache offline](../../app/sw.js).
- [Fontes Android](../../branding/native/android/) e [fontes desktop](../../branding/native/desktop/).

## Validação

`npm run check` e `npm test` verificam o código existente. Os testes de identidade em [app-icons.test.mjs](../../tests/app-icons.test.mjs) conferem os caminhos, as dimensões reais dos PNGs, os propósitos do manifest e a cobertura do cache offline. Os recursos locais também foram verificados por HTTP com MIME de SVG e PNG.

As imagens e os links do README devem apontar para arquivos versionados neste repositório, sem links temporários de chat. A revisão geométrica por grid é um estudo de construção; não é certificação da Apple.
