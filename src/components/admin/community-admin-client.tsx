"use client";

import { useEffect, useState } from "react";
import { Copy, Link as LinkIcon, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDetailPanel } from "@/components/layout/detail-panel-context";

export function CommunityAdminClient({ slug }: { slug: string }) {
  const [invites, setInvites] = useState<{ token: string; use_count: number; max_uses: number | null }[]>([]);
  const [newInviteUrl, setNewInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const { setDetail, setSearchPlaceholder } = useDetailPanel();

  useEffect(() => {
    setSearchPlaceholder("Buscar en admin…");
    setDetail({
      kind: "admin",
      title: "Panel admin",
      description:
        "Generá links de invitación y saltá a las secciones de contenido de la comunidad.",
      meta: [{ label: "Invites", value: String(invites.length) }],
    });
  }, [invites.length, setDetail, setSearchPlaceholder]);

  async function createInvite() {
    setCreatingInvite(true);
    setInviteError("");
    const res = await fetch(`/api/c/${slug}/invites`, { method: "POST" });
    const data = await res.json();
    if (res.ok && data.invite) {
      const url = `${window.location.origin}/join/${data.invite.token}`;
      setNewInviteUrl(url);
      setInvites((prev) => [...prev, data.invite]);
    } else {
      setInviteError(data.error || "No se pudo generar el link. Intentá de nuevo.");
    }
    setCreatingInvite(false);
  }

  function copyInvite() {
    navigator.clipboard.writeText(newInviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Panel de administración</h1>
        <p className="text-sm text-muted">Gestioná tu comunidad</p>
      </div>

      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="hard-shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-accent" />
              Links de invitación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted">
              Compartí este link con tus lectoras. Solo quienes tengan el link podrán unirse.
            </p>
            <Button onClick={createInvite} disabled={creatingInvite}>
              {creatingInvite ? "Generando..." : "Generar nuevo link"}
            </Button>
            {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
            {newInviteUrl && (
              <div className="flex gap-2">
                <Input value={newInviteUrl} readOnly />
                <Button variant="outline" onClick={copyInvite}>
                  <Copy className="h-4 w-4" />
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="hard-shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-accent" />
              Acciones rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button variant="outline" asChild>
              <a href={`/c/${slug}/library`}>Gestionar biblioteca</a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`/c/${slug}/classroom`}>Gestionar classroom</a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`/c/${slug}/meeting`}>Gestionar reuniones</a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`/c/${slug}/calendar`}>Gestionar calendario</a>
            </Button>
          </CardContent>
        </Card>

        <Card className="hard-shadow-sm">
          <CardHeader>
            <CardTitle>Configuración de la comunidad</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label>Color de acento</Label>
                <Input type="color" defaultValue="#E85D2A" disabled />
                <p className="text-xs text-muted">Editable en próxima versión</p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
