# Biblioteca: portadas + libro físico

## Objetivo

Permitir que el admin suba portadas reales a la biblioteca y registre libros físicos (sin PDF) además de libros digitales.

## Modos de carga

| Modo | Nombre UI | Campos |
|------|-----------|--------|
| `pdf` | **Subir PDF** | título, autor, descripción, **portada (obligatoria)**, PDF (obligatorio) |
| `catalog` | **Registrar libro** | título, autor, descripción, **portada (obligatoria)** |

## Decisiones

- Reutilizar columna existente `books.cover_url` (no nueva columna).
- Bucket nuevo `book-covers` (público, imágenes jpeg/png/webp, 5 MB) para que `<img src={cover_url}>` funcione sin URLs firmadas.
- Mismo endpoint `POST /api/c/[slug]/books` con `mode=pdf|catalog`.
- Libros de catálogo: `pdf_storage_path = null`, sin pipeline PDF.
- UX: Formato PDF vs Físico; ocultar “Leer” / “Leer ahora” si no hay PDF.
- **No** extraer portada automática del PDF en esta iteración (calidad impredecible). Portada manual es la fuente de verdad.

## Fuera de alcance

- Extracción automática de página 1 del PDF.
- Edición/borrado de portadas existentes.
- Migraciones 006/007 preexistentes no relacionadas.
