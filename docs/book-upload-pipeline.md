# Pipeline de subida de libros (PDF → lector)

Este documento define el flujo estándar para subir un PDF a la biblioteca de una comunidad y cómo verificar que quedó bien procesado.

## Flujo

```
POST /api/c/[slug]/books (mode=pdf|catalog)
  → validateCoverFile (portada obligatoria → bucket `book-covers`)
  → mode=catalog: insert ficha (sin PDF)
  → mode=pdf:
      validatePdfFile + zod (título, autor, descripción)
      → extractTextFromPdfBuffer (pdf-parse, serverExternalPackages)
      → normalizeExtractedText (espacios, líneas duplicadas consecutivas)
      → buildBlocks + paginateText (hojas ~80/105 palabras + bloques con estilo)
      → extractTOC
      → Storage: PDF original en bucket `books`
      → DB: books (cover_url, content_json con `blocks[]`, pipeline_version, …)
```

## Constantes (`src/lib/pdf/paginator.ts`)

| Constante | Valor | Motivo |
|-----------|-------|--------|
| `LEFT_PAGE_WORDS` | 80 | Páginas pares (izquierda): caben con título solo en spread 1 |
| `RIGHT_PAGE_WORDS` | 105 | Páginas impares (derecha): caben con barra de herramientas |
| `LEFT_PAGE_LINES` | 20 | Presupuesto visual hoja izquierda |
| `RIGHT_PAGE_LINES` | 22 | Presupuesto visual hoja derecha |
| `CHARS_PER_LINE` | 48 | Ancho real de columna (~half page) |
| `MAX_STORED_PAGES` | 1500 | Techo de seguridad para JSONB en Postgres |
| `PIPELINE_VERSION` | 5 | Lector reflow por altura; upload con presupuesto conservador |

## Nivel A — preservación de formato (v3)

- **Extracción:** `getText({ lineEnforce: true })` mantiene saltos de línea del PDF.
- **Bloques:** `buildBlocks` no fusiona líneas de índice/título; solo une líneas de prosa partidas (guiones, minúscula inicial).
- **Estilos heurísticos:** `title`, `subtitle`, `list-item` (p. ej. `Libro 1:`), `heading`, `paragraph`.
- **Lector:** `PageContent` renderiza cada bloque con CSS (centrado para TOC, ítems de lista, etc.).
- **Persistencia:** cada página en `content_json` incluye `{ pageNumber, content, blocks[] }`.

## Storage (PDFs)

- Bucket `books` es **privado** (`public = false`). Ver migraciones `003`, `004`, `007`.
- Paths: `{community_id}/{timestamp}-{filename}.pdf`.
- Lectura directa de Storage: solo miembros de esa comunidad (RLS).
- Upload/delete: solo `community_owner` / super-admin (`is_community_admin`).
- Descarga vía app: `GET /api/c/[slug]/books/[bookId]/pdf` → `createSignedUrl` (~60s).
  Miembros de otra comunidad reciben 403 (guard de API) o 404 si el libro no está en su comunidad.

## Nivel B — layout-aware (v4/v5)

- **Extracción:** `extractPositionedTextFromPdfBuffer` obtiene `PositionedTextItem[]` con X/Y.
- **Inferencia:** `inferLayoutBlocks` agrupa por línea, detecta centrado (±15%) y `fontSize` relativo.
- **Paginación upload:** `paginateBlocksByHeight` con presupuesto conservador (14/16 líneas).
- **Paginación lector:** usa las páginas de `content_json` tal cual (solo `mergeContinuationParagraphs` por página). **No hay reflow/re-paginado en cliente** — eso causaba saltos y pantallas en blanco.
- **Regla:** los bloques `list-item` nunca se parten entre páginas; párrafos largos sí.
- **Upload:** `POST /api/c/[slug]/books` intenta pipeline B y hace fallback a Nivel A si falla.

### Checklist índice sin recorte (Nivel B)

1. Abrir libro (páginas vienen de `content_json`; re-subir si el banner legacy aparece).
2. Spread 1 muestra `Tabla de Contenido`, título y primeros `Libro N:` sin recorte vertical.
3. Los `Libro N:` restantes continúan en hoja 2+.
4. Ninguna hoja corta texto a media letra en el borde inferior.
5. Re-subir actualiza `pipeline_version` a 5.

## Migraciones Supabase requeridas

1. `003_storage_setup.sql` — bucket `books`
2. `004_storage_books_rls.sql` — políticas storage (opcional si usás service_role en upload)
3. `005_books_pipeline_version.sql` — columna `pipeline_version`
4. `008_book_covers_storage.sql` — bucket público `book-covers` (jpeg/png/webp)

## Checklist post-subida (manual)

Después de subir un PDF en **Biblioteca → Subir y procesar**:

1. **Sin frases repetidas progresivas** — la primera hoja no debe mostrar "Palabra", "Palabra siguiente", "Palabra siguiente otra…" en líneas separadas.
2. **Spread correcto** — hoja izquierda ≠ hoja derecha (salvo última hoja impar en blanco a la derecha).
3. **Sin scroll vertical** — el libro ocupa la pantalla; navegás con flechas o el slider, no scrolleando el cuerpo de la página.
4. **Páginas razonables** — un libro mediano suele dar ~50–300 hojas, no 1500.
5. **Texto real** — no el mensaje fallback *"No se pudo extraer el texto del PDF…"*.

6. **Índice legible** — "Tabla de Contenido", título en mayúsculas y entradas `Libro N:` aparecen en líneas separadas y centradas, sin recorte en hoja 1 (v4).

## Libros procesados antes del fix (legacy)

Los libros subidos **antes** de `PIPELINE_VERSION = 5` pueden tener paginación de servidor demasiado densa. El **lector v5 reflowea en cliente**, así que el recorte debería desaparecer al refrescar. Re-subir sigue siendo recomendable para dejar `pipeline_version = 5` en DB.

Acción:

1. Borrar el libro en la biblioteca (o desde Supabase).
2. Volver a subir el mismo PDF.

El lector muestra un banner amarillo si detecta legacy (`pipeline_version < 4`, >500 páginas, o patrón de repetición progresiva).

## Tests automatizados

```bash
npm run test
```

Cubren `buildBlocks`, `classifyLineStyle`, `paginateText`, `normalizeExtractedText`, `hasLegacyPaginationBug` y `extractTOC`.

## Configuración Next.js

En `next.config.ts`:

```ts
serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
```

Reiniciar `npm run dev` después de cambiar esta config.

## Troubleshooting

| Síntoma | Causa probable | Acción |
|---------|----------------|--------|
| "Error interno" al subir | Storage RLS o timeout DB | Ver terminal del servidor; correr migraciones 003/004 |
| Texto fallback en lector | Worker pdfjs (Turbopack) | Confirmar `serverExternalPackages` y reiniciar dev |
| 1500 páginas / frases repetidas | Libro legacy | Borrar y re-subir |
| Column `pipeline_version` error | Migración 005 pendiente | Ejecutar SQL en Supabase |
