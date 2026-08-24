# Lanzamiento: un link, cuenta, pago, entrar

Flujo del día D: la clienta pega **un** link en el chat. Cada persona pone nombre + email + contraseña, ve la comunidad borrosa y paga la suscripción mensual en Stripe. Cuando el webhook confirma el cobro, entra.

## Checklist humano (antes del live)

1. **Supabase → Authentication → Providers → Email → Confirm email = off.**  
   Siguen escribiendo el email. No esperan un mail de confirmación. Sin este paso, 150 personas se traban como en la prueba.
2. **Stripe España** (cuenta de la clienta, no nuestra):
   - Crear cuenta en [stripe.com](https://stripe.com) con datos de España.
   - Completar KYC e IBAN. El dinero va a su banco.
   - Producto + Price recurrente mensual en EUR. Copiar el `price_...`.
   - Keys: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
3. **Vercel:** pegar esas keys + `STRIPE_WEBHOOK_SECRET` (después del paso 4). Guardar `communities.stripe_price_id` y `monthly_price_cents` en la comunidad.
4. **Webhook** hacia `https://<dominio>/api/webhooks/stripe` con:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. **Migración** `012_invite_pending_payment.sql` aplicada en el proyecto Supabase (incluye SELECT de `communities` para socias pending).
6. **Un solo invite** con tope 200 usos (generar un link **nuevo** en Admin; el actual de 25 usos no se actualiza solo). Copiar ese URL al chat.
7. Prueba: 2–3 tarjetas de test, luego 1 pago real de 1 € o el precio de verdad. Camino: join → overlay (sin foro de verdad) → Stripe → recarga → foro. Un segundo clic en pagar no debe abrir otra suscripción.

## Qué ve el admin

En Admin, el número grande es **socias de pago** (miembros `active`, sin contar a la dueña) y el estimado `N × precio` antes de comisión Stripe. Quien no pagó no aparece: no es socia.

El split de ingresos se calcula afuera (Excel / transferencia). No hay Stripe Connect en este lanzamiento.

## Si algo falla el día D

| Síntoma | Causa típica |
|---|---|
| Pantalla de confirmar email | Confirm email sigue ON |
| “Límite de usos” | El invite todavía tiene `max_uses = 25` |
| Paywall sin botón que funcione | Falta `STRIPE_SECRET_KEY` o `stripe_price_id` |
| Pagó y no entra | Webhook mal configurado o migración 012 no aplicada |
| Mucha gente del mismo Wi‑Fi no entra | Rate limit; el código nuevo permite 60 joins/min por IP |
