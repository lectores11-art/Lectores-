# Pack para encargar a un abogado colegiado en España

**Esto no es un encargo enviado.** Es el paquete que hay que mandar al despacho. No publicar los textos de la app como Términos definitivos.

## Correo tipo

Asunto: Encargo pack legal Hilo de Letras (marketplace lectura, España / UE)

Adjuntar:

- `docs/legal/brief-abogado.md`
- `docs/legal/alta-autonomo.md` (alta fiscal de la titular; para el gestor)
- `docs/legal/subencargados.md`
- `docs/legal/portadas-publicas.md`
- Captura o URL de staging de la app (flujo join → paywall → biblioteca → sala)

Pedir presupuesto cerrado de:

1. Aviso legal LSSI  
2. Términos de la plataforma (consumidoras)  
3. Contrato/anexo de creadora (Connect + comisión + garantías de copyright)  
4. Privacidad GDPR  
5. Cookies  
6. Desistimiento 14 días + reembolsos  
7. Plantilla de licencia editorial (territorio, vivo, grabación)  
8. Procedimiento de denuncia / retirada (DSA)

Pedir también: revisión de que el titular puede ser **autónomo** (persona del Stripe actual) hasta constituir SL.

## Lo que la IA no debe hacer

- Rellenar NIF, domicilio o cláusulas como si fueran vigentes.
- Copiar DMCA de EE. UU. como régimen principal.
- Decir “cumplimos GDPR” en marketing hasta que el abogado firme la privacidad.

## Checklist humano (fuera del repo)

- [ ] Elegir despacho (propiedad intelectual + consumo + protección de datos)
- [ ] Enviar este pack
- [ ] Alta autónomo **antes del primer payout live** de `application_fee` — seguir `docs/legal/alta-autonomo.md`
- [ ] Pegar textos revisados en `/aviso-legal`, `/terminos`, `/privacidad`, `/cookies`, `/desistimiento`
- [ ] Firmar DPA de Supabase, Stripe, LiveKit, Vercel
