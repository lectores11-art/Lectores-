"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { InviteAuthForm } from "@/components/auth/invite-auth-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Community, Invite } from "@/lib/types/database";

export default function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const [token, setToken] = useState<string>("");
  const [community, setCommunity] = useState<Community | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [joining, setJoining] = useState(false);

  const runJoin = useCallback(
    async (joinToken: string) => {
      setJoining(true);
      setError("");

      const res = await fetch("/api/invites/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: joinToken }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo unir a la comunidad.");
        setJoining(false);
        setNeedsAuth(false);
        return;
      }

      router.push(`/c/${data.slug}/forum`);
    },
    [router]
  );

  useEffect(() => {
    let cancelled = false;

    async function init(t: string) {
      const res = await fetch(`/api/invites/${t}`);
      const data = await res.json();

      if (cancelled) return;

      if (!res.ok) {
        setError(data.error || "Invitación no válida o expirada");
        setLoading(false);
        return;
      }

      const invite = data.invite as Invite & { community: Community };
      if (!invite.community) {
        setError("No se pudo cargar la comunidad de esta invitación");
        setLoading(false);
        return;
      }

      setCommunity(invite.community);

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (user) {
        void runJoin(t);
      } else {
        setNeedsAuth(true);
        setLoading(false);
      }
    }

    params.then(({ token: t }) => {
      setToken(t);
      void init(t);
    });

    return () => {
      cancelled = true;
    };
  }, [params, runJoin]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-500">Cargando invitación...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500 text-white">
            <BookOpen className="h-6 w-6" />
          </div>
          {community ? (
            <>
              <CardTitle>Te invitaron a {community.name}</CardTitle>
              <CardDescription>
                {community.description || "Comunidad privada de lectura"}
              </CardDescription>
            </>
          ) : (
            <CardTitle>Invitación no válida</CardTitle>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-center text-sm text-red-500">{error}</p>}

          {joining && (
            <p className="text-center text-sm text-slate-500">Entrando a la comunidad...</p>
          )}

          {needsAuth && community && !joining && (
            <InviteAuthForm
              token={token}
              communityName={community.name}
              onAuthenticated={() => runJoin(token)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
