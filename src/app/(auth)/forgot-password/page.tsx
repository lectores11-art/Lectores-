"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function recoveryRedirectUrl() {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/auth/confirm?next=/update-password`;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      // Always show the same success copy (soft anti user-enumeration).
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: recoveryRedirectUrl() }
      );

      if (resetError) {
        // Network/config errors can surface; do not reveal whether the email exists.
        const msg = resetError.message.toLowerCase();
        if (msg.includes("rate") || msg.includes("limit")) {
          setError("Demasiados intentos. Esperá un momento e intentá de nuevo.");
          return;
        }
        // For other errors (including unknown email), still show the generic success.
      }

      setSent(true);
    } catch {
      setError("No pudimos procesar la solicitud. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md hard-shadow">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-md bg-band">
            <BookOpen className="h-6 w-6" />
          </div>
          <CardTitle>Olvidé mi contraseña</CardTitle>
          <CardDescription>
            Te enviamos un enlace para crear una nueva si el email está registrado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted">
                Si existe una cuenta con ese email, vas a recibir un correo con
                instrucciones para restablecer la contraseña. Revisá también spam.
              </p>
              <Link
                href="/login"
                className="inline-block text-sm font-semibold text-accent hover:underline"
              >
                Volver a iniciar sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="tu@email.com"
                  autoComplete="email"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar enlace"}
              </Button>
              <p className="text-center text-sm text-muted">
                <Link href="/login" className="font-semibold text-accent hover:underline">
                  Volver a iniciar sesión
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
