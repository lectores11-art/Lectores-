# 02 — Pipeline de dos fases

El paginado **no** se hace de una sola vez. Hay un estimado barato y un pack real en el navegador. Si la otra IA junta todo en un “dividir por N palabras”, el libro se verá cortado o con huecos.

Fuente: `docs/book-upload-pipeline.md` + efecto en `src/components/library/book-reader.tsx` líneas 121–208.

## Por qué dos fases

El servidor (o el parser EPUB) **no conoce** el alto real de `.book-page-body` en *esta* pantalla, ni el wrap de Literata a 16px. Un presupuesto de líneas (`LEFT_PAGE_LINES = 13`, `RIGHT_PAGE_LINES = 15`) alcanza para mostrar algo al instante. La verdad visual es el **overflow-probe** en el DOM.

```
Parse fuente → TextBlock[]
       ↓
paginateBlocksByLines          ← fase 1 (estimado, version 7)
       ↓
Montar BookReader
       ↓
¿needsDomPack O packMetricsStale?
  no  → pintar pliego y listo
  sí  → overlay “Preparando páginas…”
       measureAndPackBlocks     ← fase 2 (version 12)
       onDomPacked(pages, metrics)
       persistir
```

No hay `ResizeObserver` continuo. Un resize menor no reflowea. Solo si alto o ancho cambian más de **10%** (`PACK_VIEWPORT_TOLERANCE`) se reempaca **una vez**.

## Fase 1 — estimado

```ts
// paginator.ts — líneas 608–616
export function paginateBlocksByLines(blocks: TextBlock[]): PaginatedPage[] {
  const fontSize = 16;
  const linePx = fontSize * 1.75;
  return paginateBlocksByHeight(blocks, {
    leftHeightPx: LEFT_PAGE_LINES * linePx,
    rightHeightPx: RIGHT_PAGE_LINES * linePx,
    fontSize,
  });
}
```

`LEFT_PAGE_LINES = 13` / `RIGHT_PAGE_LINES = 15` son **conservadores** (laptop ~768–900px de alto, menos chrome). Sirven de borrador. No son el layout final.

`paginateText(fullText)` (por palabras) es un camino más viejo (Nivel A). Para EPUB con bloques semánticos, usá `paginateBlocksByLines`.

## Fase 2 — pack DOM

El lector espera 2 frames + `document.fonts.ready` para que Literata y el layout existan. Mide los dos `.book-page-body`. Si hay que empaquetar, aplana todas las páginas a un stream de bloques y vuelve a paginar con el probe.

```ts
// book-reader.tsx — líneas 121–196 (resumen)
useEffect(() => {
  async function runPack() {
    await 2× requestAnimationFrame;
    await document.fonts.ready;

    const left = pageBodyMetrics(leftBodyRef.current);
    const right = pageBodyMetrics(rightBodyRef.current ?? left);
    const currentMetrics = { widthPx, leftHeightPx, rightHeightPx, fontSize: 16 };

    const mustPack =
      needsDomPack(pipelineVersion) || packMetricsStale(packMetrics, currentMetrics);

    if (!mustPack) return;

    const blocks = flattenPageBlocks(pages);
    const packed = measureAndPackBlocks(blocks, { columnWidthPx, leftHeightPx, rightHeightPx, fontSize: 16 });
    setLivePages(packed);
    await onDomPacked(packed, currentMetrics);
  }
}, [pipelineVersion, pages, packMetrics]);
```

Detalles que no hay que “simplificar”:

1. **Esperar fuentes.** Sin `document.fonts.ready` las medidas son de fallback (Georgia) y las páginas quedan mal.
2. **Dos rAF.** El frame del libro tiene que tener `clientHeight` real. Si medís en el primer paint, a veces da 0 y el pack se aborta (`widthPx < 80`).
3. **`flattenPageBlocks`** une trozos `continued` antes de reempacar. Si no, un párrafo partido en el estimado se trataría como dos bloques.
4. **`packingRef`** evita dos packs en paralelo.
5. Si el pack falla, se muestran las páginas estimadas. No se deja la UI en blanco.

## Persistencia

En esta app: `POST /api/c/[slug]/books/[bookId]/paginate` guarda `content_json`, `pipeline_version = 12`, `pack_metrics`.

En la otra app: cualquier store. El payload mínimo:

```ts
{
  pages: PaginatedPage[];
  pipeline_version: 12;
  pack_metrics: PackMetrics;
  table_of_contents?: TOCItem[];  // remapeado a pageNumber post-pack
}
```

Sin persistir, cada apertura muestra “Preparando páginas…” otra vez. Gutenberg (novelas largas) lo hace lento.

## Lecturas siguientes

`displayPages` se normaliza **solo para pintar** (`mergeContinuationParagraphs` por hoja). No hay reflow continuo. Navegar pliegos intercambia `leftPage` / `rightPage`.

## Overlay

Mientras `preparing === true`, hay un overlay “Preparando páginas…” y la navegación (teclado + slider) está deshabilitada. Copiá ese gate: si el usuario cambia de pliego a mitad del pack, el índice queda fuera de rango.

## Qué no hacer

- No paginar solo en el servidor y darlo por cerrado.
- No reempacar en cada `resize`.
- No cambiar `fontSize` después del pack (el slider está disabled a propósito).
- No saltarte `flattenPageBlocks` antes de `measureAndPackBlocks`.
