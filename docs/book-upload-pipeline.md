# Pipeline de subida de libros (PDF → lector)

Este documento define el flujo estándar para subir un PDF y cómo se garantiza la calidad visual del libro virtual.

## Contrato de calidad (obligatorio)

| # | Garantía | Cómo se asegura |
|---|----------|-----------------|
| G1 | Texto sin cortes en el borde de la hoja | Empaquetado con **alturas medidas** en el DOM real; si no entra, pasa a la hoja siguiente |
| G2 | Sin huecos grandes en prosa | Se llena cada hoja hasta que el próximo bloque no quepa (`packBlocksWithMeasuredHeights`) |
| G3 | Sin saltos raros entre párrafos | Extracción une renglones PDF en prosa (`mergeProseLayoutBlocks`); cuerpo justificado |
| G4 | Fiel al PDF en lo importante | Mismo orden de texto, títulos reconocibles, prosa legible (no pixel-perfect de márgenes) |

Tests: `src/lib/pdf/quality-contract.test.ts`.

## Flujo

```
Browser (admin):
  → Storage upload portada → bucket `book-covers`
  → Storage upload PDF → bucket `books`
POST /api/c/[slug]/books  (JSON: metadatos + storage paths)
  → extract (Nivel B / fallback A) → bloques → estimado de páginas
  → DB: content_json + pipeline_version = 7 (estimado)

Primera apertura del lector (cualquier miembro):
  → medir bloques con CSS real (Literata / .book-para)
  → packBlocksWithMeasuredHeights
  → POST /api/c/[slug]/books/[bookId]/paginate
  → DB: content_json + pipeline_version = 8 (DOM-packed)

Lecturas siguientes: navegar spreads; sin reflow continuo.
```

Los archivos **no** pasan por el body de Vercel (límite ~4.5 MB). Tope práctico: policies Storage (PDF 50 MB, portada 5 MB).

## Constantes (`src/lib/pdf/paginator.ts`)

| Constante | Valor | Motivo |
|-----------|-------|--------|
| `LEFT_PAGE_LINES` / `RIGHT_PAGE_LINES` | 13 / 15 | Solo estimación de upload (no layout final) |
| `CHARS_PER_LINE` | 42 | Estimación servidor |
| `MAX_STORED_PAGES` | 1500 | Techo JSONB |
| `ESTIMATED_PIPELINE_VERSION` | 7 | Upload: páginas estimadas; necesita DOM pack |
| `PIPELINE_VERSION` | 8 | Final: páginas empaquetadas con medición DOM |

`needsDomPack(version)` es true si `0 < version < 8`.

## Nivel A — texto

- Extracción de texto + `buildBlocks` / `paginateText`.
- Estilos: `title`, `subtitle`, `list-item`, `heading`, `paragraph`.

## Nivel B — layout-aware

- `extractPositionedTextFromPdfBuffer` → `inferLayoutBlocks` (centrado, prosa unida).
- Upload: `paginateBlocksByLines` solo como **borrador**.
- Lector: una vez mide y empaqueta; **no** hay `ResizeObserver` / reflow continuo.

## Persistencia DOM pack

- `src/lib/pdf/measure-and-pack.ts` — mide en un contenedor oculto con las mismas clases del lector.
- `POST .../paginate` — cualquier miembro autenticado de la comunidad; escribe con `service_role` (RLS de books UPDATE es admin-only) solo si `pipeline_version < 8`.

## Checklist post-subida (manual)

1. Abrir el libro: overlay “Preparando páginas…” una vez; luego lectura estable.
2. **Sin scroll** en el cuerpo de la hoja.
3. **Sin franja vacía** absurda en prosa normal; hojas se sienten llenas.
4. Sección **Introducción** (u otra prosa): párrafos justificados, no renglones cortos centrados.
5. Índice / `Libro N:` legibles y centrados.
6. Comparar una sección con el PDF original (mismo orden de texto).
7. Reabrir el libro: no vuelve a “preparar páginas” (`pipeline_version = 8`).

## Libros ya subidos (reprocesar)

Libros con `pipeline_version` 4–7 se empaquetan solos en la **primera apertura** tras deployar este código (quedan en 8).

Si el contenido está realmente roto (`pipeline_version < 4` o banner legacy):

1. Borrar el libro.
2. Volver a subir el PDF (con el deploy nuevo).

## Tests

```bash
npm run test
```

Cubren calidad G1–G3, `packBlocksWithMeasuredHeights`, layout prosa, extracción, TOC, etc.

## Troubleshooting

| Síntoma | Causa probable | Acción |
|---------|----------------|--------|
| “Preparando páginas…” eterno | Medición falló (ancho 0) | Revisar consola; reabrir a pantalla completa |
| Huecos/cortes tras pack | CSS del host distinto | Verificar Literata / `.book-para` cargados |
| `supabaseKey is required` | Falta `SUPABASE_SERVICE_ROLE_KEY` | Vercel Production + Preview |
| Upload viejo sigue mal | Deploy sin este código | Commit + push; no re-subir hasta Ready |
| Column `pipeline_version` error | Migración 005 pendiente | SQL en Supabase |
