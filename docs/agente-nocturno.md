# Agente nocturno (Notion → Pull Request)

Runbook para la Cursor Automation que corre de noche, toma tareas de Notion y
abre Pull Requests. Este archivo es la fuente de verdad: el prompt de la
Automation debe resumir estas reglas, no reinventarlas.

## Fuente de tareas

- **Base de Notion:** "✳️ Entregables Desarrollo"
  `https://app.notion.com/p/2b7a05d81f57836ca71a01a0dcdc9381`
- **Data source:** `collection://ff9a05d8-1f57-83dc-bf41-0707ece40934`
- **Filtro de la cola:** `Status = "Not started" AND "Apto Agente" = true`
- Ordenar por `createdTime` ascendente (las más viejas primero), salvo que el
  usuario haya dejado alguna nota de prioridad en
  `Descripción / Criterios de aceptación`.

### Propiedades relevantes

| Propiedad | Tipo | Uso |
|---|---|---|
| `Entregables` | title | nombre de la tarea |
| `Status` | status | `Not started` → `In progress` → (PR abierto, ver nota) → `Done`/`Revisado` |
| `Apto Agente` | checkbox | **único filtro de seguridad**. Si no está marcado, el agente nunca la toca. |
| `Descripción / Criterios de aceptación` | texto | definition of done. Si está vacío o es ambiguo, tratar como bloqueada (ver abajo). |
| `PR` | url | el agente completa el link al Pull Request abierto |
| `Encargado` | person | no lo modifica el agente |

> **Nota sobre "En revisión":** la API de Notion no permite crear opciones
> nuevas de una propiedad `status` de forma programática. Mientras el usuario
> no agregue manualmente esa opción desde la UI de Notion, el agente señaliza
> "PR abierto, esperando merge" dejando `Status = "In progress"` **y** el
> campo `PR` completo. Si en el futuro se agrega la opción "En revisión" a
> mano en Notion, el agente debe empezar a usarla en su lugar.

## Presupuesto por corrida

- Tope de **tiempo**: ~3 horas desde el inicio de la corrida.
- Tope de **tareas**: máximo 5 tareas completadas (PR abierto) por corrida.
- Se detiene apenas se cumple el primero de los dos topes. Si está a mitad de
  una tarea cuando se acerca el tope de tiempo, la termina de forma prolija
  (no la deja a medio commitear) y no arranca una tarea nueva.
- Si la cola de tareas `Apto Agente = true / Not started` se vacía antes de
  agotar el presupuesto, termina la corrida y escribe el resumen.

## Flujo por tarea

1. **Tomar la tarea:** actualizar `Status = "In progress"` en Notion antes de
   escribir código (así el usuario ve en vivo qué se está haciendo si mira el
   tablero a la mañana).
2. **Crear un branch propio** desde `main`: `agent/<slug-de-la-tarea>`.
3. **Leer contexto del repo antes de tocar código:** `AGENTS.md` y
   `CLAUDE.md` en la raíz (incluye la advertencia de que esta versión de
   Next.js tiene cambios respecto a lo habitual — leer
   `node_modules/next/dist/docs/` antes de escribir código que dependa de
   convenciones de Next.js), y `docs/DECISIONES.md` para decisiones técnicas
   ya tomadas.
4. **Implementar** siguiendo el criterio de aceptación de la tarea. Si el
   criterio es ambiguo o falta información para saber cuándo está "hecho",
   tratarla como bloqueada (paso 7) en vez de adivinar alcance.
5. **Verificar antes de abrir PR:**
   - `npm run lint`
   - `npm run build`
   - Si hay tests relacionados al área tocada, correrlos.
   - Cualquier falla que no se pueda resolver con cambios acotados y
     razonables → tratar como bloqueada (paso 7).
6. **Auto-revisión de la diff (estilo Bugbot) antes de abrir el PR:**
   revisar el propio diff buscando bugs, problemas de seguridad (inyección,
   fuga de datos entre comunidades/usuarios, uso de `service_role` sin
   necesidad), edge cases sin cubrir, y que se respeten las convenciones del
   repo (`AGENTS.md`, estilo existente, colores/UI en `README.md`). Corregir
   lo que encuentre antes de seguir. No abrir el PR con hallazgos sin
   resolver.
7. **Nunca mergear ni deployar.** Abrir el Pull Request contra `main` con:
   - Título: `[Agente nocturno] <nombre de la tarea de Notion>`
   - Descripción: qué se hizo, por qué, cómo se probó (lint/build/tests), y
     link a la página de Notion de la tarea.
8. **Actualizar Notion:** completar la propiedad `PR` con el link del Pull
   Request. Dejar `Status = "In progress"` (ver nota sobre "En revisión"
   arriba) hasta que el usuario mergee y lo pase a `Done` manualmente.
9. Pasar a la siguiente tarea de la cola.

## Cuándo bloquear en vez de improvisar

Dejar la tarea en `Status = "Not started"` (no tocar el checkbox `Apto
Agente`, eso lo controla el usuario) y agregar un comentario en la página de
Notion explicando el motivo, cuando:

- Requiere credenciales, cuentas o compras externas (dominios, altas en
  servicios de terceros, claves de API nuevas).
- Requiere una decisión de producto/negocio que no está en el criterio de
  aceptación.
- El criterio de aceptación es ambiguo o contradictorio.
- Implica una migración de base de datos riesgosa o irreversible sin forma
  de probarla de forma segura.
- Lint/build/tests fallan por causas ajenas a la tarea y no se pueden
  resolver con un cambio acotado.

En todos los casos: dejar constancia clara en el comentario de Notion de qué
se intentó y qué falta para poder continuar, y pasar a la siguiente tarea de
la cola sin perder presupuesto de tiempo en darle vueltas.

## Cierre de la corrida

Al terminar (por presupuesto agotado o cola vacía), agregar un comentario en
la página principal de la base "Entregables Desarrollo" (o en la primera
tarea tocada de la corrida) con un resumen tipo:

```
Corrida nocturna <fecha>:
- Hechas (N): <tarea> → PR <link> · <tarea> → PR <link>
- Bloqueadas (N): <tarea> → motivo (ver comentario en la tarea)
- Sin tocar por falta de presupuesto: <lista, si aplica>
```

## Reglas no negociables (resumen para el prompt de la Automation)

1. Solo tomar tareas con `Apto Agente = true` y `Status = "Not started"`.
2. Nunca mergear a `main` ni deployar — siempre Pull Request y listo.
3. Auto-revisión de la diff antes de abrir cada PR.
4. `npm run lint` y `npm run build` deben pasar antes de abrir el PR.
5. Ante ambigüedad o dependencias externas: comentar en Notion y pasar a la
   siguiente tarea, nunca improvisar alcance.
6. Respetar presupuesto de tiempo/tareas por corrida.
7. Dejar todo registrado en Notion (`Status`, `PR`, comentarios) para que la
   revisión de la mañana sea rápida.
