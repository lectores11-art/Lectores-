/**
 * Map Supabase Auth (and similar) English error messages to Spanish UI copy.
 * Unknown messages fall back to a generic Spanish string — never show raw English.
 */
export function mapAuthErrorMessage(
  message: string | null | undefined,
  fallback = "No se pudo completar la autenticación. Intentá de nuevo."
): string {
  if (!message || !message.trim()) return fallback;

  const normalized = message.trim().toLowerCase();

  const rules: Array<{ test: RegExp; es: string }> = [
    {
      test: /invalid login credentials|invalid credentials/,
      es: "Email o contraseña incorrectos.",
    },
    {
      test: /email not confirmed|email address not confirmed/,
      es: "Tenés que confirmar tu email antes de iniciar sesión.",
    },
    {
      test: /user already registered|already been registered/,
      es: "Este email ya está registrado. Probá iniciar sesión.",
    },
    {
      test: /password should be at least|password.*at least/,
      es: "La contraseña es demasiado corta.",
    },
    {
      test: /unable to validate email|invalid email/,
      es: "El email no es válido.",
    },
    {
      test: /rate limit|too many requests|over_email_send_rate_limit/,
      es: "Demasiados intentos. Esperá un momento e intentá de nuevo.",
    },
    {
      test: /network|fetch failed|failed to fetch/,
      es: "Error de conexión. Revisá tu internet e intentá de nuevo.",
    },
    {
      test: /user not found/,
      es: "Email o contraseña incorrectos.",
    },
    {
      test: /same password|should be different/,
      es: "La nueva contraseña debe ser distinta a la actual.",
    },
    {
      test: /error sending|smtp|unable to send|email.*not sent/,
      es: "No se pudo enviar el correo. Revisá la configuración SMTP de Supabase Auth.",
    },
  ];

  for (const rule of rules) {
    if (rule.test.test(normalized)) return rule.es;
  }

  // If the message already looks Spanish (accents / common words), keep it.
  if (/[áéíóúñ¿¡]|contraseña|sesión|correo|invitación/i.test(message)) {
    return message;
  }

  return fallback;
}
