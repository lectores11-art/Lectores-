"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Copy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Community } from "@/lib/types/database";

export function PlatformAdminClient() {
  const [communities, setCommunities] = useState<(Community & { invites?: { token: string }[] })[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState("");
  const [lastOwnerEmail, setLastOwnerEmail] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function loadCommunities() {
      const res = await fetch("/api/platform/communities");
      const data = await res.json();
      setCommunities(data.communities || []);
    }
    void loadCommunities();
  }, []);

  async function refreshCommunities() {
    const res = await fetch("/api/platform/communities");
    const data = await res.json();
    setCommunities(data.communities || []);
  }

  async function createCommunity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setError("");
    const form = new FormData(e.currentTarget);

    const name = String(form.get("name") || "").trim();
    const ownerEmail = String(form.get("ownerEmail") || "").trim();
    const description = String(form.get("description") || "").trim();
    const priceEur = Number(form.get("price"));

    if (!name) {
      setError("El nombre es obligatorio");
      setCreating(false);
      return;
    }
    if (!ownerEmail || !ownerEmail.includes("@")) {
      setError("Email de la dueña inválido");
      setCreating(false);
      return;
    }
    if (!Number.isFinite(priceEur) || priceEur < 0) {
      setError("El precio debe ser un número ≥ 0");
      setCreating(false);
      return;
    }

    const res = await fetch("/api/platform/communities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || null,
        ownerEmail,
        monthlyPriceCents: Math.round(priceEur * 100),
        ...(String(form.get("commissionStartsAt") || "").trim()
          ? { commissionStartsAt: String(form.get("commissionStartsAt")).trim() }
          : {}),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo crear la comunidad");
      setCreating(false);
      return;
    }

    if (data.community && data.invite) {
      setLastInviteUrl(`${window.location.origin}/join/${data.invite.token}`);
      setLastOwnerEmail(ownerEmail);
      setShowForm(false);
      await refreshCommunities();
    }
    setCreating(false);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-band text-foreground">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="font-bold">Hilo de Letras · Super Admin</span>
          </div>
          <Link href="/dashboard" className="text-sm font-semibold text-foreground hover:text-accent">
            Volver
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Comunidades</h1>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" />
            Nueva comunidad
          </Button>
        </div>

        {lastInviteUrl && (
          <Card className="mb-6 border-border bg-accent-light hard-shadow-sm">
            <CardContent className="space-y-4 pt-6">
              <div>
                <p className="mb-1 text-sm font-bold">Dueña</p>
                <p className="text-sm text-muted">
                  No usa este link. Entra en{" "}
                  <code className="border border-border bg-background px-1">
                    /login
                  </code>{" "}
                  con {lastOwnerEmail || "el email que pusiste"}.
                </p>
              </div>
              <div>
                <p className="mb-2 text-sm font-bold">
                  Link para socias (este sí se pega en el chat)
                </p>
                <div className="flex gap-2">
                  <Input value={lastInviteUrl} readOnly />
                  <Button
                    variant="outline"
                    onClick={() => navigator.clipboard.writeText(lastInviteUrl)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {showForm && (
          <Card className="mb-6 hard-shadow-sm">
            <CardHeader>
              <CardTitle>Crear comunidad</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={createCommunity} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nombre de la comunidad</Label>
                  <Input name="name" required placeholder="Club de lectura de..." />
                </div>
                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Textarea name="description" placeholder="Descripción breve" />
                </div>
                <div className="space-y-2">
                  <Label>Email de la dueña (influencer)</Label>
                  <Input name="ownerEmail" type="email" required placeholder="duena@ejemplo.com" />
                  <p className="text-xs text-muted">
                    Entra por /login con este email. No es un link de admin.
                    Si es una cuenta nueva, Supabase le manda mail para definir
                    contraseña. Para una prueba rápida, usá tu propio email.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Precio mensual (EUR)</Label>
                  <Input name="price" type="number" min="0" step="0.01" defaultValue="29" />
                </div>
                <div className="space-y-2">
                  <Label>Día D de comisión (opcional)</Label>
                  <Input name="commissionStartsAt" type="date" />
                  <p className="text-xs text-muted">
                    Si el club se crea antes del live, poné el día que pegan el
                    link. Vacío = el reloj arranca ahora.
                  </p>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button type="submit" disabled={creating}>
                  {creating ? "Creando..." : "Crear comunidad + link"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {communities.map((c) => (
            <Card key={c.id} className="hard-shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">{c.name}</CardTitle>
                <p className="text-sm text-muted">/{c.slug}</p>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/c/${c.slug}/forum`}>Entrar</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
