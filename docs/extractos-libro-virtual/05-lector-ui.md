# 05 — BookReader (UI y estado)

Fuente: `src/components/library/book-reader.tsx`. Componente cliente. Sin hooks custom: `useState` / `useEffect` / `useCallback`.

## Props (contrato)

Ver tabla en [`00-LEEME.md`](00-LEEME.md). Lo importante al portar:

- `pages` llega del store (estimado o ya packed).
- `onDomPacked` es **responsabilidad de la app**, no del lector.
- `compact` achica cantos y padding (CSS `.book-compact`). Podés omitirlo.

## Estado local

```ts
livePages          // lo que se pinta; se reemplaza tras el pack
pagesProp          // para detectar cambio de la prop `pages` en render (no effect)
preparing          // overlay + bloquea teclado/slider
currentPage        // siempre par (clampToSpreadStart)
settings           // { fontSize: 16, fontFamily, theme }
panel              // "toc" | "settings" | "search" | null
searchQuery / searchResults
justBookmarked     // flash 1.5s del icono
```

Sincronía prop → estado **en el render**, no en effect:

```ts
if (pages !== pagesProp) {
  setPagesProp(pages);
  setLivePages(pages);
  if (pages.length === 0) setPreparing(false);
}
```

`safePage = clampToSpreadStart(currentPage, totalPageCount)` también se calcula **en el render**. Si el pack achica el libro, no quedás en un índice inválido.

## Pack (cuándo)

`preparing` arranca `true` si hay páginas y (`needsDomPack(pipelineVersion)` o no hay `packMetrics`). El effect de pack está detallado en [`02-pipeline.md`](02-pipeline.md).

Refs: `leftBodyRef` / `rightBodyRef` sobre `.book-page-body`. El pack las necesita montadas; por eso el overlay cubre el libro **sin desmontar** las hojas.

## Navegación

```ts
const [leftPage, rightPage] = pagesForSpread(displayPages, spreadIdx);

const goToPage = (page) => {
  const clamped = clampToSpreadStart(page, totalPageCount);
  setCurrentPage(clamped);
  onPageChange?.(clamped, percent);
};

const goNextSpread = () => goToPage(spreadIdx * 2 + 2);
const goPrevSpread = () => goToPage(spreadIdx * 2 - 2);
```

Teclado (mientras `!preparing`):

| Tecla | Acción |
|---|---|
| `ArrowRight` o `Space` | Siguiente pliego |
| `ArrowLeft` | Pliego anterior |

Chevrons **fuera** del marco (`.book-nav-prev` / `.book-nav-next`). No hay swipe ni animación.

Slider: `min=0`, `max=totalSpreads-1`, `value=spreadIdx`, `onChange → goToPage(value * 2)`. Label: `{hojaVisible} de {total}` (1-based para el humano).

## Chrome del libro

Estructura JSX (simplificada):

```
.reader-shell
  .book-reader-stage
    header.book-external-title          // título + autor FUERA del papel
    .book-frame
      overlay “Preparando páginas…”     // si preparing
      .book-block.reader-light|.reader-sepia.reader-serif
        .book-edge.book-edge-left
        .book-spread
          .book-spine
          .book-chrome-header           // TOC, AA, estrella, bookmark, search
          .book-page.book-page-left
            .book-page-body → PageContent
            .page-curl.page-curl-left
          .book-page.book-page-right
            .book-page-body → PageContent
            .page-curl.page-curl-right
          .book-progress                // range + “N de M”
          paneles absolutos (toc / settings / search)
        .book-edge.book-edge-right
      botones nav prev/next
```

- Título/autor van **arriba del marco**, no en la hoja (la hoja 0 a veces también tiene el título del libro como `TextBlock`).
- La estrella (`Star`) **no tiene handler**. El bookmark sí, si pasás `onBookmark`.
- Paneles: un toggle; el mismo botón cierra. TOC llama `goToPage(item.pageNumber)`.

## Búsqueda

Plain text sobre `page.content.toLowerCase()`. Resultados = `pageNumber[]`. Se muestran hasta 12 botones “Pág. N”. No hay highlight dentro de la hoja.

## Settings

- Tamaño: disabled, 16px. Texto: “Fijado en 16px (mismo tamaño con el que se arman las páginas)”.
- Familia: `serif` (Literata, clase `reader-serif`) / `sans` (default del app).
- Tema: `light` / `sepia` (clases `reader-light` / `reader-sepia` sobre `.book-block`).

## TOC display

```ts
const rebuilt = extractTOC(displayPages);
return rebuilt.length > 0 ? rebuilt : tableOfContents;
```

Si portás TOC de EPUB, cambiá esto a: **usar `tableOfContents` si viene no vacío**; si no, `extractTOC`. Si no, el heurístico pisa el nav de Gutenberg.

## Banner legado

`hasLegacyPaginationBug` detecta un bug viejo (frases que se repiten creciendo). No aplica a EPUB nuevo. `legacyWarning` es prop de esta app.

## Dependencias de UI

- `lucide-react`: chevrons, bookmark, search, list, x, star.
- `@/components/ui/input` para el buscador (cualquier `<input>` sirve).
- `cn` para clases. Reemplazable por `clsx` o template strings.

No hay PDF.js, no hay canvas, no hay librería de flip.
