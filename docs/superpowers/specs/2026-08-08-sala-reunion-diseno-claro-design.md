# Sala de reunión — diseño claro (alineado a Foro/Biblio)

Fecha: 2026-08-08  
Rama: `feat/videocam`  
Estado: implementado en `feat/videocam`

## Problema

La vista activa de la sala (`MeetingRoomClient` con LiveKit) usa un tema oscuro (`bg-slate-900` + estilos default de `@livekit/components-styles`). Eso rompe la estética clara del shell (Foro/Biblio) y deja ilegible la barra de controles de LiveKit (texto oscuro sobre fondo oscuro bajo la cámara).

Además, el chat en columna derecha (~272px) roba ancho al lector de libros, que es el foco de la reunión de lectura.

## Objetivo

Rediseñar **solo la vista en-reunión** para que:

1. Use la misma lógica visual que Foro/Biblio (fondo claro, bordes cream, botones naranja).
2. Coloque el chat **debajo** de la cámara del conductor.
3. Dé **más espacio horizontal** al libro.
4. Haga legibles los controles de video (contraste suficiente).

Fuera de alcance: listado de reuniones (ya usa Cards/Buttons del design system), APIs LiveKit, finalizar reunión, mobile “más cómodo” más allá de un apilado razonable.

## Enfoque elegido: A — Columna lateral clara

### Layout desktop

```
┌── IconRail + YellowSearchBand (sin cambios) ──────────────────┐
│ ┌── lateral ~28–32% ──────────┐ ┌── libro ~68–72% ──────────┐ │
│ │ toolbar: Ver libros | Salir │ │ toolbar / book chrome     │ │
│ │ ┌ video host ─────────────┐ │ │                           │ │
│ │ │ cámara + controles OK   │ │ │ BookReader (compact) o    │ │
│ │ └─────────────────────────┘ │ │ empty state               │ │
│ │ ┌ Chat en vivo ───────────┐ │ │                           │ │
│ │ │ mensajes                │ │ │                           │ │
│ │ │ [input] [enviar accent] │ │ │                           │ │
│ │ └─────────────────────────┘ │ │                           │ │
│ └─────────────────────────────┘ └───────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

### Layout mobile

- Columna lateral arriba (video + chat, altura limitada).
- Libro debajo, scrolleable / flex-1.
- Misma paleta clara.

## Tokens (existentes — no inventar nuevos)

| Rol        | Token / valor                          |
|------------|----------------------------------------|
| Fondo      | `--background` `#ffffff`               |
| Surface    | `--surface` `#fff8ee`                  |
| Texto      | `--foreground` `#1a1612`               |
| Muted      | `--muted` `#6b5e52`                    |
| Border     | `--border` `#e8ddd0`                   |
| Accent     | `--accent` `#e85d2a` (botones primarios) |
| Band       | `--band` `#f5c518` (si hace falta chip/estado) |
| Elevación  | `.hard-shadow-sm`                      |
| Tipografía | Space Grotesk (shell); Literata solo en el libro |

## Piezas de UI

### Contenedor de sala

- Reemplazar `bg-slate-900` / `border-slate-*` / `text-white` por `bg-background`, `border-border`, `text-foreground`, `text-muted`, `bg-surface`.
- Separadores con `border-border`.
- Altura: respetar el shell (`flex-1` dentro del `main`, evitar `h-screen` que ignore rail/band si ya está dentro del shell). Preferir `h-full min-h-0` para no romper el layout existente.

### Video (LiveKit)

- Mantener `LiveKitRoom` + audio.
- Evitar el look default oscuro de `VideoConference` completo si trae chrome ilegible:
  - Preferencia: composición más acotada (`ParticipantTile` / `GridLayout` + `ControlBar` o controles propios) **o** override CSS de variables LiveKit al tema claro.
- Controles (mic/cámara/salir/share): contraste alto; labels en español si se customizan; botones alineados a `Button` (`outline` / `default` accent).
- No duplicar un segundo chat de LiveKit: el chat de producto queda en el panel propio debajo.

### Chat

- Debajo del video, misma columna.
- Header: “Chat en vivo” + icono, tipografía del sistema.
- Mensajes: nombre en `text-foreground`/`font-medium`, cuerpo `text-sm`; fondos sutiles `bg-surface` opcionales, sin bubbles pesados.
- Input: `Input` del design system + botón enviar `variant="default"` (naranja).

### Libro

- Columna ancha (~70%).
- Empty state: icono + “Selecciona un libro…” en `text-muted` sobre fondo claro.
- “Ver libros”: `Button outline` / `default` según selección; lista de libros en banda `border-border bg-surface`.
- `BookReader` compact sin cambios de lógica; solo contenedor claro alrededor.

### Toolbar

- “Ver libros”, “Iniciar transmisión” (admin), “Salir”: componentes `Button` existentes, sin clases `text-white` / `border-slate-*`.

## Criterios de éxito

- [ ] Ningún fondo navy/slate-900 en la vista en-reunión.
- [ ] Controles bajo/al lado de la cámara legibles (contraste AA razonable).
- [ ] Chat debajo de la cámara; libro con mayoría del ancho.
- [ ] Visual coherente con Foro/Biblio al lado del rail/search band.
- [ ] Unirse / video / chat / seleccionar libro siguen funcionando.

## Archivos previstos

- Primario: `src/components/meeting/meeting-room-client.tsx`
- Posible: overrides CSS en `src/app/globals.css` (scoped a la sala) o módulo CSS de meeting si LiveKit necesita theming.
- Sin cambios de API ni de env LiveKit.

## No hacer

- No rediseñar el listado de reuniones.
- No agregar features nuevas (finalizar reunión, etc.) en este pase.
- No inventar paleta púrpura / dark mode / cards decorativas en el hero de la sala.
