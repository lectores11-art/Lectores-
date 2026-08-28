# Matriz RLS — rol × tabla × operación (S2-05)

Fuente: `supabase/migrations/001_initial_schema.sql` + `006_rls_hardening.sql` + `012_invite_pending_payment.sql` + `013_stripe_connect.sql` + `014_protect_connect_fields.sql`.  
Aplicar migraciones en el proyecto Supabase; el agente no ejecuta SQL en prod.

Leyenda: ✅ permitido · ❌ denegado · 🔒 solo vía `service_role` / SECURITY DEFINER RPC

| Tabla | anon | member (misma comunidad) | member (otra comunidad) | owner / community_owner | super_admin |
|-------|------|--------------------------|-------------------------|-------------------------|-------------|
| **profiles** SELECT | ❌ | ✅ propio + peers de comunidades compartidas | ❌ (salvo peer overlap) | ✅ peers de su comunidad | ✅ todos |
| **profiles** UPDATE | ❌ | ✅ propio (`is_super_admin` bloqueado por trigger) | ❌ | ✅ propio | ✅ (trigger bloquea flip vía JWT; SQL dashboard/service_role sí) |
| **communities** SELECT | ❌ (invite GET usa service_role) | ✅ `active` · 🔒 paywall: `pending/cancelled/expired` propios | ❌ | ✅ | ✅ |
| **communities** INSERT/UPDATE/DELETE | ❌ | ❌ | ❌ | UPDATE propia | ✅ ALL |
| **memberships** SELECT | ❌ | ✅ propias | ❌ | ✅ de su comunidad | ✅ |
| **memberships** INSERT | ❌ | 🔒 `accept_invite(token)` → role=`member` | ❌ | ✅ admin policy | ✅ |
| **memberships** UPDATE/DELETE | ❌ | ❌ (reactivar vía `accept_invite`) | ❌ | ✅ | ✅ |
| **invites** SELECT | 🔒 `lookup_invite_by_token` | ❌ listado | ❌ | ✅ | ✅ |
| **invites** INSERT/UPDATE/DELETE | ❌ | ❌ | ❌ | ✅ | ✅ |
| **subscriptions** SELECT | ❌ | ✅ propias | ❌ | ✅ de su comunidad | ✅ |
| **subscriptions** UPDATE | ❌ | ✅ propias | ❌ | ❌ (salvo propias) | 🔒 service en webhooks |
| **forum_threads/posts** | ❌ | ✅ CRUD acotado (autor/admin) | ❌ | ✅ admin | vía member helpers |
| **forum_reactions** | ❌ | ✅ propias + member del hilo | ❌ | ✅ | ✅ |
| **courses/lessons** | ❌ | ✅ publicados | ❌ | ✅ manage | ✅ |
| **lesson_progress** | ❌ | ✅ propias + member del course | ❌ | ✅ | ✅ |
| **books** | ❌ | ✅ publicados | ❌ | ✅ manage | ✅ |
| **reading_progress / bookmarks** | ❌ | ✅ propias + member del book | ❌ | ✅ | ✅ |
| **meetings / chat** | ❌ | ✅ view/send | ❌ | ✅ manage | ✅ |
| **calendar_events** SELECT | ❌ | ✅ | ❌ | ✅ | ✅ |
| **calendar_events** write | ❌ | ❌ | ❌ | ✅ | ✅ |
| **storage.objects (books)** | ❌ | ✅ SELECT path `{community_id}/…` | ❌ | ✅ upload/delete | ✅ |

## Cambios críticos en 006

1. Trigger `protect_super_admin_flag` — no self-elevation a super-admin.
2. Eliminada INSERT abierta en `memberships`; alta solo vía `accept_invite` o admin.
3. Eliminada SELECT de todos los invites activos; lookup exacto por token vía RPC.
4. Progress/bookmarks/reactions/lesson_progress exigen membresía de la comunidad padre.
5. Calendar write solo admin (antes cualquier member con `created_by = auth.uid()`).
6. `is_community_member` / `get_user_community_ids` incluyen `owner_id`.

## RPCs nuevas

| Función | Quién | Uso |
|---------|-------|-----|
| `lookup_invite_by_token(text)` | anon, authenticated | disponible para clients; GET API usa service_role |
| `accept_invite(text)` | authenticated | `POST /api/invites/join` → membership `pending` (012) |
| `is_community_paywall_visitor(uuid)` | authenticated | SELECT de `communities` para el overlay de pago; no abre foro/libros |

## 013 — Stripe Connect

Columnas en `communities`: `stripe_account_id`, `stripe_charges_enabled`, `commission_starts_at`. Mismas policies SELECT. Escritura de cuenta via `service_role` en `/api/c/[slug]/stripe/connect`. Trigger `protect_community_connect_fields` (014): el JWT `authenticated` (dueña incluida) no puede cambiar esas tres columnas. `UNIQUE (stripe_account_id)`.
