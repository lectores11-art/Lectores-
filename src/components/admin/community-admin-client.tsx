"use client";

import { useEffect, useState } from "react";
import { Copy, Link as LinkIcon, UserMinus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDetailPanel } from "@/components/layout/detail-panel-context";
import { formatRelativeTime } from "@/lib/utils";

type InviteRow = {
  id?: string;
  token: string;
  use_count: number;
  max_uses: number | null;
  is_active?: boolean;
  created_at?: string;
};

type MemberProfile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
};

type MemberRow = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at: string | null;
  created_at?: string;
  is_owner?: boolean;
  profile: MemberProfile | MemberProfile[] | null;
};

function inviteUrl(token: string) {
  if (typeof window === "undefined") return `/join/${token}`;
  return `${window.location.origin}/join/${token}`;
}

function memberProfile(member: MemberRow): MemberProfile | null {
  if (!member.profile) return null;
  return Array.isArray(member.profile) ? member.profile[0] ?? null : member.profile;
}

function roleLabel(role: string) {
  if (role === "community_owner") return "Dueña";
  if (role === "super_admin") return "Super admin";
  return "Miembro";
}

export function CommunityAdminClient({ slug }: { slug: string }) {
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [listError, setListError] = useState("");
  const [newInviteUrl, setNewInviteUrl] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [membersError, setMembersError] = useState("");
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const { setSearchPlaceholder } = useDetailPanel();

  useEffect(() => {
    setSearchPlaceholder("Buscar en admin…");
  }, [setSearchPlaceholder]);

  useEffect(() => {
    loadInvites();
    loadMembers();
  }, [slug]);

  async function loadInvites() {
    setLoadingInvites(true);
    setListError("");
    try {
      const res = await fetch(`/api/c/${slug}/invites`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInvites([]);
        setListError(
          data.error || "No se pudieron cargar las invitaciones."
        );
        return;
      }
      setInvites(data.invites || []);
    } catch {
      setInvites([]);
      setListError("No se pudieron cargar las invitaciones.");
    } finally {
      setLoadingInvites(false);
    }
  }

  async function loadMembers() {
    setLoadingMembers(true);
    setMembersError("");
    try {
      const res = await fetch(`/api/c/${slug}/members`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMembers([]);
        setMembersError(data.error || "No se pudieron cargar los miembros.");
        return;
      }
      setMembers(data.members || []);
    } catch {
      setMembers([]);
      setMembersError("No se pudieron cargar los miembros.");
    } finally {
      setLoadingMembers(false);
    }
  }

  async function createInvite() {
    setCreatingInvite(true);
    setInviteError("");
    const res = await fetch(`/api/c/${slug}/invites`, { method: "POST" });
    const data = await res.json();
    if (res.ok && data.invite) {
      const url = inviteUrl(data.invite.token);
      setNewInviteUrl(url);
      setInvites((prev) => [data.invite, ...prev]);
    } else {
      setInviteError(data.error || "No se pudo generar el link. Intentá de nuevo.");
    }
    setCreatingInvite(false);
  }

  async function copyInviteLink(token: string) {
    const url = inviteUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken((current) => (current === token ? null : current)), 2000);
    } catch {
      setInviteError("No se pudo copiar al portapapeles.");
    }
  }

  async function revokeInvite(invite: InviteRow) {
    if (!invite.id || invite.is_active === false) return;
    if (
      !confirm(
        "¿Revocar esta invitación? Quienes tengan el link ya no podrán unirse."
      )
    ) {
      return;
    }

    setRevokingId(invite.id);
    setInviteError("");
    try {
      const res = await fetch(`/api/c/${slug}/invites/${invite.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInviteError(data.error || "No se pudo revocar la invitación.");
        return;
      }
      setInvites((prev) =>
        prev.map((row) =>
          row.id === invite.id
            ? { ...row, ...(data.invite || { is_active: false }) }
            : row
        )
      );
    } catch {
      setInviteError("No se pudo revocar la invitación.");
    } finally {
      setRevokingId(null);
    }
  }

  async function kickMember(member: MemberRow) {
    const profile = memberProfile(member);
    const label = profile?.full_name || profile?.email || "este miembro";
    if (
      !confirm(
        `¿Expulsar a ${label}? Perderá el acceso a la comunidad. Si tenía suscripción Stripe, se cancela al fin del período. No se borra su cuenta.`
      )
    ) {
      return;
    }

    setKickingId(member.id);
    setMembersError("");
    try {
      const res = await fetch(`/api/c/${slug}/members/${member.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMembersError(data.error || "No se pudo expulsar al miembro.");
        return;
      }
      setMembers((prev) => prev.filter((row) => row.id !== member.id));
      if (typeof data.warning === "string" && data.warning) {
        setMembersError(data.warning);
      }
    } catch {
      setMembersError("No se pudo expulsar al miembro.");
    } finally {
      setKickingId(null);
    }
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
              <Users className="h-5 w-5 text-accent" />
              Miembros activos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted">
              Podés desactivar el acceso de un miembro. No se borra su cuenta de usuario.
            </p>
            {loadingMembers ? (
              <p className="text-sm text-muted">Cargando miembros…</p>
            ) : membersError ? (
              <div className="space-y-2">
                <p className="text-sm text-red-600">{membersError}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => loadMembers()}>
                  Reintentar
                </Button>
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted">Todavía no hay miembros activos.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted">
                      <th className="py-2 pr-3 font-medium">Nombre</th>
                      <th className="py-2 pr-3 font-medium">Rol</th>
                      <th className="py-2 pr-3 font-medium">Estado</th>
                      <th className="py-2 pr-3 font-medium">Desde</th>
                      <th className="py-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => {
                      const profile = memberProfile(member);
                      const isOwner =
                        Boolean(member.is_owner) ||
                        member.role === "community_owner";
                      return (
                        <tr key={member.id} className="border-b border-border/70">
                          <td className="py-3 pr-3 align-top">
                            <p className="font-medium">
                              {profile?.full_name || "Sin nombre"}
                            </p>
                            <p className="text-xs text-muted">{profile?.email || "—"}</p>
                          </td>
                          <td className="py-3 pr-3 align-top">{roleLabel(member.role)}</td>
                          <td className="py-3 pr-3 align-top capitalize text-muted">
                            {member.status === "active" ? "Activo" : member.status}
                          </td>
                          <td className="py-3 pr-3 align-top text-muted">
                            {member.joined_at
                              ? formatRelativeTime(member.joined_at)
                              : "—"}
                          </td>
                          <td className="py-3 align-top">
                            {isOwner ? (
                              <span className="text-xs text-muted">No expulsable</span>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={kickingId === member.id}
                                onClick={() => kickMember(member)}
                              >
                                <UserMinus className="h-4 w-4" />
                                {kickingId === member.id ? "Expulsando…" : "Expulsar"}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

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
                <Button
                  variant="outline"
                  onClick={() => {
                    const token = newInviteUrl.split("/").pop() || "";
                    if (token) copyInviteLink(token);
                  }}
                >
                  <Copy className="h-4 w-4" />
                  {copiedToken && newInviteUrl.endsWith(copiedToken)
                    ? "Copiado"
                    : "Copiar"}
                </Button>
              </div>
            )}

            <div className="border-t border-border pt-4">
              <p className="mb-3 text-sm font-semibold">Invitaciones</p>
              {loadingInvites ? (
                <p className="text-sm text-muted">Cargando invitaciones…</p>
              ) : listError ? (
                <div className="space-y-2">
                  <p className="text-sm text-red-600">{listError}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => loadInvites()}>
                    Reintentar
                  </Button>
                </div>
              ) : invites.length === 0 ? (
                <p className="text-sm text-muted">
                  Todavía no hay invitaciones. Generá un link para empezar.
                </p>
              ) : (
                <ul className="space-y-2">
                  {invites.map((invite) => {
                    const url = inviteUrl(invite.token);
                    const active = invite.is_active !== false;
                    const usesLabel =
                      invite.max_uses == null
                        ? `${invite.use_count} usos`
                        : `${invite.use_count}/${invite.max_uses} usos`;
                    return (
                      <li
                        key={invite.id || invite.token}
                        className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={
                                active
                                  ? "rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-800"
                                  : "rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-700"
                              }
                            >
                              {active ? "Activa" : "Revocada"}
                            </span>
                            <p className="truncate font-mono text-xs">{url}</p>
                          </div>
                          <p className="mt-1 text-xs text-muted">
                            {usesLabel}
                            {invite.created_at
                              ? ` · ${formatRelativeTime(invite.created_at)}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {active && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => copyInviteLink(invite.token)}
                            >
                              <Copy className="h-4 w-4" />
                              {copiedToken === invite.token ? "Copiado" : "Copiar link"}
                            </Button>
                          )}
                          {active && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={revokingId === invite.id}
                              onClick={() => void revokeInvite(invite)}
                            >
                              {revokingId === invite.id ? "Revocando…" : "Revocar"}
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
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
