# FUENTES — extracto → archivo original

Rutas relativas a la raíz del repo LECTORES. Usá esto si necesitás el archivo completo; el kit no lo duplica.

| Tema del kit | Archivo original | Líneas (aprox.) |
|---|---|---|
| Tipos `TextBlock`, `PaginatedPage`, `TOCItem` | `src/lib/pdf/paginator.ts` | 1–22 |
| `PackMetrics`, `needsDomPack`, `packMetricsStale` | `src/lib/pdf/paginator.ts` | 46–79 |
| `shouldJoinProseLines`, `buildBlocks` | `src/lib/pdf/paginator.ts` | 117–180 |
| `flattenPageBlocks`, `mergeContinuationParagraphs` | `src/lib/pdf/paginator.ts` | 247–296 |
| `splitBlockToFit` | `src/lib/pdf/paginator.ts` | 303–341 |
| `assertPackedPageQuality` | `src/lib/pdf/paginator.ts` | 355–396 |
| `packBlocksWithMeasuredHeights` | `src/lib/pdf/paginator.ts` | 404–474 |
| `paginateBlocksByHeight` | `src/lib/pdf/paginator.ts` | 481–602 |
| `paginateBlocksByLines` | `src/lib/pdf/paginator.ts` | 608–617 |
| `paginateText` (legado por palabras) | `src/lib/pdf/paginator.ts` | 622–696 |
| `getPageBlocks` | `src/lib/pdf/paginator.ts` | 707–717 |
| `extractTOC` | `src/lib/pdf/paginator.ts` | 742–765 |
| Spreads / `clampToSpreadStart` | `src/lib/pdf/paginator.ts` | 797–823 |
| Overflow-probe completo | `src/lib/pdf/measure-and-pack.ts` | 1–396 |
| `pageBodyMetrics`, probe column | `src/lib/pdf/measure-and-pack.ts` | 66–125 |
| `measureAndPackBlocks` | `src/lib/pdf/measure-and-pack.ts` | 242–383 |
| Props y estado de `BookReader` | `src/components/library/book-reader.tsx` | 33–116 |
| Effect de pack DOM | `src/components/library/book-reader.tsx` | 121–208 |
| Navegación y teclado | `src/components/library/book-reader.tsx` | 219–258 |
| JSX del pliego | `src/components/library/book-reader.tsx` | 298–575 |
| `BlockView` / `PageContent` | `src/components/library/book-reader-blocks.tsx` | 1–72 |
| `.reader-serif` | `src/app/globals.css` | 30–40 |
| CSS del lector (bloque entero) | `src/app/globals.css` | 78–561 |
| Literata | `src/app/layout.tsx` | 2–14 |
| `ReaderSettings` | `src/lib/types/database.ts` | 241–245 |
| `BookPage` (espejo DB de `PaginatedPage`) | `src/lib/types/database.ts` | 125–140 |
| Pipeline y G1–G4 | `docs/book-upload-pipeline.md` | 1–80 |
| Tests de calidad | `src/lib/pdf/quality-contract.test.ts` | todo |
| Tests de paginador / spreads | `src/lib/pdf/paginator.test.ts` | todo |

## Acoplado a LECTORES — no portar

| Archivo | Motivo |
|---|---|
| `src/lib/pdf/extract-positioned.ts` | Extracción PDF (pdfjs). |
| `src/lib/pdf/extract-text.ts` | Fallback pdf-parse. |
| `src/lib/pdf/layout-inference.ts` | Layout de ítems PDF. |
| `src/lib/pdf/node-dom-polyfill.ts` | Polyfill Node para pdfjs. |
| `src/lib/legal/pdf-access.ts` | Territorios / licencia. |
| `src/app/api/c/[slug]/books/**` | Auth, RLS, persistencia, signed URL. |
| `src/components/library/book-reader-page-client.tsx` | Fetch + gate legal. |
| `src/components/library/library-page-client.tsx` | Upload PDF + legal. |
| `src/components/meeting/meeting-room-client.tsx` | Embed en reuniones. |

## Adaptador EPUB

No hay fuente en este repo. La spec está solo en `08-adaptador-epub.md`.
