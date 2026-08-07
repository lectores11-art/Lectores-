"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapAuthErrorMessage } from "@/lib/auth/map-auth-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InviteAuthFormProps {
  token: string;
  communityName: string;
  onAuthenticated: () => void;
}

export function InviteAuthForm({
  token,
  communityName,
  onAuthenticated,
}: InviteAuthFormProps) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  function redirectUrl() {
    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    return `${base}/auth/confirm?next=/join/${token}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResendMessage("");
    setLoading(true);

    const supabase = createClient();

    if (mode === "register") {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: redirectUrl(),
        },
      });

      if (authError) {
        setError(mapAuthErrorMessage(authError.message));
        setLoading(false);
        return;
      }

      // Supabase may return a user without identities when the email already exists
      // (anti-enumeration). Treat as "already registered".
      const identities = data.user?.identities;
      if (data.user && Array.isArray(identities) && identities.length === 0) {
        setError(
          "Este email ya está registrado. Probá iniciar sesión o reenviar la confirmación si aún no confirmaste."
        );
        setConfirmPending(true);
        setLoading(false);
        return;
      }

      // Confirmation required: no session yet. Do not claim the email was
      // delivered — SMTP may be missing in this project.
      if (!data.session) {
        if (!data.user?.email && !email.trim()) {
          setError(
            "El registro no devolvió sesión ni email. Revisá Supabase Auth (confirmación + SMTP)."
          );
          setLoading(false);
          return;
        }
        setConfirmPending(true);
        setLoading(false);
        return;
      }

      onAuthenticated();
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      const mapped = mapAuthErrorMessage(authError.message);
      setError(mapped);
      if (/confirm/i.test(mapped) || /email not confirmed/i.test(authError.message)) {
        setConfirmPending(true);
      }
      setLoading(false);
      return;
    }

    onAuthenticated();
  }

  async function resendConfirmation() {
    if (!email.trim()) {
      setResendMessage("Ingresá tu email para reenviar la confirmación.");
      return;
    }
    setResending(true);
    setResendMessage("");
    setError("");
    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: redirectUrl() },
      });
      if (resendError) {
        setResendMessage(mapAuthErrorMessage(resendError.message));
        return;
      }
      setResendMessage(
        "Si el proyecto tiene SMTP configurado, vas a recibir un nuevo correo en breve. Si no llega, pedile a la admin que revise Auth → SMTP en Supabase."
      );
    } catch {
      setResendMessage("No se pudo pedir el reenvío. Intentá de nuevo.");
    } finally {
      setResending(false);
    }
  }

  if (confirmPending) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted">
          Para entrar a{" "}
          <span className="font-semibold text-foreground">{communityName}</span>{" "}
          necesitás confirmar el email{" "}
          <span className="font-semibold text-foreground">{email}</span>.
        </p>
        <p className="text-sm text-muted">
          Si configuramos el envío de correos en Supabase Auth, vas a recibir un
          link de confirmación. Si no llega ningún mail, es probable que el SMTP
          del proyecto aún no esté configurado (no desactivamos la confirmación
          por email).
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {resendMessage && (
          <p className="text-sm text-muted">{resendMessage}</p>
        )}
        <Button
          type="button"
          className="w-full"
          disabled={resending}
          onClick={() => void resendConfirmation()}
        >
          {resending ? "Reenviando…" : "Reenviar confirmación"}
        </Button>
        <button
          type="button"
          className="text-sm font-semibold text-accent hover:underline"
          onClick={() => {
            setConfirmPending(false);
            setMode("login");
            setError("");
            setResendMessage("");
          }}
        >
          Volver al inicio de sesión
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === "register" && (
        <div className="space-y-2">
          <Label htmlFor="fullName">Nombre</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="Tu nombre"
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="tu@email.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading
          ? "Procesando..."
          : mode === "register"
            ? "Registrarme y entrar"
            : "Iniciar sesión y entrar"}
      </Button>

      <p className="text-center text-sm text-muted">
        {mode === "register" ? (
          <>
            ¿Ya tienes cuenta?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className="font-semibold text-accent hover:underline"
            >
              Inicia sesión
            </button>
          </>
        ) : (
          <>
            ¿No tienes cuenta?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className="font-semibold text-accent hover:underline"
            >
              Regístrate
            </button>
          </>
        )}
      </p>
    </form>
  );
}
