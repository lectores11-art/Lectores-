# 09 — Contrato de calidad y anti-patrones

Fuente: `docs/book-upload-pipeline.md`. Tests en `src/lib/pdf/quality-contract.test.ts` (no se copian; las reglas sí).

En LECTORES “fiel al PDF”. En la otra app: **fiel al EPUB** (orden del spine, títulos reconocibles). No pixel-perfect de márgenes Gutenberg.

## Garantías

| # | Garantía | Cómo se cumple |
|---|---|---|
| **G1** | El texto no se corta en el borde de la hoja | Pack con overflow real (`scrollHeight > clientHeight`). Si no entra, siguiente hoja o split de párrafo. `.book-page-body { overflow: hidden }` es red de seguridad, no la estrategia. |
| **G2** | Sin huecos grandes en prosa | Si un párrafo no cabe entero, se parte y se **llena** el resto de la hoja (`splitParagraphIntoRemaining`). Slack >35% en hojas no finales = fallo (`assertPackedPageQuality`). |
| **G3** | Sin saltos raros de párrafo | Unir renglones rotos; `continued` quita sangría a mitad de frase; cuerpo `text-align: justify`. |
| **G4** | Fiel al libro en lo importante | Mismo orden de texto, headings visibles, prosa legible. No clonar márgenes, viñetas ni grabados del EPUB. |

## Checklist visual (post-implementación)

1. Abrir a pantalla completa (no un iframe chico). Primera vez: overlay “Preparando páginas…”.
2. **No hay scroll** dentro de una hoja.
3. En prosa normal, las hojas se sienten llenas (no media página vacía bajo un heading, salvo que el siguiente bloque sea un título atómico que no se parte).
4. Tras un `heading`, el párrafo sigue **en la misma hoja** si cabe.
5. Cambiar de monitor / maximizar: si alto o ancho cambian >10%, **un** re-pack. Reabrir en la misma pantalla: no.
6. Buscar una frase del medio del libro: el pliego correcto, sin texto repetido.

## Anti-patrones (no hagas esto)

1. **Pintar el EPUB o PDF en canvas / iframe / `epub.js` Rendition.** Otra arquitectura. Perdés el pliego CSS y el pack.
2. **Librería de flip 3D** (Turn.js, StPageFlip, `rotateY` por hoja). El diseño de este lector es swap instantáneo + cantos CSS.
3. **Reflow en cada `resize`.** Solo `packMetricsStale` (>10%).
4. **Sumar `offsetHeight` de cada bloque** para paginar. Margin collapse y `:first-of-type` mienten. Usá el probe.
5. **Cambiar `fontSize` sin reempacar.** Por eso el slider está clavado en 16px.
6. **Tratar cada capítulo XHTML como una página.** Un capítulo son muchas hojas del pliego.
7. **`dangerouslySetInnerHTML` con el XHTML de Gutenberg.** El probe no sabe medir ese CSS ajeno; G1 se rompe.
8. **Partir títulos.** Solo `paragraph` se parte.
9. **Navegar de a una hoja** (índice impar). `currentPage` siempre par.
10. **Meter legal, signed URLs, pdfjs, Supabase** de esta app. No aportan al lector.

## Cuando subas `PIPELINE_VERSION`

Si cambiás márgenes de `.book-para`, line-height, padding de `.book-page`, o el algoritmo del probe, incrementá la versión (acá es `12`). Todos los libros guardados con versión menor se reempacan al abrir. Si no versionás, usuarios con métricas viejas ven cortes.
