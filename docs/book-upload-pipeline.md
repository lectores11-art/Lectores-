# Pipeline de subida de libros (PDF → lector)

Este documento define el flujo estándar para subir un PDF a la biblioteca de una comunidad y cómo verificar que quedó bien procesado.

## Flujo

```
POST /api/c/[slug]/books
  → validatePdfFile + zod (título, autor, descripción)
  → extractTextFromPdfBuffer (pdf-parse, serverExternalPackages)
  → normalizeExtractedText (espacios, líneas duplicadas consecutivas)
  → buildBlocks + paginateText (hojas ~80/105 palabras + bloques con estilo)
  → extractTOC
  → Storage: PDF original en bucket `books`
  → DB: books (content_json con `blocks[]`, pipeline_version, …)
```

## Constantes (`src/lib/pdf/paginator.ts`)

| Constante | Valor | Motivo |
|-----------|-------|--------|
| `LEFT_PAGE_WORDS` | 80 | Páginas pares (izquierda): caben con título solo en spread 1 |
| `RIGHT_PAGE_WORDS` | 105 | Páginas impares (derecha): caben con barra de herramientas |
| `MAX_STORED_PAGES` | 1500 | Techo de seguridad para JSONB en Postgres |
| `PIPELINE_VERSION` | 3 | Libros con `pipeline_version < 3` se consideran legacy |

## Nivel A — preservación de formato (v3)

- **Extracción:** `getText({ lineEnforce: true })` mantiene saltos de línea del PDF.
- **Bloques:** `buildBlocks` no fusiona líneas de índice/título; solo une líneas de prosa partidas (guiones, minúscula inicial).
- **Estilos heurísticos:** `title`, `subtitle`, `list-item` (p. ej. `Libro 1:`), `heading`, `paragraph`.
- **Lector:** `PageContent` renderiza cada bloque con CSS (centrado para TOC, ítems de lista, etc.).
- **Persistencia:** cada página en `content_json` incluye `{ pageNumber, content, blocks[] }`.

## Migraciones Supabase requeridas

1. `003_storage_setup.sql` — bucket `books`
2. `004_storage_books_rls.sql` — políticas storage (opcional si usás service_role en upload)
3. `005_books_pipeline_version.sql` — columna `pipeline_version`

## Checklist post-subida (manual)

Después de subir un PDF en **Biblioteca → Subir y procesar**:

1. **Sin frases repetidas progresivas** — la primera hoja no debe mostrar "Palabra", "Palabra siguiente", "Palabra siguiente otra…" en líneas separadas.
2. **Spread correcto** — hoja izquierda ≠ hoja derecha (salvo última hoja impar en blanco a la derecha).
3. **Sin scroll vertical** — el libro ocupa la pantalla; navegás con flechas o el slider, no scrolleando el cuerpo de la página.
4. **Páginas razonables** — un libro mediano suele dar ~50–300 hojas, no 1500.
5. **Texto real** — no el mensaje fallback *"No se pudo extraer el texto del PDF…"*.

6. **Índice legible** — "Tabla de Contenido", título en mayúsculas y entradas `Libro N:` aparecen en líneas separadas y centradas, no como un párrafo único.

## Libros procesados antes del fix (legacy)

Los libros subidos **antes** de `PIPELINE_VERSION = 3` pueden tener índice fusionado o paginación vieja. **No se reparan solos.**

Acción:

1. Borrar el libro en la biblioteca (o desde Supabase).
2. Volver a subir el mismo PDF.

El lector muestra un banner amarillo si detecta legacy (`pipeline_version < 3`, >500 páginas, o patrón de repetición progresiva).

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
