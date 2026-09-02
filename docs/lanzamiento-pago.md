# Lanzamiento: un link, cuenta, pago, entrar

Flujo del día D: la clienta pega **un** link en el chat. Cada persona pone nombre + email + contraseña, ve la comunidad borrosa y paga la suscripción mensual. El cobro lo hace **el Stripe de ella** (Connect). Cuando el webhook confirma, entra.

## Roles (no mezclar)

| Quién | Cómo entra | Qué hace |
|---|---|---|
| Super admin (Enzo) | `/login` con tu correo | Crea clubes en `/platform/admin`. El recuadro post-crear es el link de **socias**, no de la dueña. |
| Dueña (clienta) | `/login` con **el email que pusiste al crear el club** | Admin de su club: Conectar Stripe, generar invite, socias. |
| Socia | `/join/...` que genera la dueña | Cuenta → paywall → paga → foro. |

## Checklist humano (antes del live)

1. **Supabase → Authentication → Providers → Email → Confirm email = off.**  
   Siguen escribiendo el email. No esperan un mail. Sin esto, 150 personas se traban.
2. **Migraciones** `012_invite_pending_payment.sql`, `013_stripe_connect.sql` y `014_protect_connect_fields.sql` aplicadas en el proyecto Supabase.
3. **Stripe de plataforma (Lectores):**
   - Activar **Connect** (cuentas Standard). País de las dueñas: España.
   - Keys en Vercel: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
   - Webhook hacia `https://<dominio>/api/webhooks/stripe` con:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
     - `account.updated`
   - En el endpoint: **Listen to events on Connected accounts** = on. Sin esto, el pago de la clienta no activa la membresía.
4. **Vercel:** además de las keys Stripe, `STRIPE_WEBHOOK_SECRET` y `CRON_SECRET` (el cron diario de comisión manda `Authorization: Bearer CRON_SECRET`).
5. **Dueña en Admin → Cobros → Conectar Stripe.** Completa KYC + IBAN de España. El botón de pagar en el paywall aparece cuando `charges_enabled` es true. El precio sale de `monthly_price_cents` (EUR). Un `price_...` viejo de la plataforma **no** cobra: hay que conectar Stripe.
6. **Un solo invite** con tope 200 usos: generar un link **nuevo** en Admin (un row viejo de 25 usos no se actualiza solo). Copiar ese URL al chat.
7. Prueba con alguien de España: ver **`docs/prueba-pagos-connect.md`**. Camino: Connect KYC → invite nuevo (0/200) → paywall → `4242…` → foro. Un segundo clic en pagar no debe abrir otra suscripción.

## Comisión de plataforma

Reloj = `communities.commission_starts_at`. Al crear el club en plataforma podés poner el **día D**. Si lo dejás vacío, arranca al crear. No es el día en que entra cada socia.

| Días desde el lanzamiento | Lectores | Dueña |
|---|---|---|
| 0–30 | 60% | 40% |
| 31–60 | 40% | 60% |
| 61–90 | 20% | 80% |
| 91+ | 0% | 100% |

Checkout usa el % de **hoy**. Un cron diario (`/api/cron/platform-fees`, 06:00 UTC) actualiza las suscripciones ya creadas. Stripe no baja el % solo.

No guardamos la `STRIPE_SECRET_KEY` de cada clienta. Una sola key de plataforma + `Stripe-Account: acct_...`.

## Qué ve el admin

El número grande es **socias de pago** (miembros `active`, sin contar a la dueña) y el estimado `N × precio` bruto. Quien no pagó no aparece: no es socia.

## Si algo falla el día D

| Síntoma | Causa típica |
|---|---|
| Pantalla de confirmar email | Confirm email sigue ON |
| “Límite de usos” | El invite todavía tiene `max_uses = 25` (rama no mergeada o link viejo) |
| Paywall sin botón que funcione | Dueña no terminó Connect (`charges_enabled` false) o falta `STRIPE_SECRET_KEY` |
| Pagó y no entra | Webhook sin **Connected accounts**, o migraciones 012/013/014 no aplicadas |
| El dinero cae en tu Stripe, no en el de ella | No debería: Checkout ya no usa `stripe_price_id` de plataforma. Si ves esto, el deploy es viejo |
| Comisión sigue en 60% al mes 2 | Falta `CRON_SECRET` o el cron de Vercel no corre |
| Mucha gente del mismo Wi‑Fi no entra | Rate limit; el código nuevo permite 60 joins/min por IP |
