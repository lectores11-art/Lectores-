# 08 — Adaptador EPUB → TextBlock (Gutenberg)

Esta app **no tiene parser EPUB**. Este archivo es la spec para la otra IA. El contrato de salida es el de [`01-modelo-datos.md`](01-modelo-datos.md): `TextBlock[]` en orden de lectura.

No se impone librería. Sirve `jszip` + DOMParser, `epubjs` solo para spine/HTML, o un unzip en servidor. Lo que importa es el **array de bloques**, no cómo se abre el ZIP.

## Forma de un EPUB

Un `.epub` es un ZIP:

```
mimetype
META-INF/container.xml    → apunta al OPF
OEBPS/content.opf         → manifest + spine + metadata
OEBPS/toc.ncx             → TOC EPUB2
OEBPS/nav.xhtml           → TOC EPUB3
OEBPS/ch01.xhtml          → XHTML del spine (nombres varían)
```

Gutenberg suele usar EPUB2 (`toc.ncx`) o un híbrido. El **spine** del OPF es el orden de lectura. El **manifest** es un catálogo: no lo recorras en ese orden.

## Pasos

### 1. container.xml → OPF

```xml
<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
```

Resolvé `full-path` relativo a la raíz del ZIP.

### 2. Metadata (opcional para el lector)

Del OPF: `dc:title`, `dc:creator`. Van a las props `title` / `author` de `BookReader`. No son `TextBlock`.

### 3. Spine → lista de XHTML

```
itemref idref="ch01" → manifest item href="ch01.xhtml"
```

Ignorá `linear="no"` (cubiertas, notesets que Gutenberg marca no-lineales) **o** incluí la cubierta como un `title` si querés portada tipográfica. Este lector no pinta la imagen de tapa.

### 4. Cada XHTML → bloques

Parseá como XML/HTML. Caminá el `body` en orden de documento. Mapeo:

| Nodo EPUB | TextBlock |
|---|---|
| `h1` (título de obra / parte) | `{ style: "title", text }` |
| `h2` | `{ style: "heading", text }` |
| `h3`–`h6` | `{ style: "subtitle", text }` |
| `p` | `{ style: "paragraph", text }` |
| `li` (índice, “Chapter I”) | `{ style: "list-item", text }` |
| `blockquote` de un párrafo | `{ style: "paragraph", text }` (no hay estilo quote) |
| `p` / heading con `text-align:center` o class `center` | setear `align: "center"` (el CSS de title/heading ya centra) |

Reglas:

- `text` = texto visible concatenado, whitespace colapsado (`/\s+/` → espacio), trim.
- Un `<p>` vacío o solo `&nbsp;` → **tirar**.
- `<br>` dentro de un `p`: si es verso, uní con `\n` **o** un solo espacio. Este lector justifica: los versos se ven mal. Aceptable (G4: no pixel-perfect).
- `<i>`, `<em>`, `<b>`: aplanar a texto plano. Extender el modelo es opt-in, no está en este kit.
- Notas (`<a class="footnote">`, `<aside>`): omitir o append al final como `paragraph`. No hay UI de notas.
- Páginas de Gutenberg tipo “Start of this project gutenberg ebook…”: **filtrar**. Heurística: líneas que matchean `/project gutenberg/i`, “produced by”, “transcriber”, “end of the project gutenberg”. No las mandes al lector.

### 5. Unir prosa rota

Si un capítulo es un solo `div` con `<br>` o renglones cortos (algunos EPUB viejos):

1. Partir por líneas.
2. `classifyLineStyle` + `shouldJoinProseLines` (extractos en [`03-paginador.md`](03-paginador.md)).
3. Si `prev` termina en `-`, pegar sin espacio (guion de corte).

Si el EPUB ya trae `<p>` bien formados (la mayoría de Gutenberg hoy), **no** juntes párrafos distintos.

### 6. TOC nativo

Preferencia:

1. `nav` EPUB3: `<nav epub:type="toc">` → lista de `<a href="ch03.xhtml#cap2">`.
2. `toc.ncx`: `navPoint` → `content src` + `navLabel`.
3. Fallback: `extractTOC` sobre páginas packed.

Guardá `{ title, href }` (archivo + fragmento). **Después** del pack DOM:

```
para cada entrada TOC:
  encontrar el primer PaginatedPage cuyo blocks[].text incluye el title
    o cuyo origen es el XHTML del href
  TOCItem.pageNumber = esa page.pageNumber
```

Si no hay match, no inventes “Mitad” si ya tenés nav. El rebuild de `BookReader` hoy pisa el TOC: al portar, usá el nav de EPUB primero (ver nota en [`05-lector-ui.md`](05-lector-ui.md)).

### 7. Imágenes — fuera de alcance

Cubiertas, ilustraciones, drop-caps en imagen: **no hay `TextBlockStyle: "image"`**. No las renderices en el pliego. No conviertas el lector en un visor de scans.

Si más adelante se quieren figuras: nuevo style + nodo `<img>` en `BlockView` **y** en el probe, midiendo `offsetHeight` de la imagen ya cargada. Eso es trabajo nuevo, no de este kit.

### 8. Encajar en el pipeline

```
epubBytes
  → parseSpineToBlocks()        // este adaptador
  → paginateBlocksByLines(blocks)
  → <BookReader
       pages={estimated}
       pipelineVersion={7}
       tableOfContents={tocSinPageOConEstimado}
       onDomPacked={(packed, metrics) => {
         persist({ pages: packed, pipeline_version: 12, pack_metrics: metrics,
                   table_of_contents: remapToc(toc, packed) })
       }}
     />
```

No pases el XHTML crudo a `BookReader`. No uses `epub.js` para pintar el libro (renderea iframe/CSS del EPUB, otra UX).

## Librerías (sugerencia, no requisito)

| Enfoque | Cuándo |
|---|---|
| `JSZip` + `DOMParser` | Control total, browser o Node (en Node: `@xmldom/xmldom`). |
| Parser en servidor (Python `ebooklib`, etc.) | Si el backend ya existe; devolver JSON `TextBlock[]`. |
| `epubjs` | Útil para spine/sections; **no** uses su `Rendition` como lector. |

## Prueba mental (Gutenberg)

Tomá un EPUB corto (cuento). Tras el adaptador:

1. El primer bloque no es “Project Gutenberg”.
2. Hay al menos un `heading` o `title` (capítulo / título).
3. Los `paragraph` son frases completas, no renglones de 8 palabras (salvo verso).
4. `paginateBlocksByLines` produce > 1 página en un relato de varios miles de palabras.
5. Tras `measureAndPackBlocks`, ninguna hoja scrollea y los párrafos no se cortan a mitad de renglón visual (G1).

## Qué no hacer

- Recorrer el manifest en vez del spine.
- Meter HTML de Gutenberg en `dangerouslySetInnerHTML` dentro de `.book-page-body`.
- Tratar cada archivo XHTML como “una página” del pliego (un capítulo son muchas hojas).
- Renderizar el EPUB con su CSS original (rompe el probe y el look de libro).
