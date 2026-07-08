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

    const res = await fetch("/api/platform/communities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description"),
        ownerEmail: form.get("ownerEmail"),
        monthlyPriceCents: Number(form.get("price")) * 100 || 0,
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
      setShowForm(false);
      await refreshCommunities();
    }
    setCreating(false);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-white">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="font-semibold">Lectores · Super Admin</span>
          </div>
          <Link href="/dashboard" className="text-sm text-sky-600 hover:underline">
            Volver
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Comunidades</h1>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva comunidad
          </Button>
        </div>

        {lastInviteUrl && (
          <Card className="mb-6 border-sky-200 bg-sky-50">
            <CardContent className="pt-6">
              <p className="mb-2 text-sm font-medium text-sky-800">
                Comunidad creada. Link de invitación:
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
            </CardContent>
          </Card>
        )}

        {showForm && (
          <Card className="mb-6">
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
                  <p className="text-xs text-slate-500">
                    Se creará automáticamente en Supabase. Si falla, ejecutá{" "}
                    <code className="rounded bg-slate-100 px-1">002_fix_auth_trigger.sql</code> en Supabase.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Precio mensual (USD)</Label>
                  <Input name="price" type="number" min="0" step="0.01" defaultValue="29" />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" disabled={creating}>
                  {creating ? "Creando..." : "Crear comunidad + link"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {communities.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="text-lg">{c.name}</CardTitle>
                <p className="text-sm text-slate-500">/{c.slug}</p>
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
