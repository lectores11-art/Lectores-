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
      test: /user already registered|already been registered|already exists/,
      es: "Este email ya está registrado. Probá iniciar sesión.",
    },
    {
      test: /password should be at least|password.*at least|weak_password/,
      es: "La contraseña es demasiado corta.",
    },
    {
      test: /unable to validate email|invalid email/,
      es: "El email no es válido.",
    },
    {
      test: /rate limit|too many requests|over_email_send_rate_limit|over_request_rate_limit/,
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
    {
      test: /database error saving new user|database error/,
      es: "No se pudo crear la cuenta. Si este email ya existe, iniciá sesión.",
    },
    {
      test: /leaked|pwned|compromised password|not allowed because/,
      es: "Esa contraseña es demasiado común. Elegí otra más larga (mínimo 8 caracteres, no un patrón típico).",
    },
    {
      test: /redirect_uri|redirect_to|invalid redirect/,
      es: "Auth rechazó la redirección. En Supabase: Confirm email = off, y en Redirect URLs el dominio de Vercel.",
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

const AUTH_CODE_MESSAGES: Record<string, string> = {
  user_already_exists: "Este email ya está registrado. Probá iniciar sesión.",
  email_exists: "Este email ya está registrado. Probá iniciar sesión.",
  identity_already_exists: "Este email ya está registrado. Probá iniciar sesión.",
  email_not_confirmed: "Tenés que confirmar tu email antes de iniciar sesión.",
  over_email_send_rate_limit:
    "Demasiados intentos. Esperá un momento e intentá de nuevo.",
  over_request_rate_limit:
    "Demasiados intentos. Esperá un momento e intentá de nuevo.",
  weak_password: "La contraseña es demasiado corta.",
  leaked_password:
    "Esa contraseña es demasiado común. Elegí otra más larga (mínimo 8 caracteres, no un patrón típico).",
  signup_disabled: "El registro está deshabilitado en Auth.",
  invalid_credentials: "Email o contraseña incorrectos.",
};

export function mapAuthError(err: {
  message?: string;
  code?: string;
} | null): string {
  const code = err?.code?.trim().toLowerCase() ?? "";
  if (code && AUTH_CODE_MESSAGES[code]) {
    return AUTH_CODE_MESSAGES[code];
  }
  const mapped = mapAuthErrorMessage(err?.message);
  const fallback = "No se pudo completar la autenticación. Intentá de nuevo.";
  if (mapped === fallback && code) {
    return `${fallback} (${code})`;
  }
  return mapped;
}
