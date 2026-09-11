# 01 — Modelo de datos

Todo el lector gira alrededor de tres tipos. Si la otra app produce este JSON, el UI funciona sin saber si la fuente fue PDF o EPUB.

Fuente: `src/lib/pdf/paginator.ts` líneas 1–78.

## TextBlock

Un bloque es una unidad visual atómica: un título, un encabezado, un ítem de índice, o un párrafo. El paginador **no parte** títulos/encabezados/ítems; solo parte `paragraph` si no cabe en la hoja.

```ts
export type TextBlockStyle = "title" | "subtitle" | "list-item" | "heading" | "paragraph";

export interface TextBlock {
  style: TextBlockStyle;
  text: string;
  align?: "left" | "center" | "right";
  fontSize?: number;
  /** True when this block continues a paragraph split across a page break. */
  continued?: boolean;
}
```

| Campo | Para qué |
|---|---|
| `style` | Elige clase CSS y tamaño (`book-title`, `book-para`, …). Ver [`06-bloques-html.md`](06-bloques-html.md). |
| `text` | Texto plano. Sin HTML embebido. |
| `align` | Opcional. El CSS ya centra títulos/headings; úsalo si el EPUB trae `text-align`. |
| `fontSize` | Casi no se usa. El lector fija **16px** para que el pack coincida con lo medido. |
| `continued` | El párrafo empezó en la hoja anterior. El CSS **quita la sangría** (`.book-para-continued`). |

`continued` existe porque un párrafo largo se corta a mitad de frase. Si no marcaras el segundo trozo, el lector lo indentaría como párrafo nuevo y se vería un salto raro (rompe G3).

## PaginatedPage

Una hoja del pliego. `pageNumber` es **0-based**. Páginas pares = izquierda; impares = derecha.

```ts
export interface PaginatedPage {
  pageNumber: number;
  /** Plain-text fallback for search and legacy books. */
  content: string;
  blocks?: TextBlock[];
}
```

- `blocks` es la fuente de verdad para pintar.
- `content` es el mismo texto concatenado: sirve para **buscar** (`includes`) y para libros viejos sin `blocks`.
- Si `blocks` falta, `getPageBlocks` reconstruye desde `content` (legado). En código nuevo, **siempre** guardá `blocks`.

## TOCItem

```ts
export interface TOCItem {
  title: string;
  pageNumber: number;
}
```

`pageNumber` apunta a una hoja del libro virtual (después del pack), no al folio del EPUB. El lector clampa a inicio de pliego (`clampToSpreadStart`).

En esta app el TOC se **infiere** del texto (`extractTOC`). En Gutenberg hay TOC nativo (`nav.xhtml` / `toc.ncx`): usalo. Después del pack DOM hay que **remapear** cada entrada al `pageNumber` de la hoja que contiene ese título.

## PackMetrics

Viewport con el que se empaquetaron las páginas. Si el lector se abre en otra pantalla y el tamaño cambió >10%, se vuelve a empaquetar.

```ts
export type PackMetrics = {
  widthPx: number;
  leftHeightPx: number;
  rightHeightPx: number;
  fontSize: number;
};

export const PACK_VIEWPORT_TOLERANCE = 0.1;

export function packMetricsStale(
  stored: PackMetrics | null | undefined,
  current: PackMetrics
): boolean {
  if (!stored?.leftHeightPx || !stored.widthPx) return true;
  const h =
    Math.abs(current.leftHeightPx - stored.leftHeightPx) / stored.leftHeightPx;
  const w = Math.abs(current.widthPx - stored.widthPx) / stored.widthPx;
  return h > PACK_VIEWPORT_TOLERANCE || w > PACK_VIEWPORT_TOLERANCE;
}
```

`leftHeightPx` / `rightHeightPx` son el `clientHeight` de `.book-page-body` (incluye padding). La hoja izquierda es un poco más baja porque el chrome del título come espacio; por eso hay dos alturas, no una.

## Versiones de pipeline

```ts
export const PIPELINE_VERSION = 12;           // pack DOM hecho
export const ESTIMATED_PIPELINE_VERSION = 7;  // estimado de servidor

export function needsDomPack(pipelineVersion: number): boolean {
  return pipelineVersion > 0 && pipelineVersion < PIPELINE_VERSION;
}
```

- `7` = páginas calculadas con presupuesto de líneas. Se ven, pero pueden quedar huecos o cortes.
- `12` = empaquetadas midiendo el DOM real (Literata + CSS del lector).
- Cualquier `version` en `(0, 12)` dispara pack al abrir.

`MAX_STORED_PAGES = 1500` es un techo de JSON. Gutenberg cabe; no copies el techo si no lo necesitás.

## Settings del lector (UI, no persistencia de páginas)

```ts
// src/lib/types/database.ts — líneas 241–245
export interface ReaderSettings {
  fontSize: number;
  fontFamily: "serif" | "sans";
  theme: "light" | "sepia";
}
```

`fontSize` está **fijado a 16** en la UI. Cambiar el tamaño invalidaría el pack (el texto ya no cabe en las mismas hojas). Serif/sans y light/sepia sí se pueden cambiar: no alteran la altura de forma que rompa el overflow-probe si el pack usó las mismas clases.

## Contrato de salida del adaptador EPUB

La otra app debe producir esto y nada más:

```ts
{
  blocks: TextBlock[];          // orden de lectura del spine
  toc?: { title: string; href: string }[];  // anclas EPUB; se remapean a pageNumber tras el pack
}
```

Luego `paginateBlocksByLines(blocks)` → `PaginatedPage[]`. No inventes otro shape.
