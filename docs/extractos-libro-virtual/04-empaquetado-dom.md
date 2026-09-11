# 04 — Empaquetado DOM (overflow-probe)

Esta es la pieza que más se rompe si se “simplifica”. Fuente: `src/lib/pdf/measure-and-pack.ts`.

**Solo corre en el browser** (`document`). En Node tira.

## Por qué no sumar `offsetHeight`

El comentario al tope del archivo:

> Truth signal: render blocks together in a fixed-height clone of `.book-page-body` and use `scrollHeight > clientHeight`. Summing per-block offsetHeights is NOT reliable (margin collapse, `:first-of-type`, stacking) and caused clipped lines.

`.book-para` tiene `margin-bottom: 0.65rem`. El primero no tiene sangría (`:first-of-type`). Un párrafo `continued` pierde margen-top. Si sumás alturas sueltas, **ignorás collapse** y las hojas quedan cortadas o con hueco. El probe pinta los bloques **juntos**, como el lector, y pregunta: ¿hay overflow?

## Métricas del body real

```ts
export function pageBodyMetrics(el: HTMLElement): { widthPx: number; heightPx: number } {
  return {
    widthPx: Math.max(80, Math.floor(el.clientWidth)),
    heightPx: Math.max(80, Math.floor(el.clientHeight)),
  };
}
```

Usá `clientWidth` / `clientHeight` del `.book-page-body` **montado** (incluye padding). No uses `getBoundingClientRect` del `.book-page` entero: el padding de la hoja (2.6rem 3rem 3.4rem) no es área de texto.

Si `widthPx < 80` o `leftHeightPx < 80`, el lector **aborta** el pack (layout todavía no listo).

## Probe offscreen

```ts
// measure-and-pack.ts — líneas 77–125 (idea)
host.className = "reader-shell reader-light reader-serif";
host.style = position:absolute; left:-10000px; visibility:hidden; width:${columnWidthPx}px;

page.className = "book-page";
column.className = "book-page-body";
column.style = width, box-sizing:border-box, padding-bottom:1.25rem, overflow:hidden;
```

El probe **tiene que cargar las mismas clases** que el lector. Si falta `reader-serif` o `.book-para`, medís otra tipografía.

`overflows`:

```ts
function overflows(column: HTMLElement): boolean {
  return column.scrollHeight > column.clientHeight + 1; // tolerancia subpixel
}
```

Por cada hoja, `column.style.height = leftH o rightH`. Se agregan nodos. Si overflow → no entra.

## Algoritmo de `measureAndPackBlocks`

Firma:

```ts
export function measureAndPackBlocks(
  blocks: TextBlock[],
  options: {
    columnWidthPx: number;
    leftHeightPx: number;
    rightHeightPx: number;
    fontSize: number;
  }
): PaginatedPage[]
```

Cola = `mergeContinuationParagraphs(blocks)`. Por cada bloque:

1. Pintarlo al final de la columna-probe.
2. Si **no** overflow → se queda en esta hoja.
3. Si overflow y la hoja **está vacía**:
   - `paragraph`: búsqueda binaria de cuántas palabras caben solas (`splitParagraphToFitProbe`). El resto vuelve a la cola con `continued: true`.
   - título/heading/list: se fuerza en la hoja y se cierra (no se parte).
4. Si overflow y la hoja **ya tiene contenido**:
   - `paragraph`: `splitParagraphIntoRemaining` — cuántas palabras caben **con lo que ya está**. Eso llena la hoja (G2: sin franja vacía). El resto va a la siguiente.
   - si nada entra (heading largo): `flushPage` y reintentar el mismo bloque en hoja nueva.

Al cerrar una hoja, `column.replaceChildren()`. Al terminar, `host.remove()`.

Hay un `guard` (`maxSteps = max(10000, queue.length * 40)`) por si un bug entra en loop.

## Búsqueda binaria de palabras

`splitParagraphToFitProbe`: el bloque **solo** en una columna vacía. Encuentra el máximo `mid` de palabras que no desborda.

`splitParagraphIntoRemaining`: el trial se **appendea** a lo ya pintado, se mide, se saca. Si `best === 0`, devuelve `null` → el caller hace flush.

El segundo trozo siempre lleva `continued: true`.

## Render del bloque en el probe

Debe **espejar** `BlockView`:

```ts
function classNameForBlock(block: TextBlock): string {
  switch (block.style) {
    case "title": return "book-title";
    case "subtitle": return "book-subtitle";
    case "list-item": return "book-list-item";
    case "heading": return "book-heading";
    default: return block.continued ? "book-para book-para-continued" : "book-para";
  }
}

// title → h2 fontSize+4; heading → h2 +3; subtitle → p +1; resto → p
```

Si el probe usa `<p>` para un título y el lector usa `<h2>`, las alturas no coinciden y vas a ver cortes.

## Fuente fija

```ts
const PACK_FONT_SIZE = 16;
```

El slider de la UI está `min={16} max={16} disabled`. Si dejás cambiar el tamaño, **tenés que reempacar**. Esta app eligió no hacerlo.

## Checklist al portar

- [ ] Probe offscreen con las **mismas** clases CSS que el lector.
- [ ] Esperar `document.fonts.ready` antes de medir (lo hace `BookReader`, no esta función).
- [ ] `scrollHeight > clientHeight`, no suma de offsets.
- [ ] Partir solo `paragraph`; fill-remaining en hojas a medio llenar.
- [ ] `finally { host.remove() }`.
- [ ] Cola pre-mergeada (`flattenPageBlocks` / `mergeContinuationParagraphs`).
