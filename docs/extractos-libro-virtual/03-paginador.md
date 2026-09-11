# 03 — Paginador y spreads

`src/lib/pdf/paginator.ts` tiene ~800 líneas. No copies el archivo entero. Estas funciones son las que el lector y el pack usan de verdad.

## Spreads (pliego de dos hojas)

La navegación **nunca** deja `currentPage` impar. Un marcador o un progreso siempre apunta al inicio del pliego (página izquierda).

```ts
// paginator.ts — líneas 797–823
export function spreadIndex(currentPage: number): number {
  return Math.floor(currentPage / 2);
}

export function pagesForSpread(
  pages: PaginatedPage[],
  spreadIndex: number
): [PaginatedPage | null, PaginatedPage | null] {
  const left = pages[spreadIndex * 2] ?? null;
  const right = pages[spreadIndex * 2 + 1] ?? null;
  return [left, right];
}

export function totalSpreads(totalPages: number): number {
  return Math.ceil(totalPages / 2);
}

export function clampToSpreadStart(page: number, totalPages: number): number {
  if (totalPages <= 0) return 0;
  const even = Math.floor(Math.max(0, page) / 2) * 2;
  const maxEven = Math.floor((totalPages - 1) / 2) * 2;
  return Math.min(even, maxEven);
}
```

- Índice 0 → hojas 0 y 1. Índice 1 → hojas 2 y 3.
- El slider del lector usa `spreadIndex` (0 … `totalSpreads-1`), no el número de hoja.
- `goNextSpread` hace `goToPage(spreadIdx * 2 + 2)`.
- Si el pack reduce el número de páginas, `clampToSpreadStart` en el render evita un índice fuera de rango (no uses un `useEffect` para eso).

## Stream de bloques

```ts
export function flattenPageBlocks(pages: PaginatedPage[]): TextBlock[] {
  return mergeContinuationParagraphs(pages.flatMap((page) => getPageBlocks(page)));
}

export function getPageBlocks(page: PaginatedPage): TextBlock[] {
  if (page.blocks && page.blocks.length > 0) return page.blocks;
  // fallback legado desde page.content
  …
}
```

`flattenPageBlocks` es el puente estimado → pack DOM. Devuelve un único array en orden de lectura, con párrafos partidos **reunidos**.

`mergeContinuationParagraphs` junta dos `paragraph` seguidos si `continued === true` o si el segundo empieza en minúscula / el primero no termina en `.!?`. Hacé esto **antes** de reempacar; si no, el probe trata trozos como párrafos nuevos (sangría + margen de más).

## Pack por alturas ya medidas

Cuando ya tenés un `height` por bloque (estimado o medido):

```ts
// paginator.ts — líneas 404–473 (idea)
export function packBlocksWithMeasuredHeights(
  blocks: TextBlock[],
  heights: number[],
  options: { leftHeightPx: number; rightHeightPx: number }
): PaginatedPage[]
```

Reglas:

1. Nunca tira contenido.
2. **No parte** bloques. Si un bloque no entra en el resto de la hoja, **empieza hoja nueva**.
3. Si un bloque solo ya llena la hoja, la cierra.
4. Hoja par usa `leftHeightPx`; impar usa `rightHeightPx`.
5. Mínimo 80px de alto (evita pack en un frame de 0).

El pack DOM (`measureAndPackBlocks`) **sí** parte párrafos porque mide overflow real. `packBlocksWithMeasuredHeights` es la versión “alturas ya conocidas”. El contrato de calidad G1/G2 se testea contra esta función (`assertPackedPageQuality`).

## Partir un párrafo (estimado)

```ts
export function splitBlockToFit(
  block: TextBlock,
  maxHeightPx: number,
  fontSize: number
): TextBlock[]
```

Solo parte `paragraph`. Los trozos después del primero llevan `continued: true`. Títulos y headings **nunca** se parten: si no caben, van a la hoja siguiente enteros.

`paginateBlocksByHeight` usa esto en el estimado. En el navegador, el split lo hace el probe (búsqueda binaria por palabras). Ver [`04-empaquetado-dom.md`](04-empaquetado-dom.md).

## Unir renglones de prosa (útil para Gutenberg)

Los EPUB de Gutenberg a veces traen líneas cortas o guiones de corte. Esta heurística es del PDF, pero sirve:

```ts
// paginator.ts — líneas 117–126
export function shouldJoinProseLines(prev: string, next: string): boolean {
  if (prev.endsWith("-")) return true;
  if (/[.!?:;]$/.test(prev)) return false;
  if (next[0] es minúscula latina) return true;
  if (prev no termina en .!?…) return true;
  return false;
}
```

`buildBlocks(fullText)` clasifica cada línea (`classifyLineStyle`) y fusiona prosa con esa regla. Para EPUB, preferí el HTML semántico (`<p>`, `<h1>`) y usá esto solo como fallback si el XHTML viene como un muro de `<br>`.

## TOC heurístico (fallback)

```ts
export function extractTOC(pages: PaginatedPage[]): TOCItem[]
```

Busca `list-item` tipo `Libro N` y headings `Capítulo` / `Chapter` / `1. …`. Si no hay nada, pone “Inicio” y “Mitad”.

En Gutenberg **no dependas de esto**. El EPUB trae nav. El lector sí lo usa como fallback:

```ts
// book-reader.tsx — líneas 213–216
const rebuilt = extractTOC(displayPages);
return rebuilt.length > 0 ? rebuilt : tableOfContents;
```

Ojo: si `extractTOC` inventa “Inicio/Mitad”, **pisa** el TOC que le pasaste. Si vas a pasar TOC de `nav.xhtml`, o desactivá este rebuild o hacé que solo corra cuando `tableOfContents` viene vacío.

## Calidad (tests, no UI)

```ts
assertPackedPageQuality(pages, blockHeights, { leftHeightPx, rightHeightPx })
assertWordPreservation(fullText, pages)
```

- G1: ninguna hoja usa más px que su límite.
- G2: hojas no finales no dejan >35% de hueco (slack).
- Palabras: las del origen aparecen en orden, sin pérdidas.

Portá estos asserts si implementás el paginador. Evitan que un “refactor” trunque el libro.

## Constantes (solo estimado)

| Constante | Valor | Uso |
|---|---|---|
| `LEFT_PAGE_WORDS` / `RIGHT_PAGE_WORDS` | 80 / 105 | Camino viejo `paginateText`. |
| `LEFT_PAGE_LINES` / `RIGHT_PAGE_LINES` | 13 / 15 | `paginateBlocksByLines`. |
| `CHARS_PER_LINE` | 42 | Estima wrap a 16px serif. |
| `PACK_FONT_SIZE` | 16 | En `measure-and-pack.ts`. Inamovible. |
