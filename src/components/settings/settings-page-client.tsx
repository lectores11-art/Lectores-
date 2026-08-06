"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDetailPanel } from "@/components/layout/detail-panel-context";
import { LogoutButton } from "@/components/auth/logout-button";
import type { Membership, Profile } from "@/lib/types/database";

export function SettingsPageClient({
  communityId,
  user,
}: {
  communityId: string;
  user: Profile;
}) {
  const [fullName, setFullName] = useState(user.full_name || "");
  const [membership, setMembership] = useState<Membership | null>(null);
  const [message, setMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const { setSearchPlaceholder } = useDetailPanel();

  useEffect(() => {
    setSearchPlaceholder("Buscar en cuenta…");
  }, [setSearchPlaceholder]);

  useEffect(() => {
    loadMembership();
  }, [communityId]);

  async function loadMembership() {
    const supabase = createClient();
    const { data } = await supabase
      .from("memberships")
      .select("*")
      .eq("community_id", communityId)
      .eq("user_id", user.id)
      .single();
    setMembership(data);
  }

  async function updateProfile(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", user.id);

    setMessage(error ? error.message : "Perfil actualizado");
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword.length < 8) {
      setPasswordError("La contraseña nueva debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("La contraseña nueva y la confirmación no coinciden.");
      return;
    }
    if (currentPassword && currentPassword === newPassword) {
      setPasswordError("La contraseña nueva debe ser distinta a la actual.");
      return;
    }

    setPasswordLoading(true);
    try {
      const supabase = createClient();

      // Soft reauth: verify current password before rotating (no dashboard flag required).
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (reauthError) {
        setPasswordError("La contraseña actual no es correcta.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setPasswordError(
          "No pudimos actualizar la contraseña. Intentá de nuevo más tarde."
        );
        return;
      }

      setPasswordSuccess("Contraseña actualizada correctamente.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordError("No pudimos actualizar la contraseña. Intentá de nuevo.");
    } finally {
      setPasswordLoading(false);
    }
  }

  async function cancelSubscription() {
    if (!membership || !confirm("¿Cancelar suscripción?")) return;

    const res = await fetch("/api/subscriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ membershipId: membership.id }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setMessage("Suscripción cancelada al final del período");
      loadMembership();
      return;
    }
    setMessage(data.error || data.message || "No se pudo cancelar la suscripción");
  }

  async function subscribe() {
    const res = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ communityId }),
    });
    const data = await res.json();
    if (res.ok && data.url) {
      window.location.href = data.url;
      return;
    }
    setMessage(data.error || data.message || "Error al suscribirse");
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Mi cuenta</h1>
        <p className="text-sm text-muted">Gestioná tu perfil y suscripción</p>
      </div>

      {message && (
        <div className="mb-4 border border-border bg-accent-light px-4 py-2 text-sm font-semibold">
          {message}
        </div>
      )}

      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="hard-shadow-sm">
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
            <CardDescription>Información de tu cuenta</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={updateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user.email} disabled />
              </div>
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <Button type="submit">Guardar perfil</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="hard-shadow-sm">
          <CardHeader>
            <CardTitle>Contraseña</CardTitle>
            <CardDescription>Cambiá tu contraseña de acceso</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="space-y-4" autoComplete="off">
              <div className="space-y-2">
                <Label htmlFor="current-password">Contraseña actual</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Nueva contraseña</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar nueva contraseña</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </div>
              {passwordError && (
                <p className="text-sm text-red-600">{passwordError}</p>
              )}
              {passwordSuccess && (
                <p className="text-sm font-semibold text-foreground">{passwordSuccess}</p>
              )}
              <Button type="submit" disabled={passwordLoading}>
                {passwordLoading ? "Guardando..." : "Cambiar contraseña"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="hard-shadow-sm">
          <CardHeader>
            <CardTitle>Suscripción</CardTitle>
            <CardDescription>
              Estado:{" "}
              <span className="font-bold text-foreground">
                {membership?.status === "active" ? "Activa" : membership?.status || "—"}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {membership?.status !== "active" ? (
              <Button onClick={subscribe}>Suscribirse</Button>
            ) : (
              <Button variant="destructive" onClick={cancelSubscription}>
                Cancelar suscripción
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="hard-shadow-sm">
          <CardHeader>
            <CardTitle>Sesión</CardTitle>
            <CardDescription>Cerrar sesión en este dispositivo</CardDescription>
          </CardHeader>
          <CardContent>
            <LogoutButton />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
