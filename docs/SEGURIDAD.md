# Seguridad — checklist pre-producción (S2-10)

## Modelo de amenaza (Lectores!!)

- **Puerta de acceso = membresía `active`**, no “pagó este mes”.
- Entrada por **invite token**; Stripe es facturación cuando hay `stripe_price_id`.
- Launch: invite-gated; **no** gate de pago obligatorio (eso sería un ticket de producto aparte).

| Control | Estado |
|---------|--------|
| Kick → `rejoin_blocked`; leave limpia flag; join mapea 403 | ✅ código (S5-01) + migraciones 010/011 |
| Stripe webhooks lifecycle + kick fail-closed | ✅ código (S5-02) |
| LiveKit token solo si `meeting.status === "live"` | ✅ código (S5-03) |
| Invites: `max_uses=25`, `expires_at=+30d` por default | ✅ código |
| Rate limit invite lookup (30/min/IP) y join (10/min/IP) | ✅ código (in-memory / por isolate) |
| Checkout: precio solo desde `communities.stripe_price_id`; exige membership | ✅ código |
| Migraciones 006–011 + buckets | ✅ aplicadas en proyecto Supabase (MCP) |
| Auth Redirect URLs + Confirm email | ✅ Dashboard |
| Leaked passwords (HaveIBeenPwned) | ⏸ requiere plan Pro — diferido |
| SMTP real (Resend/etc.) | ⏳ humano |
| Secretos Vercel (sin `NEXT_PUBLIC_` en server keys) | ⏳ humano |
| E2E 2 comunidades (`docs/QA-SPRINT2.md` §12) | ⏳ humano |

## Headers HTTP

Configurados en `next.config.ts` para `/:path*`:

| Header | Valor |
|--------|--------|
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | camera/mic self; geolocation off |
| Content-Security-Policy | básica (`frame-ancestors 'none'`, etc.) |

Revisar CSP en prod cuando se fijen hosts exactos de Mux/Vimeo/LiveKit/Stripe.

## Secretos y variables de entorno

Ver `.env.local.example`.

| Variable | Público? | Notas |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | sí | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sí | protegida por RLS |
| `NEXT_PUBLIC_APP_URL` | sí | |
| `NEXT_PUBLIC_LIVEKIT_URL` | sí | solo URL del websocket |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | sí | publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | **no** | solo servidor |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | **no** | |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | **no** | |

Checklist: en Vercel, confirmar que `SUPABASE_SERVICE_ROLE_KEY` no tiene prefijo `NEXT_PUBLIC_`.

### `NEXT_PUBLIC_DISABLE_AUTH` — removido (S2-02)

La variable **ya no existe**. `createClient()` en `src/lib/supabase/server.ts`
siempre usa anon key + cookies (RLS activo). No hay escape hatch por env.

### Usos justificados de `createServiceClient()` (service_role)

| Lugar | Por qué saltea RLS |
|-------|--------------------|
| `GET /api/invites/[token]` | Lookup de invite por token tras endurecer SELECT de invites |
| `POST /api/platform/communities` | Bootstrap de comunidad + membership + invite (super-admin) |
| `POST /api/webhooks/stripe` | Webhooks sin sesión de usuario |
| `POST /api/c/[slug]/books` (upload) | Tras check de admin: write a storage/DB sin pelear storage RLS |
| `GET /api/c/[slug]/books/[bookId]/pdf` | Tras check de membership: mint signed URL corta |
| `getOrCreateOwnerByEmail` | `auth.admin` + lookup cross-user en platform onboarding |
| `getCurrentUser` (fallback) | Upsert de profile si el trigger de auth no creó la fila |

## Auth (Supabase Dashboard — documentar, no automatizar)

Pasos manuales en Authentication → Providers / Settings:

1. **Confirm email** activado para sign-up (o invitar solo vía invite links).
2. **Password**: mínimo 8+ caracteres; preferir leak detection si el plan lo permite.
3. **Redirect URLs** (Authentication → URL Configuration) — incluir exactamente:
   - `{NEXT_PUBLIC_APP_URL}/auth/confirm`
   - `{NEXT_PUBLIC_APP_URL}/update-password`
   - `{NEXT_PUBLIC_APP_URL}/onboarding/set-password`
   - `{NEXT_PUBLIC_APP_URL}/join/**` (o cada path de join que uses)
   - Previews controlados si aplica
4. **Site URL** = producción (`NEXT_PUBLIC_APP_URL`).
5. Desactivar sign-ups abiertos si el modelo es solo-por-invitación.
6. **Plantilla Recovery** (Authentication → Email Templates → Reset password):
   el link debe apuntar a  
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/update-password`  
   (mismo patrón que invite → `/onboarding/set-password`).

### Flujo «Olvidé mi contraseña» (app)

1. `/login` → link a `/forgot-password`
2. `resetPasswordForEmail` con `redirectTo` → `/auth/confirm?next=/update-password`
3. `/update-password` → `updateUser({ password })` (sesión de recovery)
4. Mensaje de éxito genérico (no revela si el email existe)

SMTP/Resend y dominio: **configuración humana**, no del agente.

### SMTP de Auth — pendiente de configuración humana (S4-02)

El registro por invitación (`invite-auth-form`) **no desactiva** la confirmación
por email. Si no hay SMTP, Supabase puede crear el usuario sin sesión y el
correo nunca sale: la UI avisa con copy honesto + botón **Reenviar confirmación**
(`supabase.auth.resend`).

Falta en el proyecto Supabase (humano):

1. Authentication → SMTP Settings: proveedor real (Resend / SendGrid / etc.) o
   custom SMTP con From verificado.
2. Confirmar que **Confirm email** sigue activado (no usar “Disable email
   confirmations” como atajo).
3. Revisar plantilla **Confirm signup**: link a
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=...`
   (el `next` lo fija la app vía `emailRedirectTo` hacia `/join/[token]`).
4. Rate limits de email en Auth Settings acordes al tráfico esperado.

Hasta que SMTP esté listo, los registros seguirán pidiendo confirmación y el
reenvío no entregará mail — eso es esperado, no un bug de la app.

### Invites — abuse defaults

`POST /api/c/[slug]/invites` crea invites con:

- `max_uses`: **25**
- `expires_at`: **+30 días** (UTC)

`GET /api/invites/[token]`: rate limit **30 req/min** por IP.  
`POST /api/invites/join`: rate limit **10 req/min** por IP.  
(Limiter in-memory; en serverless es por isolate — complementar con caps del invite.)

### Checkout Stripe

`POST /api/subscriptions` acepta solo `communityId`. El `price` de Checkout sale
de `communities.stripe_price_id` (nunca del body del cliente). Requiere membership
existente; sin precio configurado → 400.

### Cambio de contraseña en Settings

La UI en `/c/[slug]/settings` pide contraseña actual + nueva + confirmación (mín. 8).
Reautenticación en cliente: `signInWithPassword` → `updateUser({ password })`
(no requiere feature flag del dashboard). Opcional humano: activar
**Secure password change** en Authentication → Settings si el plan lo ofrece.
Las contraseñas nunca se loguean.

- [ ] Migraciones `001` … `006` aplicadas en el proyecto Supabase.
- [ ] Bucket `books` privado (ver S2-07 / `003`+`004` storage).
- [ ] Matriz en `docs/RLS-MATRIX.md` (S2-05).
- [ ] Super-admin solo vía SQL (ver `docs/DECISIONES.md`).

## Superficie de app

- [ ] `/platform/admin` inaccesible sin `is_super_admin` (404).
- [ ] APIs `/api/c/[slug]/*` con `requireApiCommunityAccess`.
- [ ] LiveKit / Stripe: sin tokens/URLs demo; responden error si faltan secrets.
- [x] `NEXT_PUBLIC_DISABLE_AUTH` eliminado del código (S2-02).

## npm audit (corrida 2026-07-30)

Se actualizó `next` / `eslint-config-next` a **16.2.12** (último patch estable al momento).

Hallazgos restantes reportados por `npm audit` (high):

| Paquete | Notas | Acción |
|---------|-------|--------|
| `next` (+ `postcss`/`sharp` transitivos) | El advisory de npm lista un rango hasta `16.3.0-preview.7` y sugiere “fix” `9.3.3` (incorrecto / breaking). Estamos en `16.2.12`. | Monitorear releases; no usar `npm audit fix --force`. |
| `brace-expansion` (vía eslint) | DoS en tooling de lint, no runtime prod. | Aceptado; se resuelve al actualizar toolchain. |

Re-correr `npm audit` antes de cada release.

## Checklist final pre-prod

- [ ] Auth (arriba)
- [ ] RLS + storage privado + signed URLs (S2-07)
- [ ] Secretos solo server-side
- [ ] Headers activos en deploy
- [x] Sin demos / disable-auth (S2-02)
- [ ] `npm run lint` + `npm run build` + `npm test`
- [ ] QA manual `docs/QA-SPRINT2.md` (si disponible) o checklist S2-11
