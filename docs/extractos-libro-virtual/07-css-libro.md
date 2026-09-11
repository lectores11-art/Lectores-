# 07 — CSS del libro

Fuente: `src/app/globals.css` líneas 30–40 y 78–561. Tipografía: Literata en `src/app/layout.tsx`.

No hay `perspective`, `rotateY` ni animación de página. Todo es caja + sombras + gradientes.

## Fuente

```ts
// layout.tsx
const literata = Literata({ subsets: ["latin"], variable: "--font-literata" });
```

```css
/* globals.css */
:root { --font-serif: var(--font-literata); }

.reader-serif {
  font-family: var(--font-literata), Georgia, "Times New Roman", serif;
}
```

El pack espera esta familia. Si la otra app usa otra serif, el probe debe usar **la misma**. Esperá `document.fonts.ready`.

## Shell

```css
.reader-shell {
  height: 100vh;
  overflow: hidden;
  background: #1a1d22; /* escenario oscuro; el papel es crema */
}
```

El libro “flota” sobre un fondo oscuro. Título externo en blanco semitransparente (`.book-external-title-*`).

## Marco y cantos (el truco “3D”)

```css
.book-block {
  display: grid;
  grid-template-columns: 28px 1fr 28px; /* canto | pliego | canto */
  background: #ebe6da;
}

.book-spread {
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: #f5f1e8;
}
```

`.book-edge-left` / `.book-edge-right`: `repeating-linear-gradient` de rayitas crema/gris = **pila de hojas**. Sombras inset en el borde interno. No es un stack de divs.

`.book-frame` solo pone sombra de levantar el libro (`box-shadow` grande). Sin borde de tapa dura.

Modo compacto: cantos de 16px, páginas más bajas.

## Hoja

```css
.book-page {
  display: flex;
  flex-direction: column;
  padding: 2.6rem 3rem 3.4rem;
  line-height: 1.8;
  height: calc(100vh - 10rem);
  max-height: calc(100vh - 10rem);
  background: #f5f1e8;
  color: #1a1a1a;
  overflow: hidden;
}

.book-page-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;          /* G1: nunca scroll dentro de la hoja */
  padding-bottom: 2.5rem;    /* el slider absoluto no tapa la última línea */
}
```

El alto `100vh - 10rem` es el presupuesto visual. El pack mide `clientHeight` de `.book-page-body`, no este calc a mano.

Gutter (profundidad del lomo), **solo sombras inset**:

```css
.book-page-left {
  box-shadow:
    inset -34px 0 36px -28px rgba(0, 0, 0, 0.28),
    inset 14px 0 18px -14px rgba(0, 0, 0, 0.14);
}
.book-page-right { /* espejo */ }
```

## Lomo

```css
.book-spine {
  position: absolute;
  left: 50%;
  width: 64px;
  transform: translateX(-50%);
  pointer-events: none;
  background: linear-gradient(to right, transparent, oscuro al 50%, transparent);
}
```

Una línea de 1px en el centro (`::after`). No divide el grid: es un overlay.

## Oreja de perro

`.page-curl-left` / `.page-curl-right`: triángulo en la esquina inferior externa con 3 layers de `linear-gradient` (sombra + cartón + papel). **Estático.** No responde al hover ni al click. No pases la página desde ahí.

## Progreso y nav

`.book-progress` absolute bottom, `pointer-events: none` en el wrapper y `auto` en hijos (el range no bloquea el texto).

`.book-nav-btn` absolute a ±2.4rem del marco, color blanco 45%. Disabled a 20% de opacidad.

## Tipografía de bloques

```css
.book-para {
  margin-bottom: 0.65rem;
  text-align: justify;
  text-indent: 1.25rem;
  hyphens: auto;
}
.book-para:first-of-type,
.book-para-continued { text-indent: 0; }
.book-para-continued { margin-top: 0; }

.book-heading {
  text-align: center;
  color: #a3231f;            /* rojo ladrillo */
  font-variant: small-caps;
  letter-spacing: 0.06em;
  font-weight: 600;
  margin: 0.35rem 0 1rem;
}

.book-title { text-align: center; font-weight: 600; /* … */ }
.book-subtitle { text-align: center; font-style: italic; /* … */ }
.book-list-item {
  text-align: center;
  text-indent: 0;
  margin-bottom: 0.2rem;
  line-height: 1.45;
  hyphens: none;
}
```

El probe replica estos márgenes al usar las mismas clases. Si cambiás `margin-bottom` de `.book-para`, **reempacá** todos los libros (`PIPELINE_VERSION++`).

## Temas

```css
.reader-sepia .book-spread,
.reader-sepia .book-page { background: #f4ecd8; color: #5c4b37; }
.reader-sepia .book-block { background: #ebe2cc; }
```

Light es el default (crema `#f5f1e8`). No hay tema oscuro de papel.

## Qué extraer al portar

Copiá el bloque `/* ===== Book Reader ===== */` (aprox. líneas 78–561) más `.reader-serif`. No copies `.meeting-livekit` ni el resto de `globals.css`.

Alzadas típicas de laptop: el calc `100vh - 10rem` asume header de app + título externo. En una app a pantalla completa podés bajar el `10rem`; entonces el pack usará un `leftHeightPx` mayor (más texto por hoja). Eso está bien: el probe se adapta.
