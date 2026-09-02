# Prueba de pagos Connect (con alguien de España)

Circuito que falta cerrar: KYC de la dueña → paywall → tarjeta de test → webhook → foro.

La base (migraciones 012–014) ya está en Production. No hace falta más SQL para este test.
Keys: seguir en **test** (`sk_test_`) hasta que este circuito pase una vez.

Sitio: `https://lectores-fawn.vercel.app`

## Antes de llamar a la persona de España

- [ ] Vercel en **Ready** (último push: botón **Empezar de nuevo** en Cobros).
- [ ] Stripe Dashboard de **Entramado** en modo **prueba** (no live).
- [ ] Webhook `https://lectores-fawn.vercel.app/api/webhooks/stripe`
  - Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `account.updated`
  - **Listen to events on Connected accounts** = on
- [ ] Supabase → Authentication → Email → **Confirm email = off**
- [ ] En Admin, **Generar nuevo link**. En la lista tiene que decir **0/200** (si dice 0/25, es un link viejo: no lo uses).

## Quién hace qué

| Rol | Quién | Qué |
|---|---|---|
| Plataforma | Enzo | No usa su Gmail ni el Stripe de Entramado como dueña |
| Dueña | Persona **en España** | Admin → Cobros → Conectar Stripe. KYC e IBAN **suyos** (en test Stripe acepta datos de prueba ES) |
| Socia | Vos, incógnito, **otro mail** | Join → paywall → paga `4242…` → foro |

Si la dueña entra al onboarding y Stripe dice “ya existe cuenta para este correo”, **Empezar de nuevo** y un mail **sin** Stripe.

## Orden del test

### 1. Connect

1. Dueña: Admin → Cobros.
2. Si hay cuenta a medias (Seguir en Stripe): **Empezar de nuevo**.
3. Completar el formulario de Stripe (España).
4. Volver a Admin. Tiene que decir **Stripe conectado. Ya podés cobrar.**

SQL de control:

```sql
SELECT slug, stripe_account_id, stripe_charges_enabled
FROM communities
WHERE slug LIKE 'comunity-2%';
```

`stripe_account_id` con `acct_…` y `stripe_charges_enabled = true`.
Si hay `acct_` y `false`, el webhook `account.updated` no llegó.

### 2. Invite

1. **Generar nuevo link** → copiar.
2. Incógnito: registrarse / entrar con un mail que no sea el de la dueña.
3. Quedarse en el **paywall**, no en el foro.

### 3. Pago

Tarjeta test: `4242 4242 4242 4242`, fecha futura, CVC cualquiera.

1. Paywall → pagar.
2. El Checkout es el de **la dueña**, no el de Entramado.
3. Recargar: **foro**.
4. Admin: socias de pago = 1.
5. Mismo usuario: un segundo clic en pagar **no** abre otra suscripción.

### 4. Plataforma

En Stripe test, ese cobro:

- La mayor parte en la **cuenta conectada** de la dueña
- `application_fee` a Entramado (primer mes ~60 % si el reloj del club es reciente)

Si todo cae en Entramado, el Checkout no está usando Connect.

## Invite para ~150 socias

No son 150 links. Es **un** link para todas.

| Qué | Valor |
|---|---|
| Tope | **200 usos** (margen sobre 150) |
| Caducidad | **30 días** desde que lo generás |
| Rate limit | **60 joins/min** por IP (mismo Wi‑Fi) |

Código: `src/lib/invites/defaults.ts` (`DEFAULT_INVITE_MAX_USES = 200`).
Un row viejo con `max_uses = 25` **no se actualiza solo**. Siempre **Generar nuevo link** el día D.

SQL:

```sql
SELECT token, use_count, max_uses, expires_at, is_active, created_at
FROM invites
ORDER BY created_at DESC
LIMIT 10;
```

El que vas a pegar en el chat: `max_uses = 200`, `is_active = true`, `expires_at` a más de un día.

## Cuando esto esté verde (live)

1. Keys `sk_live_` / `pk_live_` y webhook live (mismas cuentas conectadas).
2. Dueña real de España, su KYC e IBAN reales.
3. Un pago real chico antes del día D.
4. Confirm email sigue **off**.

No pases a live si el paso 3 (4242 → foro) no funcionó en test.
