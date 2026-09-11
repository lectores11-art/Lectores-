# Subencargados (encargados del tratamiento)

Lista operativa para el registro de tratamientos y para las DPAs. Confirmar URLs vigentes con cada proveedor.

| Proveedor | Para qué | DPA / docs |
|-----------|----------|------------|
| Supabase | Auth, Postgres, Storage, Realtime | [supabase.com/legal](https://supabase.com/legal) — DPA del dashboard |
| Stripe | Pagos, Connect, facturas | [stripe.com/legal/dpa](https://stripe.com/legal/dpa) |
| LiveKit Cloud | Sala de vídeo WebRTC | Contrato / DPA de LiveKit Cloud |
| Vercel | Hosting de la app Next.js | [vercel.com/legal/dpa](https://vercel.com/legal/dpa) |
| YouTube | Embeds que pega la creadora | Condiciones de YouTube; cookies de tercero → consentimiento de embeds |
| Vimeo | Idem | Condiciones Vimeo |
| Mux | Idem (recomendado a futuro con playback firmado) | DPA Mux si se usa cuenta propia |

No hay analytics propio (sin GA/PostHog en el `package.json` a fecha del brief).

Acción: el titular acepta cada DPA en el panel del proveedor cuando exista NIF/alta. No se “aceptan” desde este repositorio.
