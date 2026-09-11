export const LEGAL_DRAFT_NOTICE =
  "Borrador interno. Pendiente de revisión por un abogado colegiado en España. No constituye contrato ni asesoramiento legal.";

export const LEGAL_PAGES = [
  { href: "/aviso-legal", label: "Aviso legal" },
  { href: "/terminos", label: "Términos" },
  { href: "/privacidad", label: "Privacidad" },
  { href: "/cookies", label: "Cookies" },
  { href: "/desistimiento", label: "Desistimiento" },
] as const;

export const LEGAL_COPY: Record<
  string,
  { title: string; sections: { heading: string; body: string }[] }
> = {
  "aviso-legal": {
    title: "Aviso legal",
    sections: [
      {
        heading: "Identidad del prestador",
        body: "Hilo de Letras es un servicio de comunidades privadas de lectura. El titular que debe figurar aquí (nombre y apellidos o razón social, NIF, domicilio, email) lo confirma el gestor: hoy la cuenta Stripe de plataforma está a nombre de una persona física, sin alta de autónomo. Hasta que exista ese dato, este aviso no está vigente.",
      },
      {
        heading: "Objeto",
        body: "La plataforma aloja clubs de lectura (foro, biblioteca, classroom, sala en vivo y pagos). No somos editorial ni concedemos derechos de autor sobre las obras que una creadora suba.",
      },
    ],
  },
  terminos: {
    title: "Términos de uso (borrador)",
    sections: [
      {
        heading: "Quién cobra",
        body: "La suscripción la cobra la creadora de cada comunidad a través de Stripe Connect. Hilo retiene una comisión decreciente (60 % a 0 % en 90 días). El texto definitivo debe decir quién factura y cómo se cancela.",
      },
      {
        heading: "Edad",
        body: "El servicio está pensado para mayores de 18 años. Al registrarte declarás esa edad.",
      },
      {
        heading: "Contenidos",
        body: "La creadora garantiza que los PDFs, portadas y grabaciones tienen permiso (dominio público, licencia abierta o acuerdo con el titular). Hilo puede ocultar o retirar contenido ante un reclamo.",
      },
      {
        heading: "Sala en vivo",
        body: "Al entrar a la sala, tu cámara o voz pueden verse u oírse por otras miembros. La app no graba la sala hoy. Las grabaciones del classroom son otro permiso, aparte.",
      },
    ],
  },
  privacidad: {
    title: "Privacidad (borrador)",
    sections: [
      {
        heading: "Qué datos hay",
        body: "Cuenta (email, nombre), país de residencia, aceptaciones de términos, membresías, pagos Stripe, progreso de lectura, mensajes del foro y del chat, y —si usás la sala— imagen y voz en tiempo real.",
      },
      {
        heading: "Para qué el país",
        body: "El país de residencia se pide para no mostrar un PDF con copyright fuera del territorio del acuerdo con el autor o la editorial. No usamos tu IP para esto.",
      },
      {
        heading: "Encargados",
        body: "Supabase, Stripe, LiveKit y Vercel. Si una creadora pega YouTube, Vimeo o Mux, esas empresas también tratan datos. La lista viva está en docs/legal/subencargados.md hasta que el abogado la pase a esta página.",
      },
      {
        heading: "Tus derechos",
        body: "Desde Cuenta podés exportar o pedir el borrado de tus datos. El texto GDPR definitivo lo firma el abogado.",
      },
    ],
  },
  cookies: {
    title: "Cookies (borrador)",
    sections: [
      {
        heading: "Necesarias",
        body: "Las cookies de sesión de Supabase hacen falta para iniciar sesión. No se pueden apagar si usás la app.",
      },
      {
        heading: "Embeds de terceros",
        body: "Un vídeo de YouTube o Vimeo puede poner cookies de esas empresas. Solo se cargan si aceptás embeds en el aviso de cookies. Mux propio se trata igual de momento.",
      },
    ],
  },
  desistimiento: {
    title: "Desistimiento (borrador)",
    sections: [
      {
        heading: "14 días",
        body: "En la UE, las consumidoras suelen tener 14 días para desistir de un contrato a distancia. En servicios digitales que empiezan al momento (entrar al club) a veces hay que pedir un consentimiento específico. El abogado redacta cómo se aplica aquí y cómo se pide el reembolso.",
      },
      {
        heading: "Cancelar la cuota",
        body: "Mientras tanto, en Cuenta podés cancelar la renovación vía el portal de Stripe. Eso no sustituye el texto legal de desistimiento.",
      },
    ],
  },
};
