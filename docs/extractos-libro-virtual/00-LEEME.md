# Kit: lógica del libro virtual

Este kit explica **cómo funciona el lector de LECTORES** para que otra IA lo porte a otra app. En esa app la fuente son **EPUBs de Project Gutenberg**, no PDFs.

Lee los archivos **en orden** (`00` → `10`). El prompt listo para pegar está en [`10-prompt-para-ia.md`](10-prompt-para-ia.md). Las rutas originales están en [`FUENTES.md`](FUENTES.md).

## Qué es este lector

No es un visor de PDF ni de EPUB. No usa canvas, PDF.js en el cliente, ni flip 3D (Turn.js, StPageFlip, `rotateY`).

El libro se convierte a **bloques de texto** (`TextBlock[]`). El UI pinta esos bloques como HTML dentro de un **pliego de dos páginas** (izquierda + derecha). El aspecto de “libro abierto” es **CSS puro**: cantos de papel, sombra de lomo, oreja de perro. El paso de página **cambia el contenido al instante**.

```
Fuente (PDF aquí / EPUB allá)
        ↓
   TextBlock[]          ← frontera portable
        ↓
   páginas estimadas    ← pipeline_version 7
        ↓
   BookReader (pliego)
        ↓
   measureAndPackBlocks (DOM real)
        ↓
   páginas finales      ← pipeline_version 12
```

El núcleo portable **empieza en `TextBlock[]`**. Cómo se obtiene ese array (parser EPUB, pdfjs, etc.) es un adaptador. El resto del lector no sabe de qué archivo vino el texto.

## Superficie de integración

`BookReader` es el contrato. La otra app le pasa páginas y callbacks; no necesita Supabase ni las rutas de esta app.

```ts
// src/components/library/book-reader.tsx — líneas 33–52
interface BookReaderProps {
  title: string;
  author?: string | null;
  pages: PaginatedPage[];
  tableOfContents?: TOCItem[];
  initialPage?: number;
  onPageChange?: (page: number, percent: number) => void;
  onBookmark?: (page: number) => void;
  /** Called after DOM measure-and-pack (pipeline upgrade or viewport re-pack). */
  onDomPacked?: (
    pages: PaginatedPage[],
    metrics: PackMetrics
  ) => void | Promise<void>;
  compact?: boolean;
  onClose?: () => void;
  pipelineVersion?: number;
  /** Viewport used for the pages currently in `pages` (from DB). */
  packMetrics?: PackMetrics | null;
  legacyWarning?: boolean;
}
```

| Prop | Rol |
|---|---|
| `pages` | Hojas ya paginadas (`PaginatedPage[]`). |
| `pipelineVersion` / `packMetrics` | Si están viejos o el viewport cambió >10%, el lector reempaca. |
| `onDomPacked` | Persistí las páginas empaquetadas + métricas. Sin esto, cada apertura vuelve a medir. |
| `onPageChange` | Guardá progreso (`page` siempre es índice par = inicio de pliego). |
| `onBookmark` | Guardá marcador. Esta app no lista marcadores; solo escribe. |
| `compact` | Variante chica (reuniones). Opcional. |

## Flujo mínimo en la otra app

1. Descargar / abrir el EPUB de Gutenberg.
2. Parsear spine → XHTML → `TextBlock[]` (ver [`08-adaptador-epub.md`](08-adaptador-epub.md)).
3. `paginateBlocksByLines(blocks)` → páginas estimadas (`pipeline_version = 7`).
4. Montar `<BookReader pages={…} pipelineVersion={7} onDomPacked={guardar} />`.
5. En `onDomPacked`, guardar `pages` + `packMetrics` y marcar `pipeline_version = 12`.
6. Las siguientes aperturas: si el viewport no cambió, **no** reempacar.

## Qué copiar vs qué reinventar

**Copiar la lógica (no hace falta el archivo entero):**

| Pieza | Dónde se explica |
|---|---|
| Tipos `TextBlock`, `PaginatedPage`, `PackMetrics` | [`01-modelo-datos.md`](01-modelo-datos.md) |
| Pipeline de 2 fases | [`02-pipeline.md`](02-pipeline.md) |
| Spreads, clamp par, pack por altura | [`03-paginador.md`](03-paginador.md) |
| Overflow-probe en el DOM | [`04-empaquetado-dom.md`](04-empaquetado-dom.md) |
| Estado y teclado del lector | [`05-lector-ui.md`](05-lector-ui.md) |
| `BlockView` / `PageContent` | [`06-bloques-html.md`](06-bloques-html.md) |
| CSS del libro | [`07-css-libro.md`](07-css-libro.md) |

**Reinventar (esta app no lo tiene, o no sirve para Gutenberg):**

- Parser EPUB → `TextBlock[]` — spec en [`08-adaptador-epub.md`](08-adaptador-epub.md).
- Persistencia (DB, localStorage, lo que use la otra app).
- Catálogo / portadas / autenticación.

## Qué NO se porta

Estas piezas están acopladas a LECTORES. No las copies.

| Pieza | Por qué no |
|---|---|
| `src/lib/pdf/extract-positioned.ts`, `extract-text.ts`, `node-dom-polyfill.ts` | Extraen PDF con pdfjs. Gutenberg es EPUB. |
| `src/lib/legal/pdf-access.ts` | Territorios / licencia. |
| `src/app/api/c/[slug]/books/**` | Auth, RLS, signed URL del PDF original. |
| `library-page-client.tsx` | Upload de PDF + campos legales. |
| `book-reader-page-client.tsx` | Fetch + gate legal + “PDF original”. |
| Reuniones (`compact` en meeting-room) | Producto de esta app. |

## Archivos de este kit

| Archivo | Contenido |
|---|---|
| [`01-modelo-datos.md`](01-modelo-datos.md) | Tipos y por qué existe `continued`. |
| [`02-pipeline.md`](02-pipeline.md) | Estimado vs pack DOM. |
| [`03-paginador.md`](03-paginador.md) | Funciones de spreads y pack. |
| [`04-empaquetado-dom.md`](04-empaquetado-dom.md) | Overflow-probe (la pieza que más se rompe). |
| [`05-lector-ui.md`](05-lector-ui.md) | `BookReader`: estado, teclado, chrome. |
| [`06-bloques-html.md`](06-bloques-html.md) | `style` → HTML/CSS. |
| [`07-css-libro.md`](07-css-libro.md) | Pliego, cantos, tipografía. |
| [`08-adaptador-epub.md`](08-adaptador-epub.md) | Gutenberg EPUB → `TextBlock[]`. |
| [`09-contrato-calidad.md`](09-contrato-calidad.md) | G1–G4 y anti-patrones. |
| [`10-prompt-para-ia.md`](10-prompt-para-ia.md) | Prompt autocontenido. |
| [`FUENTES.md`](FUENTES.md) | Extracto → archivo original. |
