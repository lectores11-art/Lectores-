# QA Sprint 2 — Aislamiento multi-tenant + security review

**Branch:** `agent/s2-11-qa-aislamiento` (desde `main`)  
**Fecha:** 2026-07-30  
**Método:** review estático del código (sin credenciales Supabase / sin E2E real).  
**Alcance:** APIs, auth helpers, middleware, RLS, storage, platform admin, demos/bypasses, patrones de acceso, estado de S2-02/04/05/06/09.

---

## Veredicto

El **control de acceso a nivel de aplicación** en `/api/c/[slug]/*` y el layout `/c/[slug]` está razonablemente alineado tras S2-04 (`requireApiCommunityAccess` + filtro `community_id`). **La capa RLS en Postgres tiene huecos críticos** que permiten escalada a super-admin, auto-alta de membresía sin invitación, y fuga de tokens de invite — S2-05 (hardening RLS) sigue **Not started**. Storage firmado (S2-07) y documentación de bootstrap super-admin (S2-08) también pendientes.

---

## 1. API routes (`src/app/api/`)

| Ruta | Auth | Membership / rol | Notas |
|------|------|------------------|-------|
| `GET/POST /api/c/[slug]/forum/threads` | `requireApiCommunityAccess` | miembro activo / owner / super_admin | Filtra `community_id` |
| `GET/POST/PATCH /api/c/[slug]/forum/threads/[threadId]` | idem | pin/feature: `isCommunityAdmin`; like: miembro | Verifica thread ∈ community |
| `GET/POST /api/c/[slug]/books` | idem | POST: admin; GET: miembro | Upload usa `createServiceClient` tras check admin |
| `GET /api/c/[slug]/books/[bookId]` | idem | miembro | Filtra `community_id`; **sin** zod en params |
| `POST .../progress`, `.../bookmarks` | idem | miembro | Verifica libro ∈ community antes de write |
| `POST /api/c/[slug]/invites` | idem | admin | |
| `GET/POST /api/c/[slug]/meetings` | idem | create/start/end: admin; token: miembro | start/end **no** filtran `community_id` en update (mitigado por RLS si aplica) |
| `GET /api/invites/[token]` | sin login | — | Lee invites con anon+RLS |
| `POST /api/invites/join` | sesión requerida | crea membership `active` | `service_role` solo para `use_count` |
| `GET/POST /api/platform/communities` | `is_super_admin` | — | POST usa `service_role` |
| `POST/DELETE /api/subscriptions` | `getCurrentUser` | DELETE acota `user_id` | POST no exige membresía previa; demo si no hay Stripe |
| `POST /api/webhooks/stripe` | firma Stripe | — | demo `received` si no hay Stripe; `service_role` |

Helpers clave: `requireApiCommunityAccess`, `hasActiveCommunityAccess`, `isCommunityAdmin`, `getCurrentUser` en `/workspace/src/lib/auth/helpers.ts`.

---

## 2. Auth helpers (`src/lib/auth/helpers.ts`)

| Función | Rol |
|---------|-----|
| `getCurrentUser` | Session → profile; fallback `service_role` upsert; último recurso profile sintético (`is_super_admin: false`) |
| `getMembership` / `getCommunityBySlug` | anon+RLS |
| `requireCommunityAccess` | UI layout; no throw — caller redirige |
| `hasActiveCommunityAccess` | `super_admin` OR `owner_id` OR membership `active` |
| `requireApiCommunityAccess` | 401 / 404 / 403 o contexto |
| `isCommunityAdmin` | super_admin OR owner_id OR role `community_owner` + active |
| `getOrCreateOwnerByEmail` | `service_role` + `auth.admin` (platform only) |

---

## 3. Middleware

- `src/middleware.ts` → `updateSession` en `src/lib/supabase/middleware.ts`.
- Refresca sesión; redirige a `/login` si no hay user en páginas no públicas.
- **`/api/*` no exige sesión** en middleware (handlers deben autenticar).
- Si faltan `NEXT_PUBLIC_SUPABASE_*`, pasa sin auth check.

---

## 4. RLS — gaps (prioridad)

Fuente: `supabase/migrations/001_initial_schema.sql`. **No existe** `004_rls_hardening.sql` (S2-05 Not started). `004_storage_books_rls.sql` es solo storage.

### Crítico

1. **Privilege escalation vía `profiles` UPDATE**  
   Policy `"Users can update own profile"` solo exige `id = auth.uid()` — sin bloquear `is_super_admin`. Un usuario puede `UPDATE profiles SET is_super_admin = true` con la anon key.

2. **Self-join a cualquier comunidad**  
   `"Users can insert own membership via invite"` → `WITH CHECK (user_id = auth.uid())` sin validar invite, rol ni status. Permite insertarse como `community_owner` / `active` en cualquier `community_id`.

3. **Fuga de tokens de invite**  
   `"Anyone can read active invite by token"` → `USING (is_active = TRUE)` sin exigir el token. Cualquier cliente anon/authenticated puede listar **todos** los invites activos (y sus tokens).

### Importante

4. **`reading_progress` / `reading_bookmarks` / `lesson_progress` / `forum_reactions`** — solo `user_id = auth.uid()`, sin comprobar membresía del libro/hilo/lección. Writes cross-tenant posibles si se conocen UUIDs (FK). Lectura de contenido ajeno sigue bloqueada por policies de `books`/`forum_*`.

5. **`calendar_events` FOR ALL** permite a cualquier miembro insertar/gestionar filas con `created_by = auth.uid()` (UI oculta el form; RLS no).

6. **`communities` SELECT** solo miembros/super_admin — el embed `community:communities(*)` en invite GET puede devolver `community: null` para no-miembros → join UI puede fallar (regresión posible post S2-02).

7. **Memberships UPDATE** — no hay policy para que el usuario reactive su propia membresía; el branch `existing` en join puede fallar bajo RLS.

8. **`subscriptions`** — solo SELECT; UPDATE/DELETE de cancelación vía anon client puede fallar silenciosamente.

9. **`profiles` SELECT** — solo propio perfil (o super_admin). Joins `author:profiles(...)` en foro/chat pueden ocultar nombres de otros miembros.

10. **`is_community_member` no incluye `owner_id`** — owner sin fila membership tiene acceso app-level pero queries RLS pueden quedar vacías.

### Low

11. Policies FOR ALL mezcladas con SELECT/INSERT específicas (solapamiento).  
12. `get_user_community_ids()` devuelve todas las communities si `is_super_admin()` (intencional).  
13. Meeting start/end API no filtra `community_id` (defense-in-depth).

---

## 5. Storage (books / PDFs)

| Archivo | Estado |
|---------|--------|
| `003_storage_setup.sql` | Bucket privado `books`; policies iniciales = cualquier `authenticated` (demasiado abiertas) |
| `004_storage_books_rls.sql` | Corrige path `{community_id}/...` con `is_community_member` / `is_community_admin` |
| Upload API | Tras admin check, sube con **`service_role`** (bypassa storage RLS) |
| Lectura PDF | **No hay signed URLs** (S2-07 Not started). El lector usa `content_json` en la fila `books`, no el PDF en storage |

Riesgo residual: si solo se aplicó 003 en un entorno, cualquier authenticated lee/sube PDFs de todas las comunidades.

---

## 6. Platform admin / super-admin

- UI: `src/app/platform/admin/page.tsx` — redirect si `!is_super_admin`.
- API: `src/app/api/platform/communities/route.ts` — 403 si no super_admin.
- **Debilitado** por el gap RLS #1 (auto-promoción a super_admin).
- S2-08 Not started: falta doc SQL de bootstrap seguro en `docs/`.

---

## 7. Demo / bypasses

| Mecanismo | Archivo | Riesgo |
|-----------|---------|--------|
| `NEXT_PUBLIC_DISABLE_AUTH === "true"` → `createClient()` usa **service_role** | `src/lib/supabase/server.ts` | Crítico si se setea en prod: bypass RLS en cualquier query server |
| Stripe ausente → `{ demo: true }` | `subscriptions`, `webhooks/stripe` | Low (no cobro; no abre datos) |
| LiveKit ausente → `token: "demo-token"` | `meetings/route.ts` | Low (sin video real) |
| Invite join → membership `active` sin pago | by design MVP | Producto, no bypass oculto |

Pendiente Notion: `PEND-REGISTRO · Limpiar DISABLE_AUTH / service_role`.

---

## 8. Patrones de acceso

### `reading_progress` (S2-06 ✓ merge PR #3)

- List/detail: queries separadas filtradas por `user_id` del autenticado.
- POST: membership de comunidad + libro ∈ community + upsert propio.
- RLS: solo dueño — **sin** gate de comunidad (gap #4).

### Forum

- APIs con `requireApiCommunityAccess` + `community_id`.
- Pin/feature: admin. Like/reply: miembro.
- Cliente: solo fetch a APIs (no Supabase directo).

### Books / library

- List/read vía API; upload admin + service_role.
- Reader: `content_json` completo al miembro.
- Book page UI no re-chequea auth (depende del layout).

### Invites

- Crear: admin API.
- Preview/join: token; join exige sesión.
- RLS de lectura de invites es el fallo más grave de enumeración.

---

## 9. Estado código S2-0x

| Ticket | Notion | Código |
|--------|--------|--------|
| **S2-02** | Done (PR #2) | anon+RLS default; `service_role` documentado; **queda** rama `DISABLE_AUTH` |
| **S2-04** | Done (PR #5) | `requireApiCommunityAccess` en todas `/api/c/[slug]/*` |
| **S2-05** | **Not started** | Sin `004_rls_hardening.sql`; gaps §4 |
| **S2-06** | Done (PR #3) | Progreso filtrado por usuario en APIs libros |
| **S2-09** | Done (PR #1) | `src/lib/validation/*`; errores genéricos; bookId detail GET sin zod |
| **S2-07** | Not started | Path RLS en 004 storage; sin signed URLs |
| **S2-08** | Not started | Checks parciales; sin doc SQL; RLS profiles lo socava |
| **S2-11** | Este doc | Review estático + checklist E2E humano |

---

## 10. Matriz aislamiento (esperado vs actual)

Leyenda: ✅ esperado OK · ⚠️ parcial / dependeiente de RLS · ❌ falla

Usuarios: **Ma** = member comunidad A · **Oa** = owner A · **Mb** = member B · **Sa** = super_admin.

| Acción | Esperado Ma | Actual | Esperado Mb→A | Actual | Esperado Oa | Actual |
|--------|-------------|--------|---------------|--------|-------------|--------|
| UI `/c/A/forum` | ver foro A | ✅ layout | denegar | ✅ redirect dashboard | admin UI | ✅ |
| `GET /api/c/A/forum/threads` | 200 | ✅ | 403 | ✅ app | 200 | ✅ |
| `GET /api/c/A/books` | libros A + propio progress | ✅ | 403 | ✅ | 200 | ✅ |
| `GET /api/c/A/books/{idB}` (libro de B, slug A) | 404 | ✅ `community_id` | 403 | ✅ | 404 | ✅ |
| Subir libro a A | 403 | ✅ | 403 | ✅ | 200 | ✅ |
| Pin hilo en A | 403 | ✅ | 403 | ✅ | 200 | ✅ |
| Crear invite A | 403 | ✅ | 403 | ✅ | 200 | ✅ |
| Direct Supabase: insert membership A | denegar sin invite | ❌ **RLS permite** | — | ❌ | — | — |
| Direct: `profiles.is_super_admin=true` | denegar | ❌ **RLS permite** | — | ❌ | — | — |
| Direct: `select * from invites where is_active` | no listar tokens ajenos | ❌ **lista todos** | — | ❌ | — | — |
| Direct: upsert `reading_progress` book de B | denegar | ⚠️ write posible | — | ⚠️ | — | — |
| Platform crear comunidad | 403 | ✅ API | 403 | ✅ | 403 (no Sa) | ✅; Sa ✅ |
| Tras auto-promoción Sa | N/A | ❌ puede volverse Sa | — | — | — | — |

---

## 11. Issues ranqueados

### Crítico

1. RLS: auto-promoción `is_super_admin` (profiles UPDATE).  
2. RLS: self-insert membership sin invite (cualquier comunidad / rol).  
3. RLS: SELECT invites activos sin token → robo de links.  
4. `NEXT_PUBLIC_DISABLE_AUTH` → server client = service_role.

### Importante

5. S2-05 no implementado (matriz RLS incompleta).  
6. Progress/bookmarks/reactions/lesson_progress sin membership en RLS.  
7. Calendar: cualquier miembro puede INSERT vía RLS.  
8. Invite→community embed / join para no-miembros puede romperse.  
9. S2-07: sin signed URLs; dependencia de `content_json` + service_role upload.  
10. Meetings start/end sin `community_id` en query.  
11. Subscriptions POST sin check de membresía; cancel UPDATE sin policy.  
12. Profiles SELECT impide ver autores ajenos (funcional + posible workaround inseguro).

### Low

13. Book detail GET sin `bookParamsSchema`.  
14. Demo Stripe/LiveKit.  
15. `findAuthUserIdByEmail` pagina 1000 users.  
16. Import muerto `getCurrentUser` en forum thread route.

---

## 12. Checklist E2E manual (humano + Supabase)

### Setup

1. Dos comunidades A y B (platform admin).  
2. Owner A, member Ma (invite A), member Mb (invite B). Usuario Z sin membership.  
3. Confirmar `NEXT_PUBLIC_DISABLE_AUTH` **unset** en el entorno.

### UI

4. Ma: entra A (foro, biblioteca, calendario, meeting) OK.  
5. Ma: abre `/c/B/forum` → redirect dashboard.  
6. Mb: simétrico.  
7. Oa: admin A, upload libro, invite, pin, meeting create.  
8. Ma: no ve controles admin / upload falla 403.

### API (sesión Ma, cookie)

9. `GET /api/c/A/forum/threads` → 200.  
10. `GET /api/c/B/forum/threads` → 403.  
11. `GET /api/c/A/books/{bookId_de_B}` → 404.  
12. `POST /api/c/A/books` como Ma → 403.  
13. `POST /api/c/B/books/{id}/progress` → 403.  
14. Z: cualquier `/api/c/A/*` → 401.

### RLS directo (Supabase JS anon + sesión Ma)

15. `from('invites').select('*').eq('is_active', true)` — **debe** fallar o no devolver tokens de B (hoy falla el criterio).  
16. `from('memberships').insert({ community_id: B, user_id: Ma, role:'member', status:'active' })` — **debe** fallar.  
17. `from('profiles').update({ is_super_admin: true }).eq('id', Ma)` — **debe** fallar.  
18. `from('books').select('*').eq('community_id', B)` — vacío/error.  
19. `from('reading_progress').upsert({ book_id: bookB, ...})` — **debe** fallar (hoy puede pasar).  
20. Storage download path `B/...` como Ma — denegado (si 004 aplicado).

### Invites

21. Token inválido / expirado / max_uses → 404/410.  
22. Join autenticado → membership + slug.  
23. Preview `/api/invites/{token}` muestra comunidad (si RLS communities lo permite).

### Platform

24. No-Sa → `/platform/admin` redirect; POST communities 403.  
25. Sa → crea comunidad + invite owner.

### Regresión demo

26. Sin Stripe/LiveKit: demos no otorgan acceso cross-tenant.

---

## 13. Citas clave

Privilege escalation profiles:

```326:328:supabase/migrations/001_initial_schema.sql
-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = auth.uid() OR is_super_admin());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());
```

Membership self-insert:

```341:342:supabase/migrations/001_initial_schema.sql
CREATE POLICY "Users can insert own membership via invite" ON memberships FOR INSERT
  WITH CHECK (user_id = auth.uid());
```

Invites readable without token:

```347:347:supabase/migrations/001_initial_schema.sql
CREATE POLICY "Anyone can read active invite by token" ON invites FOR SELECT USING (is_active = TRUE);
```

DISABLE_AUTH → service_role:

```4:16:src/lib/supabase/server.ts
export async function createClient() {
  if (
    process.env.NEXT_PUBLIC_DISABLE_AUTH === "true" &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    const { createClient: createSupabaseClient } = await import(
      "@supabase/supabase-js"
    );

    return createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
```

API community guard (S2-04):

```264:284:src/lib/auth/helpers.ts
/** Guard for /api/c/[slug] routes — returns 401/403/404 or the authorized context. */
export async function requireApiCommunityAccess(
  slug: string
): Promise<ApiCommunityContext | NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const community = await getCommunityBySlug(slug);
  if (!community) {
    return NextResponse.json({ error: "Comunidad no encontrada" }, { status: 404 });
  }

  const membership = await getMembership(community.id, user.id);
  if (!hasActiveCommunityAccess(user, community, membership)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  return { user, community, membership };
}
```

Layout gate:

```13:18:src/app/c/[slug]/layout.tsx
  const { user, community, membership } = await requireCommunityAccess(slug);

  if (!user) redirect(`/login?redirect=/c/${slug}/forum`);
  if (!community) notFound();
  if (!membership && !user.is_super_admin && community.owner_id !== user.id) {
    redirect("/dashboard");
  }
```

---

## 14. Remediación sugerida (orden)

1. Migración RLS hardening (S2-05):  
   - profiles: impedir cambio de `is_super_admin` (column privilege / trigger / WITH CHECK).  
   - memberships INSERT: solo vía flujo controlado (service_role en join) o check de invite válido.  
   - invites SELECT: `token = current_setting(...)` no aplica; usar RPC `get_invite_by_token(t)` SECURITY DEFINER o policy que no permita LIST (p.ej. solo service_role + API).  
2. Eliminar rama `DISABLE_AUTH` / service_role en `createClient`.  
3. Membership gate en policies de progress/bookmarks/reactions.  
4. S2-07 signed URLs si se sirve PDF crudo.  
5. S2-08: doc SQL bootstrap + re-test post fix profiles.

**E2E real:** bloqueado en este entorno (sin credenciales Supabase). Usar §12.
