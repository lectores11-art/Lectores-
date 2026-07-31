# Seguridad — checklist pre-producción (S2-10)

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
| `NEXT_PUBLIC_DISABLE_AUTH` | **prohibido en prod** | si `true`, `createClient()` usa service_role |

Checklist: en Vercel, confirmar que `SUPABASE_SERVICE_ROLE_KEY` no tiene prefijo `NEXT_PUBLIC_` y que `NEXT_PUBLIC_DISABLE_AUTH` no está definida.

## Auth (Supabase Dashboard — documentar, no automatizar)

Pasos manuales en Authentication → Providers / Settings:

1. **Confirm email** activado para sign-up (o invitar solo vía invite links).
2. **Password**: mínimo 8+ caracteres; preferir leak detection si el plan lo permite.
3. Redirect URLs: solo dominios propios (`NEXT_PUBLIC_APP_URL`, previews controlados).
4. Site URL = producción.
5. Desactivar sign-ups abiertos si el modelo es solo-por-invitación.

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
- [ ] No hay `NEXT_PUBLIC_DISABLE_AUTH` en prod.

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
- [ ] Sin demos / disable-auth
- [ ] `npm run lint` + `npm run build` + `npm test`
- [ ] QA manual `docs/QA-SPRINT2.md` (si disponible) o checklist S2-11
