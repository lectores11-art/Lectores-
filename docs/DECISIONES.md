# Decisiones técnicas (Sprint 0)

## Pagos
- **Decisión:** Stripe Billing como pasarela principal
- **Razón:** Suscripciones recurrentes, webhooks robustos, checkout hosted
- **Alternativa fase 2:** Mercado Pago para AR/LatAm si el público lo requiere

## Video grabado (Classroom)
- **Decisión:** Embed de Mux/Vimeo/YouTube (no reproductor propio)
- **Recomendado producción:** Mux con playback firmado por comunidad
- **MVP:** URL de embed directa ingresada por la admin

## Región y moneda
- **Default:** USD vía Stripe
- **Configurable:** `monthly_price_cents` por comunidad en DB

## Video en vivo (Sala)
- **Decisión MVP:** LiveKit Cloud WebRTC (1 presentadora + audiencia)
- **Modelo:** Presentadora publica cámara; participantes solo ven + chat + lector
- **Escalado futuro:** HLS broadcast si >500 concurrentes en una sala
- **Costo estimado:** Plan Ship $50/mes (~150k min) cubre 1 comunidad activa

## Aislamiento multi-tenant
- **Decisión:** Postgres compartido + `community_id` + Row Level Security
- **Roles:** super_admin, community_owner, member

## Super-admin (bootstrap)

No hay UI pública para promover super-admins. Se marca **solo** desde el SQL Editor
de Supabase (rol `postgres` / service), nunca desde el cliente anon/authenticated:

```sql
-- Promover (reemplazar el email)
UPDATE profiles
SET is_super_admin = true
WHERE email = 'tu-email@ejemplo.com';

-- Revocar
UPDATE profiles
SET is_super_admin = false
WHERE email = 'tu-email@ejemplo.com';
```

- `/platform/admin` y `POST/GET /api/platform/communities` exigen `profiles.is_super_admin`.
- Un usuario normal recibe **403** en la API y **404** en la página admin.
- No crear rutas UI abiertas para este flag. Tras S2-05, un trigger bloquea que un JWT
  autenticado cambie `is_super_admin` sobre su propio perfil.
