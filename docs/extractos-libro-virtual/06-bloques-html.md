# 06 — Bloques → HTML

Fuente: `src/components/library/book-reader-blocks.tsx` (archivo corto; se puede copiar entero).

El lector **no** interpreta HTML del EPUB. Cada `TextBlock` es texto plano en un tag + clase. El adaptador EPUB debe haber aplanado el markup **antes**.

## PageContent

```ts
export function PageContent({ page, fontSize }: { page: PaginatedPage | null; fontSize: number }) {
  if (!page) return null;
  const blocks = getPageBlocks(page);
  return (
    <>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} fontSize={fontSize} />
      ))}
    </>
  );
}
```

`page === null` es normal: último pliego con número impar de hojas → derecha vacía. No pongas un placeholder; la hoja derecha se ve en blanco (papel).

`key={i}` basta: las páginas no se reordenan dentro de una hoja.

## BlockView

| `style` | Tag | Clase | `fontSize` |
|---|---|---|---|
| `title` | `h2` | `book-title` | `fontSize + 4` |
| `subtitle` | `p` | `book-subtitle` | `fontSize + 1` |
| `list-item` | `p` | `book-list-item` | `fontSize` |
| `heading` | `h2` | `book-heading` | `fontSize + 3` |
| `paragraph` | `p` | `book-para` | `fontSize` |
| `paragraph` + `continued` | `p` | `book-para book-para-continued` | `fontSize` |

```tsx
// paragraph (default)
<p
  className={block.continued ? "book-para book-para-continued" : "book-para"}
  style={{ fontSize }}
>
  {block.text}
</p>
```

`block.text` se pinta como **text content**, no `dangerouslySetInnerHTML`. Gutenberg a veces trae `<i>`, `<em>`, notas. El kit actual **los pierde**. Si la otra app quiere cursivas, hay que extender `TextBlock` (p. ej. `html?: string` o spans). No lo hace este lector.

`align` y `fontSize` del bloque **no se leen** en `BlockView`. El CSS fija el alineado por clase. Si el adaptador EPUB setea `align: "center"` en un párrafo, hoy se ignora. Podés aplicar `style.textAlign = block.align` si lo necesitás; el probe tendría que hacer lo mismo.

## Por qué las clases importan

El probe de [`04-empaquetado-dom.md`](04-empaquetado-dom.md) crea los **mismos** tags y clases. Si cambiás `h2` por `p` acá y no en el probe, las páginas packed no coinciden con lo pintado → cortes.

`.book-para:first-of-type` quita sangría al primer párrafo de la hoja. Un `continued` también sin sangría. Un heading no es `:first-of-type` de `.book-para`, así que el párrafo que sigue **sí** se indenta (párrafo nuevo bajo un título: correcto).

## Qué no hay

- Imágenes (`<img>`). El bloque no tiene tipo `image`.
- Notas al pie, links, drop-caps.
- Columnas, versos con sangría especial (un `paragraph` justificado los aplasta).
- Scroll: el padre `.book-page-body` es `overflow: hidden`. Si un bloque se pasa, se recorta. El pack existe para que eso no pase.
