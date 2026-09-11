# 10 — Prompt para pegar a la otra IA

Copiá desde la línea “Sos una IA…” hasta el final. Adjuntá esta carpeta `docs/extractos-libro-virtual/` (o su contenido) al contexto.

---

Sos una IA que va a implementar un **libro virtual HTML** en otra aplicación. La fuente de los libros es **Project Gutenberg en EPUB**. No vas a renderizar el EPUB ni un PDF. Vas a portar la lógica de un lector existente, documentada en esta carpeta.

## Qué construir

Un lector de **pliego de dos páginas** (izquierda + derecha):

- El contenido es HTML reflowable a partir de `TextBlock[]`.
- El look de libro abierto es CSS (cantos de papel, lomo, oreja de perro). Sin flip 3D, sin canvas, sin Turn.js / StPageFlip / epub.js Rendition.
- El paso de página es instantáneo. Teclado: ← → Space. Slider por índice de pliego.
- Paginado en dos fases: estimado (`paginateBlocksByLines`) y pack DOM (`measureAndPackBlocks` con overflow-probe).
- Fuente de lectura 16px fija (el pack se mide a ese tamaño).

## Orden de lectura (obligatorio)

1. `00-LEEME.md` — mapa y contrato `BookReader`.
2. `01-modelo-datos.md` — `TextBlock`, `PaginatedPage`, `PackMetrics`.
3. `02-pipeline.md` — estimado vs pack; cuándo reempacar.
4. `03-paginador.md` — spreads, clamp par, flatten/merge.
5. `04-empaquetado-dom.md` — probe; no sumar offsetHeights.
6. `05-lector-ui.md` — estado, teclado, chrome.
7. `06-bloques-html.md` — mapeo style → tag/clase.
8. `07-css-libro.md` — CSS a extraer.
9. `08-adaptador-epub.md` — spine Gutenberg → `TextBlock[]`.
10. `09-contrato-calidad.md` — G1–G4 y anti-patrones.
11. `FUENTES.md` — si tenés el repo original y necesitás el archivo completo.

## Contrato de tipos (no lo cambies)

```ts
type TextBlockStyle = "title" | "subtitle" | "list-item" | "heading" | "paragraph";

interface TextBlock {
  style: TextBlockStyle;
  text: string;
  align?: "left" | "center" | "right";
  fontSize?: number;
  continued?: boolean; // párrafo partido; sin sangría
}

interface PaginatedPage {
  pageNumber: number; // 0-based; par = izquierda
  content: string;    // texto plano para search
  blocks?: TextBlock[];
}

interface TOCItem { title: string; pageNumber: number; }

interface PackMetrics {
  widthPx: number;
  leftHeightPx: number;
  rightHeightPx: number;
  fontSize: number; // 16
}
```

`BookReader` recibe `pages`, `pipelineVersion`, `packMetrics`, y callbacks `onPageChange`, `onBookmark`, `onDomPacked`. La persistencia es de la app destino.

## Orden de implementación

1. Tipos + CSS del libro + `BlockView` / `PageContent`.
2. Funciones de spread (`pagesForSpread`, `clampToSpreadStart`).
3. `BookReader` con páginas **ya paginadas a mano** (fixture) para validar el pliego.
4. `paginateBlocksByLines` (estimado).
5. `measureAndPackBlocks` (probe offscreen, mismas clases CSS, `document.fonts.ready`).
6. Efecto de pack + `onDomPacked` + no reflow continuo (solo si viewport cambia >10%).
7. Adaptador EPUB (container → OPF → spine → XHTML → `TextBlock[]`). Filtrar boilerplate “Project Gutenberg”.
8. TOC desde `nav.xhtml` / `toc.ncx`, remapear a `pageNumber` después del pack. No dejes que un `extractTOC` heurístico pise el nav.
9. Verificar G1–G4 (checklist en `09`).

## Qué no hacer

- No portes pdfjs, legal, Supabase, signed URLs, ni el upload admin de LECTORES.
- No pintes el EPUB con su CSS / iframe.
- No sumes `offsetHeight` de bloques para paginar.
- No reflowees en cada resize.
- No implementes imágenes en el pliego (fuera de alcance).
- No partas títulos. No dejes `currentPage` impar.
- No uses `dangerouslySetInnerHTML` con el XHTML de Gutenberg.

## Criterio de listo

Un EPUB de Gutenberg se abre: primera vez “Prepara páginas”, después navega pliegos sin scroll interno, sin cortes de renglón, sin huecos absurdos en prosa, TOC del nav salta al pliego correcto, y reabrir en la misma ventana no vuelve a empaquetar.
