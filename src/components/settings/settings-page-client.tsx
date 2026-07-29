"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDetailPanel } from "@/components/layout/detail-panel-context";
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
  const [newPassword, setNewPassword] = useState("");
  const { setDetail, setSearchPlaceholder } = useDetailPanel();

  useEffect(() => {
    setSearchPlaceholder("Buscar en cuenta…");
    setDetail({
      kind: "account",
      title: user.full_name || "Tu cuenta",
      subtitle: user.email,
      description:
        "Desde aquí podés actualizar tu perfil, cambiar la contraseña y gestionar la suscripción de esta comunidad.",
      meta: [
        {
          label: "Estado",
          value:
            membership?.status === "active"
              ? "Activa"
              : membership?.status || "—",
        },
      ],
    });
  }, [user, membership, setDetail, setSearchPlaceholder]);

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
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setMessage(error ? error.message : "Contraseña actualizada");
    setNewPassword("");
  }

  async function cancelSubscription() {
    if (!membership || !confirm("¿Cancelar suscripción?")) return;

    const res = await fetch("/api/subscriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ membershipId: membership.id }),
    });

    if (res.ok) {
      setMessage("Suscripción cancelada al final del período");
      loadMembership();
    }
  }

  async function subscribe() {
    const res = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ communityId }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setMessage(data.message || "Error al suscribirse");
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Mi cuenta</h1>
        <p className="text-sm text-muted">Gestioná tu perfil y suscripción</p>
      </div>

      {message && (
        <div className="mb-4 border-2 border-foreground bg-band px-4 py-2 text-sm font-semibold">
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
            <form onSubmit={changePassword} className="space-y-4">
              <div className="space-y-2">
                <Label>Nueva contraseña</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <Button type="submit">Cambiar contraseña</Button>
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
      </div>
    </div>
  );
}
