# Alta de autónomo — titular de Hilo de Letras (España)

**Estado:** nota interna de trabajo. **No es asesoría legal ni fiscal.** No sustituye a un gestor ni a un abogado colegiado. Las cuantías de 2026 hay que confirmarlas el día del alta en Importass y con el gestor.  
**Fecha:** 9 de septiembre de 2026  
**Decisión de producto:** dar de alta como **autónoma** a la titular actual de Stripe. No constituir SL ahora.  
**Relacionado:** `docs/legal/brief-abogado.md`, `docs/legal/pack-abogado.md`

---

## 1. Hechos (no supuestos)

- Titular de la cuenta **Stripe de plataforma** (Connect, `application_fee`): **pareja de quien construye el producto**.
- Nacionalidad: **española**. Residencia: **vive en España**. Tiene DNI. No hace falta NIE, TIE ni permiso de trabajo por ser extranjera.
- **No hay SL** española. Hay mención de una sociedad en Argentina para más adelante; **no** es quien debe figurar ahora en el aviso legal UE ni en Stripe.
- **Sin alta de autónomo** a la fecha de esta nota.
- Actividad a declarar: **plataforma / marketplace**. No vende la membresía del club. Cobra una **comisión** (`application_fee`) a las creadoras. La lectora paga a la creadora.
- “Comisión en serio” = el **primer euro real** que Stripe deposite en esa cuenta en modo **live**. No cuenta: test, tarjeta `4242`, ni comisión 0 % si no entra dinero a la plataforma.

---

## 2. Legalidad: qué sí, qué no

### Qué es legal (el camino elegido)

Darse de alta en **Hacienda (modelo 036)** y en el **RETA** **el mismo día o antes** de empezar a cobrar comisión live. Eso pone el nombre fiscal en regla para el ingreso de Hilo. No hace falta ser SL para el IVA ni para operar Stripe Connect como persona física.

Es legal:

- Que la autónoma sea la cara de Términos, Privacidad y aviso legal **hasta** que exista SL (el abogado pega NIF y domicilio reales; la IA no los inventa).
- Declarar la comisión de Stripe como **ingreso suyo**, aunque Stripe la recorte automáticamente.
- Facturar el **servicio de plataforma a las creadoras**, no a las lectoras.
- Seguir como persona física.

### Qué no es legal / es arriesgado

- Cobrar comisión **live** sin alta: cuotas atrasadas, recargo, pérdida de tarifa plana, sanción de Hacienda.
- Dejar Stripe a su nombre y facturar o declarar como si fuera otra persona.
- Usar una dirección que no sea la suya real (el domicilio del 036, de Stripe y del banco tienen que cuadrar).
- Tratar este documento o los borradores de la app como Términos definitivos.

Mientras solo haya test de Stripe o comisión 0 % **sin** ingreso a la plataforma, estáis en la ventana limpia. El reloj empieza con el **primer payout live**.

### Lo que el alta **no** cubre

- No limita la responsabilidad: deudas, reclamaciones o una demanda (copyright, reembolsos, datos) pueden alcanzar el **patrimonio personal**. La SL es el paso 2, cuando haya caja o riesgo de verdad.
- No legaliza PDFs, portadas, sala en vivo, DSA ni GDPR. Eso sigue siendo el **abogado** (`pack-abogado.md`).
- No calcula el IVA dentro de la app. El gestor liquida impuestos; el código no.

---

## 3. Dos cobros distintos (no mezclar)

| Quién cobra | Qué | Quién gestiona IVA / alta |
|---|---|---|
| La **creadora** (Stripe Connect Standard) | Cuota de la lectora al club | Ella y su gestor. El contrato de creadora debe decir que puede cobrar legalmente. |
| La **titular de Hilo** (cuenta plataforma) | Comisión 60 % → 40 % → 20 % → 0 % en 90 días (`src/lib/billing/platform-fee.ts`) | Alta de autónomo de esta nota + su gestor |

La lectora **no** es la clienta fiscal de Hilo por esa cuota. Hilo vende el **uso de la plataforma** a la creadora.

---

## 4. Requisitos que ya cubre (española, vive en España)

- DNI.
- Domicilio fiscal real en España (empadronamiento). El de Stripe y el del 036 deben coincidir.
- Cuenta bancaria española (IBAN) para domiciliar la cuota de la Seguridad Social.
- Número de la Seguridad Social (NUSS). Si no lo tiene, se pide antes o en el mismo alta.
- Certificado digital, DNI electrónico o Cl@ve.

El alta **en sí no cuesta**. Hacienda y la Tesorería no cobran por el trámite.

---

## 5. Los dos trámites (este orden)

### 5.1 Hacienda — modelo 036 (sede electrónica AEAT)

Declara: identidad, domicilio, fecha de inicio, **epígrafe IAE**, si está en IVA e IRPF.

El IAE **no se paga** siendo persona física (salvo facturación muy alta). Solo se **elige** el código. En un marketplace de comisiones el gestor suele barajar intermediación (p. ej. 631) o explotación electrónica (p. ej. 845). **Lo elige el gestor**, no un artículo de blog.

### 5.2 Seguridad Social — alta RETA (Importass)

Ventana: hasta **60 días antes** del inicio de actividad, o como tarde **el mismo día**. Si se da de alta **después** de haber empezado: mes entero de cuota, recargos, y suele **perder la tarifa plana**.

En el formulario hay que:

- Marcar expresamente la **tarifa plana** (si cumple requisitos).
- Estimar rendimientos netos mensuales (tramo de cotización).
- Domiciliar la cuota (último día hábil del mes, mes completo).

Un **Punto PAE** (muchas gestorías) hace 036 + RETA a la vez, a menudo en 24–48 h.

---

## 6. Costes orientativos (2026 — confirmar)

| Concepto | Orden de magnitud | Cuándo |
|---|---|---|
| Alta Hacienda + RETA | 0 € | Una vez |
| Certificado digital / Cl@ve | 0 € | Una vez |
| **Tarifa plana** (primera alta, o ≥2 años fuera del RETA; 3 años si ya la disfrutó) | **80 € + MEI 0,9 % ≈ 88,64 €/mes** | Meses 1–12, **independiente** de ingresos. Hay que pedirla **en el alta**. |
| Prórroga año 2 | Misma cuota reducida **si** el rendimiento neto previsto queda **bajo el SMI** y se pide en Importass **antes** de que acabe el año 1 | Meses 13–24 |
| Cuota ordinaria (sin tarifa plana) | Desde **~205,88 €/mes** (tramo bajo, rendimientos ≤ 670 €/mes) hasta **~607 €/mes** en tramos altos | Desde el mes 13 o 25, según ingresos reales |
| Gestoría online típica | **40–80 €/mes** + IVA | Cada mes (el alta a veces va incluida) |
| IVA (modelo 303) | El IVA repercutido en la comisión menos el soportado de gastos (Stripe, Vercel, etc.) | Cada trimestre |
| IRPF (modelo 130 + renta) | Adelanto ~20 % del beneficio; se regulariza en la declaración de la renta | Trimestre + campaña de renta |

**Ejemplo primer año** si cumple tarifa plana: ~90 €/mes de cuota + ~50–80 € de gestor ≈ **140–170 €/mes fijos**, aunque Hilo aún facture poco. Hay que poder pagarlo **antes** de tener ingresos.

Algunas CCAA tienen **cuota cero** (devuelven la cuota). Depende del empadronamiento. Lo mira el gestor.

Si ya trabaja por cuenta ajena: puede haber **pluriactividad** (no es incompatibilidad automática; otra bonificación). Lo cierra el gestor.

A partir del año 2 (o si no hay tarifa plana), la cuota sigue **ingresos reales**: rendimiento neto ≈ ingresos − gastos deducibles − 7 % de gastos genéricos, en tramos mensuales. No es un porcentaje fijo sobre el extracto de Stripe.

---

## 7. Plazos

| Paso | Plazo realista |
|---|---|
| Certificado digital / Cl@ve, si no lo tiene | Días |
| Elegir gestor, epígrafe, fecha de inicio | Días a 1–2 semanas |
| Alta telemática 036 + RETA | **El mismo día** con certificado; PAE a menudo 24–48 h |
| Efectos del alta | La **fecha de inicio** del 036. Debe coincidir con “ya puedo cobrar comisión live” |
| Primera cuota RETA | Domiciliada; suele cargarse a fin de mes (mes completo) |
| Modelos 303 y 130 | 1–20 abril / julio / octubre, y **1–30 enero** (4T IVA/IRPF). Aunque cobre 0 €, a menudo hay que **presentar a cero**. No presentar es sanción |
| Pedir prórroga tarifa plana | **Antes** de que terminen los primeros 12 meses |

**Orden práctico:** gestor esta semana → alta cuando el 036 esté listo → **entonces** modo live con comisión > 0. No al revés.

---

## 8. Obligaciones que no se acaban en el alta

- Cuota mensual de autónomos.
- Modelos **303** (IVA) y, en estimación directa, **130** (IRPF); **390** anual; **renta** (modelo 100).
- Libro de ingresos y gastos. Guardar facturas a su NIF (Stripe, hosting, LiveKit, dominio, gestoría, parte justificada de portátil/internet si el gestor lo acepta).
- Estar al corriente con Hacienda y SS: si hay deuda, se pierden bonificaciones y lo notan bancos / Stripe.
- Factura electrónica / Verifactu: el gestor dirá desde cuándo aplica.
- Si más adelante hay nóminas o alquiler de local: modelos 111, 115, etc.

No paga **Impuesto sobre Sociedades** (eso es de la SL).

---

## 9. Encaje con Stripe y con la app

- La cuenta plataforma **ya está** a su nombre: no hay que “crear otra titular” para el alta. Hay que **alinear** KYC de Stripe (nombre, DNI, dirección, IBAN) con el 036.
- El ingreso fiscal de Hilo es el `application_fee`, no el volumen que cobra la creadora.
- El gestor decide: a quién se factura (casi siempre a la **creadora**); si lleva IVA 21 %, inversión del sujeto pasivo (creadora UE con NIF-IVA) o no sujeción (fuera de la UE); cómo casar el extracto de Stripe con el libro de ingresos.
- La app **no** calcula IVA (`brief-abogado.md`).

Migrar Stripe a una SL más adelante es un proyecto aparte (nueva entidad, KYC, contratos). No es el plan de ahora.

---

## 10. Qué tiene que cerrar el gestor (no improvisar)

1. Epígrafe IAE y CNAE de “plataforma que cobra comisión, no vende el club”.
2. Fecha de inicio alineada con el primer payout live.
3. Tarifa plana **marcada** en Importass.
4. IVA de comisiones a creadoras españolas / UE / resto del mundo.
5. Si basta el 036 o hace falta también el 037.
6. Si la CCAA tiene cuota cero.
7. Pluriactividad, si hay trabajo por cuenta ajena.
8. Cómo documentar ingresos de Stripe (factura, extracto, serie).

**Frase para pegar al gestor:**

> Persona física, española, residente en España. Titular de la cuenta Stripe Connect de plataforma. No vende la membresía del club de lectura: cobra un `application_fee` (comisión) a las creadoras. Aún no hay SL. Alta en Hacienda y RETA **antes** del primer payout live. Pedir tarifa plana si cumple.

---

## 11. Qué tiene que cerrar el abogado (paralelo, no es el alta)

El alta fiscal no sustituye el pack de `docs/legal/pack-abogado.md`: aviso legal con NIF real, términos, contrato de creadora, privacidad, cookies, desistimiento, plantilla de licencia, canal DSA. Los textos de la app siguen siendo **borradores** hasta que el despacho los firme.

---

## 12. Recomendaciones (orden de trabajo)

1. **No activar comisión live** hasta tener justificante de alta 036 + RETA.
2. Contratar **gestor** (PAE si puede hacer el alta). No rellenar el 036 “de oídas” (epígrafe mal puesto se arrastra años).
3. Sacar o renovar **certificado digital / Cl@ve** el mismo día que se llama al gestor.
4. Llevar al gestor esta nota + `brief-abogado.md` + que Stripe ya está a su nombre.
5. Pedir **tarifa plana en el alta**, no “luego”.
6. Anotar en el calendario la fecha de los 12 meses (prórroga) y los cierres trimestrales.
7. Guardar en un sitio (no en el repo) NIF, domicilio, PDFs del 036 y del alta RETA. **Nunca** commitear NIF, DNI ni extractos.
8. Encargar el pack al **abogado** en paralelo: el día que cobre el primer euro, las páginas legales tienen que llevar su nombre y NIF de verdad.
9. Revisar KYC de Stripe el día del alta (misma dirección, mismo titular).
10. Aparcar la SL hasta que haya beneficio recurrente o riesgo patrimonial que justifique contabilidad de sociedad. Criterio de conversación: *caja* (beneficio que pague el coste extra) o *riesgo* (demandas que no deban llegar a la vivienda).

---

## 13. Checklist humano (fuera del código)

- [ ] Certificado digital, DNI-e o Cl@ve
- [ ] NUSS e IBAN español
- [ ] Gestor elegido; frase del §10 enviada
- [ ] Fecha de inicio acordada (antes del primer payout live)
- [ ] Modelo 036 presentado
- [ ] Alta RETA en Importass
- [ ] Tarifa plana solicitada en el alta
- [ ] Justificantes 036 + RETA guardados
- [ ] Stripe KYC alineado con el alta
- [ ] Calendario: trimestres 303/130 + aviso mes 11 (prórroga)
- [ ] Pack abogado enviado (`pack-abogado.md`)
- [ ] Primer euro live de `application_fee` **solo después** de lo anterior

---

## 14. Cifras a reconfirmar el día del alta

La tarifa plana de 80 € + MEI, los tramos de cotización y el SMI para la prórroga **cambian por norma**. Antes de presentar:

1. Importass → alta / simulador de cuota.
2. Preguntar al gestor el importe exacto que va a domiciliar el primer mes.
3. No copiar este documento como si las cifras fueran un contrato con la Tesorería.
