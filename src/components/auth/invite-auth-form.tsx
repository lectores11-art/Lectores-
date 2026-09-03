"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapAuthError } from "@/lib/auth/map-auth-error";
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
  const [resendLocked, setResendLocked] = useState(false);

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
        },
      });

      if (authError) {
        setError(mapAuthError(authError));
        setLoading(false);
        return;
      }

      const identities = data.user?.identities;
      const alreadyKnown =
        Boolean(data.user) && Array.isArray(identities) && identities.length === 0;

      if (data.session) {
        onAuthenticated();
        return;
      }

      const { data: signedIn, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (signedIn.session) {
        onAuthenticated();
        return;
      }

      if (alreadyKnown) {
        setError("Este email ya está registrado. Probá iniciar sesión.");
        setMode("login");
        setLoading(false);
        return;
      }

      if (signInError) {
        const mapped = mapAuthError(signInError);
        setError(mapped);
        if (
          /confirm/i.test(mapped) ||
          /email not confirmed/i.test(signInError.message)
        ) {
          setConfirmPending(true);
        }
        setLoading(false);
        return;
      }

      setError(
        "El registro no dejó sesión. En Supabase: Authentication → Email → Confirm email = Off."
      );
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      const mapped = mapAuthError(authError);
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
    if (resendLocked || resending) {
      setResendMessage("Esperá un momento antes de pedir otro reenvío.");
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
        setResendMessage(mapAuthError(resendError));
        return;
      }
      setResendLocked(true);
      window.setTimeout(() => setResendLocked(false), 45_000);
      setResendMessage(
        "Si aplica, vas a recibir un correo. Si no llega, pedile a la admin que apague la confirmación de email en Supabase."
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
          hace falta una sesión abierta con{" "}
          <span className="font-semibold text-foreground">{email}</span>.
        </p>
        <p className="text-sm text-muted">
          Si no podés continuar, iniciá sesión o pedile a la administradora que
          revise la confirmación de email en Supabase.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {resendMessage && (
          <p className="text-sm text-muted">{resendMessage}</p>
        )}
        <Button
          type="button"
          className="w-full"
          disabled={resending || resendLocked}
          onClick={() => void resendConfirmation()}
        >
          {resending
            ? "Reenviando…"
            : resendLocked
              ? "Esperá un momento…"
              : "Reenviar confirmación"}
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
            ? "Registrarme"
            : "Iniciar sesión"}
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
