# QA Sprint 2 — Aislamiento multi-tenant + security review

**Actualizado:** 2026-07-31 (S3-01, spot-check contra `main` post-merge S2-05/07/08/10/11)  
**Origen:** review estático 2026-07-30 (`agent/s2-11-qa-aislamiento`, PR #10)  
**Método:** review de código + verificación de archivos en `main` (sin credenciales Supabase / **sin E2E real**).  
**Alcance:** APIs, auth helpers, middleware, RLS, storage, platform admin, demos/bypasses.

---

## Veredicto (post-merge seguridad)

El **control de acceso a nivel de aplicación** en `/api/c/[slug]/*` y el layout `/c/[slug]` sigue alineado (S2-04).

Los **hallazgos críticos de RLS / storage / super-admin** quedaron **cerrados en código** con:

| Tema | PR | Artefacto en `main` |
|------|----|---------------------|
| RLS hardening multi-tenant | [#11](https://github.com/lectores11-art/Lectores-/pull/11) | `supabase/migrations/006_rls_hardening.sql`, `docs/RLS-MATRIX.md` |
| Super-admin + platform | [#12](https://github.com/lectores11-art/Lectores-/pull/12) | guards API/UI + bootstrap SQL en `docs/DECISIONES.md` |
| Hardening headers / env / demos | [#13](https://github.com/lectores11-art/Lectores-/pull/13) | `next.config.ts`, `docs/SEGURIDAD.md`, `.env.local.example` |
| Storage privado + signed URLs | [#14](https://github.com/lectores11-art/Lectores-/pull/14) | `007_storage_books_private_signed.sql`, `GET .../books/[bookId]/pdf` |
| Este QA (baseline) | [#10](https://github.com/lectores11-art/Lectores-/pull/10) | este documento |

**Pendiente humano (no cerrado por merge de código):**

1. Aplicar migraciones `006` y `007` (y `008` covers si aplica) en el proyecto Supabase.  
2. Checklist E2E con **2 comunidades** (§12 abajo) — **sigue pendiente**.  
3. Auth Dashboard (Redirect URLs, plantillas email) según `docs/SEGURIDAD.md`.  
4. En `main` aún existe la rama `NEXT_PUBLIC_DISABLE_AUTH` en `createClient()` (footgun local); hay trabajo abierto de limpieza (PEND-REGISTRO / S2-02 follow-up).

---

## 1. API routes (`src/app/api/`) — spot-check

| Ruta | Auth | Membership / rol | Notas post-merge |
|------|------|------------------|------------------|
| `GET/POST /api/c/[slug]/forum/threads` | `requireApiCommunityAccess` | miembro / owner / Sa | Filtra `community_id` |
| `…/forum/threads/[threadId]` | idem | pin/feature: admin | Thread ∈ community |
| `GET/POST /api/c/[slug]/books` | idem | POST admin | Upload con `createServiceClient` tras check |
| `GET …/books/[bookId]` | idem | miembro | Usa `bookParamsSchema` (zod) |
| `GET …/books/[bookId]/pdf` | idem | miembro | **Signed URL** corta (S2-07 / PR #14) |
| `POST …/progress`, `…/bookmarks` | idem | miembro | Libro ∈ community |
| `POST /api/c/[slug]/invites` | idem | admin | |
| `GET/POST /api/c/[slug]/meetings` | idem | admin / miembro | |
| `GET /api/invites/[token]` | sin login | — | Lookup vía **service_role** / RPC (post-006) |
| `POST /api/invites/join` | sesión | RPC `accept_invite` | Ya no INSERT abierto cliente |
| `GET/POST /api/platform/communities` | `is_super_admin` | — | 403 si no Sa (S2-08) |
| `POST/DELETE /api/subscriptions` | user | DELETE acota `user_id` | Demo si no hay Stripe |
| `POST /api/webhooks/stripe` | firma Stripe | — | `service_role` |

---

## 2. Auth helpers

Sin cambio de modelo: `requireApiCommunityAccess`, `hasActiveCommunityAccess`, `isCommunityAdmin`, `getCurrentUser` (fallback `service_role` para upsert de profile). Platform onboarding usa `getOrCreateOwnerByEmail` + `auth.admin`.

---

## 3. Middleware

- Refresca sesión; `/api/*` no exige sesión en middleware (handlers autentican).  
- Páginas públicas: `/`, `/login`, `/register`, `/join`, `/auth`.

---

## 4. RLS — estado tras S2-05 (PR #11)

Fuente vigente: `001_initial_schema.sql` **+** `006_rls_hardening.sql`. Matriz: `docs/RLS-MATRIX.md`.

### Críticos — cerrados en código

| # | Hallazgo original | Cierre |
|---|-------------------|--------|
| 1 | Auto-promoción `is_super_admin` | Trigger `protect_super_admin_flag` en 006; bootstrap solo SQL dashboard (`docs/DECISIONES.md`) |
| 2 | Self-insert membership sin invite | INSERT abierto removido; alta vía `accept_invite(token)` / admin |
| 3 | SELECT invites activos sin token | SELECT restringido; lookup por token vía RPC / service_role en API |

### Residuales / defense-in-depth (no críticos de aislamiento)

- Confirmar en E2E que policies de progress/bookmarks/reactions con membership se comportan tras aplicar 006.  
- Meetings start/end: preferible filtrar `community_id` en query (app ya guarda acceso).  
- Subscriptions POST: aún no exige membresía previa (producto MVP).

> **Importante:** el cierre en repo **no sustituye** aplicar `006` en el proyecto Supabase. Hasta entonces, un entorno solo con `001` sigue expuesto.

---

## 5. Storage (books / PDFs) — tras S2-07 (PR #14)

| Archivo | Estado |
|---------|--------|
| `003_storage_setup.sql` | Bucket `books` |
| `004_storage_books_rls.sql` | Path `{community_id}/…` + member/admin |
| `007_storage_books_private_signed.sql` | Endurece privado + firmadas |
| Upload API | Admin check → `service_role` write |
| Lectura PDF | `GET /api/c/[slug]/books/[bookId]/pdf` → `createSignedUrl` (~60s) |
| Lector UI | Sigue usando `content_json`; PDF original vía botón signed URL |

Aplicar `007` en Supabase es paso humano.

---

## 6. Platform admin / super-admin — tras S2-08 (PR #12)

- UI `/platform/admin`: inaccesible sin `is_super_admin` (404/redirect).  
- API platform: 403 si no Sa.  
- Bootstrap: **solo** SQL en dashboard (`docs/DECISIONES.md`) — sin UI pública de promoción.  
- Combinado con trigger 006: un JWT no puede auto-promoverse.

---

## 7. Demo / bypasses

| Mecanismo | Estado en `main` (2026-07-31) | Riesgo |
|-----------|-------------------------------|--------|
| `NEXT_PUBLIC_DISABLE_AUTH` → `createClient()` service_role | **Aún presente** (restringido `NODE_ENV !== "production"` desde S2-10) | Footgun local / misconfig; limpieza PEND-REGISTRO |
| Stripe ausente → demo | Presente | Low |
| LiveKit ausente | Depende de config | Low si no emite tokens útiles |
| Invite join → membership `active` sin pago | By design MVP | Producto |

---

## 8. Patrones de acceso (resumen)

- **Progress/bookmarks:** APIs filtran por user + libro ∈ community; RLS 006 añade membership gate.  
- **Forum/books:** solo vía API + `requireApiCommunityAccess`.  
- **Invites:** create admin; preview/join por token; join = `accept_invite`.  
- **PDF:** signed URL tras membership (no URL pública de bucket).

---

## 9. Estado código S2-0x (spot-check `main`)

| Ticket | Código en `main` | Notas |
|--------|------------------|-------|
| **S2-02** | Parcial | anon+RLS default (PR #2); **queda** rama `DISABLE_AUTH` |
| **S2-03** | Done (PR #4) | Invites/membresías reales |
| **S2-04** | Done (PR #5) | Guards API comunidad |
| **S2-05** | Done en repo (PR #11) | `006_rls_hardening.sql` — **aplicar en Supabase** |
| **S2-06** | Done (PR #3) | Progress por usuario en APIs |
| **S2-07** | Done en repo (PR #14) | Signed URLs + `007` — **aplicar en Supabase** |
| **S2-08** | Done (PR #12) | Guards + doc bootstrap |
| **S2-09** | Done (PR #1) | Validación zod (incl. book detail) |
| **S2-10** | Done (PR #13) | Headers, env docs, demos |
| **S2-11** | Done (PR #10) | Este QA; E2E humano pendiente |

---

## 10. Matriz aislamiento (esperado vs código + RLS 006)

Leyenda: ✅ OK en app+código RLS · ⚠️ depende de migración aplicada · ❌ abierto

| Acción | Ma en A | Mb→A | Notas |
|--------|---------|------|-------|
| UI `/c/A/forum` | ✅ | ✅ deny (redirect) | Layout |
| `GET /api/c/A/forum/threads` | ✅ 200 | ✅ 403 | App guard |
| Libros / progress cross-community | ✅ acotado | ✅ 403/404 | App + RLS 006 |
| Signed PDF path de otra comunidad | ✅ 403 | ✅ | API + storage |
| Direct: insert membership ajena | ⚠️ ❌→✅ | — | Cerrado **si** 006 aplicado |
| Direct: flip `is_super_admin` | ⚠️ ❌→✅ | — | Trigger 006 |
| Direct: listar invites activos | ⚠️ ❌→✅ | — | Policies 006 |
| Platform crear comunidad | 403 (no Sa) | 403 | S2-08 |

---

## 11. Issues ranqueados (actualizado)

### Cerrados en código (PRs #11–#14)

1. ~~RLS auto-promoción `is_super_admin`~~ → PR #11 + #12  
2. ~~RLS self-insert membership~~ → PR #11 (`accept_invite`)  
3. ~~RLS listado invites~~ → PR #11  
4. ~~S2-05 ausente~~ → PR #11  
5. ~~S2-07 sin signed URLs~~ → PR #14  
6. ~~S2-08 bootstrap/docs~~ → PR #12  
7. ~~Progress/bookmarks sin membership en RLS~~ → cubierto en 006 (verificar E2E)  
8. ~~Calendar INSERT miembro~~ → 006 restringe writes a admin  
9. ~~Profiles SELECT peers~~ → 006 permite peers de comunidades compartidas  

### Abiertos / residuales

| Pri | Item |
|-----|------|
| Alto (ops) | Aplicar migraciones 006/007 en Supabase + Auth dashboard |
| Medio | Quitar `NEXT_PUBLIC_DISABLE_AUTH` del runtime (`server.ts`) |
| Low | Meetings start/end sin `community_id` en UPDATE |
| Low | Subscriptions POST sin membresía previa |
| Low | Demos Stripe/LiveKit sin secrets |
| Low | Import muerto `getCurrentUser` en forum thread route |

---

## 12. Checklist E2E manual (humano + Supabase) — PENDIENTE

> Esta sección **no** se cierra con merges de código. Requiere proyecto Supabase con migraciones aplicadas y dos comunidades reales.

### Setup

1. Aplicar migraciones hasta `007` (y `008` si usás portadas).  
2. Dos comunidades A y B (platform admin / Sa).  
3. Owner A, member Ma (invite A), member Mb (invite B). Usuario Z sin membership.  
4. Confirmar `NEXT_PUBLIC_DISABLE_AUTH` **unset** (y preferible eliminada del código).  
5. Site URL + Redirect URLs según `docs/SEGURIDAD.md`.

### UI

6. Ma: entra A (foro, biblioteca, calendario, meeting) OK.  
7. Ma: abre `/c/B/forum` → redirect dashboard.  
8. Mb: simétrico.  
9. Oa: admin A, upload libro, invite, pin, meeting create.  
10. Ma: no ve controles admin / upload falla 403.  
11. Ma: botón «PDF original» abre URL firmada; Mb no puede la de A.

### API (sesión Ma)

12. `GET /api/c/A/forum/threads` → 200.  
13. `GET /api/c/B/forum/threads` → 403.  
14. `GET /api/c/A/books/{bookId_de_B}` → 404.  
15. `POST /api/c/A/books` como Ma → 403.  
16. `POST /api/c/B/books/{id}/progress` → 403.  
17. Z: cualquier `/api/c/A/*` → 401.

### RLS directo (anon + sesión Ma) — debe pasar tras 006

18. `from('invites').select('*').eq('is_active', true)` — sin tokens ajenos.  
19. `from('memberships').insert({ community_id: B, …})` — falla.  
20. `from('profiles').update({ is_super_admin: true })` — falla / no persiste.  
21. `from('books').select('*').eq('community_id', B)` — vacío/error.  
22. `from('reading_progress').upsert({ book_id: bookB, …})` — falla.  
23. Storage download path `B/…` como Ma — denegado.

### Invites / Platform

24. Token inválido / expirado / max_uses → 404/410.  
25. Join autenticado → membership vía `accept_invite`.  
26. Preview invite muestra comunidad.  
27. No-Sa → `/platform/admin` inaccesible; POST communities 403.  
28. Sa → crea comunidad + invite owner.

### Regresión demo

29. Sin Stripe/LiveKit: demos no otorgan acceso cross-tenant.

---

## 13. Citas clave (histórico + cierre)

### Antes (001) — gaps que motivaron S2-05

Ver policies originales en `001_initial_schema.sql` (profiles UPDATE abierto, memberships INSERT abierto, invites SELECT `is_active = TRUE`).

### Después — cierres

- `006_rls_hardening.sql` — trigger `protect_super_admin_flag`, `accept_invite`, policies invites/memberships.  
- `docs/RLS-MATRIX.md` — matriz rol × tabla.  
- `docs/DECISIONES.md` — SQL bootstrap super-admin.  
- `007_storage_books_private_signed.sql` + `src/app/api/c/[slug]/books/[bookId]/pdf/route.ts`.  
- App guard (sigue vigente):

```264:284:src/lib/auth/helpers.ts
/** Guard for /api/c/[slug] routes — returns 401/403/404 or the authorized context. */
export async function requireApiCommunityAccess(
  slug: string
): Promise<ApiCommunityContext | NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  // ...
}
```

---

## 14. Remediación restante (ops + residual)

1. **Humano:** aplicar `006` + `007` (+ `008`) en Supabase.  
2. **Humano:** correr §12 E2E con 2 comunidades.  
3. **Código:** eliminar `DISABLE_AUTH` de `createClient()` (PEND-REGISTRO).  
4. Low: `community_id` en meetings start/end; demos Stripe/LiveKit; dead import forum.

**E2E real:** bloqueado en el entorno del agente (sin credenciales Supabase). Usar §12.
