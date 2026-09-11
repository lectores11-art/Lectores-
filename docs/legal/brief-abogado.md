# Brief para abogado / gestor — Hilo de Letras

**Estado:** borrador interno. No es un contrato ni sustituye asesoría legal o fiscal.  
**Fecha:** 9 de septiembre de 2026  
**Producto:** Hilo de Letras (repo Lectores) — comunidades privadas de lectura (foro, biblioteca PDF, classroom con vídeo, sala LiveKit, calendario, suscripción Stripe Connect).

## 1. Titular real (hoy)

- No hay SL española constituida.
- La cuenta **Stripe de plataforma** (Connect, `application_fee`) está a nombre de **una persona física** (pareja de quien opera el producto), **sin alta de autónomo** en España.
- Hay mención de una sociedad en **Argentina** para más adelante; no es quien debe figurar ahora en el aviso legal UE.
- Encargo al **gestor**: alta de autónomo (Hacienda + Seguridad Social) de esa persona **antes del primer euro live** de comisión, **o** constituir SL y migrar Stripe. La app no calcula IVA.
- **Decisión actual:** alta de autónomo (titular española, vive en España). Costes, plazos y checklist: `docs/legal/alta-autonomo.md`.

## 2. Modelo de negocio

- Marketplace: la **creadora / dueña del club** cobra la suscripción mensual en **EUR** vía Stripe Connect (cuenta Standard conectada).
- Hilo retiene comisión: 60 % → 40 % → 20 % → 0 % a los 90 días desde `communities.commission_starts_at`.
- Acceso por invitación. Mayores de 18 (declaración en producto).
- Público: creadoras de España en la primera oleada; las lectoras pueden residir en varios países.

## 3. Qué tiene que redactar el abogado (España)

Textos **vinculantes**, no usables los borradores de la app (van marcados como pendientes):

1. Aviso legal (LSSI: identidad, NIF, domicilio, email).
2. Términos de uso de la plataforma (lectoras).
3. Anexo / contrato de creadora (marketplace, comisión, garantía de permisos, que ella puede cobrar legalmente).
4. Política de privacidad (GDPR) + registro de tratamientos.
5. Política de cookies (sesión vs embeds YouTube/Vimeo/Mux).
6. Desistimiento y reembolsos (14 días, contenido digital).
7. Plantilla de licencia autor/editorial (territorio, plazo, vivo, grabación).
8. Canal de denuncia y retirada (DSA / alojamiento).
9. Más adelante: anexo Argentina.

## 4. Datos personales que trata la app

Cuentas (email, nombre), país de residencia (para licencias de libros), timestamps de aceptación de términos/privacidad/+18, membresías, Stripe (ids de cliente/suscripción), progreso de lectura, foro, chat de sala, reuniones (cámara/micrófono LiveKit, **sin grabación in-app hoy**), vídeos embebidos de terceros, portadas de libros (bucket público `book-covers`), PDFs privados.

**Subencargados:** ver `docs/legal/subencargados.md` (Supabase, Stripe, LiveKit, Vercel, YouTube/Vimeo/Mux si la creadora pega un enlace).

## 5. Contenidos de riesgo

- **PDFs:** solo dominio público, licencia abierta, o acuerdo con el titular. Territorio por lista de países ISO; el PDF se abre solo si el país de residencia declarado de la lectora está cubierto. Sin geo-IP.
- **Portadas:** bucket público; la admin declara que tiene permiso. Ver `docs/legal/portadas-publicas.md`.
- **Sala en vivo:** aviso de imagen/voz; no se graba en la app.
- **Classroom:** la admin declara consentimiento de personas identificables y cobertura de la obra al subir la URL.
- **UGC:** foro y chat; botón Reportar; ocultar contenido.

## 6. Huecos que el despacho debe cerrar (no el código)

- Identidad fiscal del titular y del vendedor en cada cobro (creadora vs plataforma).
- IVA / recargo de equivalencia / OSS si hay ventas B2C cross-border.
- Si la pareja no autónoma puede operar Stripe mientras tanto (respuesta: no de forma limpia).
- DPA con cada subencargado (la mayoría tienen DPA estándar).
- Representante en UE si el responsable acabara siendo la sociedad argentina.

## 7. Contacto del producto

Quien implementa el software debe pegar en las páginas legales los textos **firmados por el abogado**, sustituyendo los borradores con el aviso “Pendiente de revisión legal”.
