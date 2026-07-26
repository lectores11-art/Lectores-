# Checklist: Cursor Automation (agente nocturno)

Pasos que solo podés hacer en la UI de Cursor. Completá en orden.

## 1. Trigger a la 1:00 AM (GMT-3)

1. Abrí **Automations** → tu automation **"Agente nocturno"** (o Untitled).
2. En **Triggers**, si hay uno a las 22:00, eliminalo (ícono de borrar).
3. Click **"+ Add Trigger"** → **Scheduled**.
4. Elegí **"Every day at 01:00"** en el selector de hora.
5. Confirmá que abajo diga **GMT-3** y *Next run* a la 1:00 AM local.
6. **No pegues cron manual** (`0 1 * * *` se interpreta como UTC y queda en 22:00).

## 2. Repo, tools y prompt

- **Repository:** `lectores-` → branch `main`
- **Tools:** **+ Add Tool or MCP** → **Notion** (conectado y autenticado)
- **Agent Instructions:** pegá el prompt de [docs/agente-nocturno.md](agente-nocturno.md) (sección "Reglas no negociables" + flujo completo del runbook)
- **Nombre:** `Agente nocturno — Entregables Desarrollo`
- Click **Save**

## 3. Primera corrida de prueba (Run Now)

Antes de activar el cron:

1. **Mergeá primero el PR de prueba** (si aún no está en main):
   https://github.com/lectores11-art/Lectores-/pull/new/agent/fix-pdfjs-worker-turbopack
   (o abrí el PR existente en GitHub y mergeá)
2. En Notion, dejá **solo la tarea pdfjs** con `Apto Agente = true` para Run Now.
   Desmarcá S2-09, S2-02, S2-04 hasta después del test (ver [rutina-semana-demo.md](rutina-semana-demo.md)).
3. En la Automation, click el botón **Run / Play** (arriba a la derecha).
4. Abrí **Run History** y esperá a que termine (~30 min – 3 h).
5. Verificá:
   - PR abierto en GitHub contra `main`
   - Notion: `Status = "En revicion"` + campo `PR` con link
6. Si todo OK → activá el toggle **Inactive → Active**.

## 4. Mac apagada

La Automation corre en la nube. No necesitás la Mac prendida de noche.

## 5. Seguridad GitHub

Rotá el token embebido en el remoto `origin` de tu Mac antes de confiar pushes nocturnos automatizados. La Automation en Cursor usa la integración GitHub de tu cuenta, no el token local.
