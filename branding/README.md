# mdress — Íris intensa

[← Projeto](../README.md) · [Especificação BRAND-001](../specs/BRAND-001/identity-and-app-icons.md)

<img src="mdress.svg" alt="Logo vetorial aprovada do mdress" width="144">
<img src="native/desktop/icon.png" alt="App icon mdress com acabamento dimensional em Íris intensa" width="224">

## Paleta aprovada

```json
{
  "primary": "#7643d0",
  "secondary": "#3d216e",
  "background": "#f8f6fd",
  "accent": "#a879ed"
}
```

## Fontes e acabamento

- [mdress.svg](mdress.svg) é o vetor mestre aprovado, com cores sólidas e sem filtros, sombras ou imagens embutidas.
- A [logo do cabeçalho](../app/assets/brand/mdress.svg) usa os mesmos paths com a área vazia recortada no `viewBox`.
- Os PNGs de app usam o acabamento dimensional aprovado, com reflexos roxos e fundo lavanda. O [PNG de 1024 px](native/desktop/icon.png) é a fonte raster para desktop; o [PNG quadrado de 1024 px](../app/assets/icons/app-icon-1024.png) é a fonte de app sem máscara de cantos.
- O brilho é um recorte no M e na seta, sem estrela branca sobreposta. O centro coincide com o início da ponta clara da seta. O alcance esquerdo tem compensação óptica de 10% em relação ao direito; não declarar simetria geométrica exata.
- Não há uma segunda versão de app icon com fundo dark: a identidade do ícone é independente do tema da interface.

## Web e PWA

| Uso | Arquivos | Aplicação |
| --- | --- | --- |
| Favicon PNG | [16](../app/assets/icons/favicon-16.png) · [32](../app/assets/icons/favicon-32.png) · [48 px](../app/assets/icons/favicon-48.png) | Favicons usados no HTML, com acabamento do app |
| Favicon SVG | [favicon.svg](../app/assets/icons/favicon.svg) | Alternativa vetorial plana para uso explícito |
| Apple Touch | [180 px](../app/assets/icons/apple-touch-icon-180.png) | Atalho iOS |
| PWA `any` | [192](../app/assets/icons/app-icon-192.png) · [512](../app/assets/icons/app-icon-512.png) · [1024 px](../app/assets/icons/app-icon-1024.png) | Fundo opaco, sem cantos recortados |
| PWA `maskable` | [192](../app/assets/icons/maskable-192.png) · [512 px](../app/assets/icons/maskable-512.png) | Margem própria para a máscara do sistema |

O [HTML](../app/index.html) usa os favicons PNG. O [manifest](../app/manifest.webmanifest) declara `any` e `maskable` separadamente. O [service worker](../app/sw.js) inclui a identidade visual no cache offline. Os caminhos são relativos para funcionar também quando o app é servido em um subdiretório.

## Fontes nativas

O repositório ainda não contém um projeto Tauri. [native/desktop/](native/desktop/) e [native/android/](native/android/) guardam os arquivos para essa integração.

- Desktop: [icon.png](native/desktop/icon.png) (1024), [32x32.png](native/desktop/32x32.png), [128x128.png](native/desktop/128x128.png) e [128x128@2x.png](native/desktop/128x128@2x.png). [mdress.svg](mdress.svg) é a fonte vetorial plana.
- Android: [foreground-432.png](native/android/foreground-432.png) transparente com acabamento dimensional, [background-432.png](native/android/background-432.png) opaco e [monochrome-432.png](native/android/monochrome-432.png) para ícones temáticos. Manter as camadas separadas e usar o recorte do sistema. Também há SVGs de [fundo](native/android/background.svg) e [monocromático](native/android/monochrome.svg).
- Windows: o bundle exige `icon.ico`, gerado a partir de `native/desktop/icon.png` pelo comando `tauri icon` quando o projeto nativo existir. Os arquivos de design desta entrega usam apenas SVG e PNG.

## Ao substituir um arquivo

Preservar a geometria mestre e os recortes; não usar uma renderização de IA como nova fonte de contornos. Atualizar as variantes necessárias e os links desta documentação. Se mudar uma imagem usada pelo app, atualizar o cache do service worker e verificar a instalação/offline. Não vincular uma prévia de grid ou um estudo antigo como logo oficial.
