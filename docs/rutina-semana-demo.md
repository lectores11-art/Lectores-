# Rutina semanal — demo + agente nocturno

Semana demo: **26 jul – 2 ago 2026**. Vos: **6 h/semana**. Agente: **~3 h/noche** en la nube.

## Tus bloques humanos

| Día | Horario | Duración |
|-----|---------|----------|
| Lunes | 14:30 – 16:30 | 2 h |
| Miércoles | 10:00 – 12:00 | 2 h |
| Viernes | 18:00 – 20:00 | 2 h |

## 10 minutos antes de cada bloque

1. Abrí Notion **Entregables Desarrollo** → filtrá `En revicion` y mirá columna **PR**.
2. Abrí cada PR, leé el diff (2–5 min c/u).
3. **Mergeá** los que pasen olor (lint/build ya corrieron en el agente).
4. Pasá esas tareas a **Done** en Notion.
5. Marcá **2–3 tareas nuevas** con `Apto Agente = true` y completá **Descripción / Criterios de aceptación**.
6. Desmarcá `Apto Agente` de lo que no quieras que toque esta noche.

## Qué hace el agente vs vos

| Agente (noche, 01:00) | Vos (bloques) |
|----------------------|---------------|
| Implementa tareas con criterio claro | Mergeás PRs |
| Abre PR, actualiza Notion | Probás flujo demo a mano |
| Comenta bloqueos en Notion | Decisiones de producto |
| | Dominio, SMTP, emails |
| | Grabar videos |

## Cola sugerida por noche

| Noche | Tareas `Apto Agente` (máx. 3) |
|-------|-------------------------------|
| **Dom 26 (Run Now)** | Solo **pdfjs** (1 tarea). Desmarcar S2-09, S2-02, S2-04 hasta después del test. |
| **Lun 27 (01:00)** | S2-09, S2-02, S2-04 (marcar domingo noche después de mergear PR pdfjs) |
| Mar 28 | (revisar PRs del lun; reponer cola si mergeaste) |
| Mié 29 | S2-06, S2-07, S2-05 |
| Jue 30 | fixes que salgan del QA del mié |
| Vie 31 | solo fixes chicos para demo |
| Sáb–Dom | agente off o 1 fix si hace falta |

### Acción domingo noche (después de mergear PR pdfjs)

En Notion, marcar `Apto Agente = true` en:
- S2-09 · Validación de inputs y errores seguros en APIs
- S2-02 · Cliente Supabase de menor privilegio
- S2-04 · Control de acceso a comunidad

(Criterios de aceptación ya están escritos en cada tarea.)

## NO marcar `Apto Agente` esta semana

- CONECTAR DOMINIO SMTP
- PEND-REGISTRO (email, confirm email, recuperar contraseña)
- Super admin bootstrap
- Cualquier tarea sin criterio de aceptación escrito

## Flujo demo a validar (viernes)

1. Registro / login
2. Entrar a una comunidad
3. Biblioteca + lector PDF
4. Foro (crear hilo, comentar)
5. (Opcional) Sala / calendario si da tiempo

## Si un PR llega mal

No mergear. Comentar en Notion el motivo, desmarcar `Apto Agente`, seguir con la siguiente tarea. No uses tu bloque humano debuggeando al agente.
