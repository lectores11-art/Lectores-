"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Calendar, GraduationCap, MessageSquare, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEurFromCents } from "@/lib/admin/paid-members";
import type { Community, Profile } from "@/lib/types/database";

const FAKE_THREADS = [
  { title: "Primera lectura del mes", preview: "Arrancamos con el capítulo uno y un café." },
  { title: "Notas al margen", preview: "Traé una frase que te haya quedado dando vueltas." },
  { title: "Encuentro del jueves", preview: "Sala abierta a las 19:00, hora de Madrid." },
];

const GHOST_NAV = [
  { label: "Foro", icon: MessageSquare },
  { label: "Encuentros", icon: GraduationCap },
  { label: "Libros", icon: BookOpen },
  { label: "Sala", icon: Video },
  { label: "Agenda", icon: Calendar },
];

export function CommunityPaywall({
  community,
  user,
}: {
  community: Community;
  user: Profile;
}) {
  return (
    <Suspense fallback={<PaywallFrame community={community} />}>
      <PaywallWithCheckout community={community} user={user} />
    </Suspense>
  );
}

function PaywallWithCheckout({
  community,
  user,
}: {
  community: Community;
  user: Profile;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const waitingForPayment = searchParams.get("subscribed") === "true";
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(waitingForPayment);

  useEffect(() => {
    if (!waitingForPayment) return;

    let cancelled = false;
    let attempts = 0;

    async function poll() {
      attempts += 1;
      const res = await fetch(`/api/c/${community.slug}/access`);
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (data.access === "active") {
        router.replace(`/c/${community.slug}/forum`);
        router.refresh();
        return;
      }
      if (attempts >= 20) {
        setWaiting(false);
        setError("El pago puede tardar un momento. Recargá esta página.");
        return;
      }
      window.setTimeout(() => {
        void poll();
      }, 1000);
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [community.slug, router, waitingForPayment]);

  async function startCheckout() {
    setPaying(true);
    setError("");
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communityId: community.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setError(
          data.error || "No se pudo abrir el pago. Pedile a la administradora que revise Stripe."
        );
        setPaying(false);
        return;
      }
      window.location.href = data.url as string;
    } catch {
      setError("No se pudo abrir el pago. Intentá de nuevo.");
      setPaying(false);
    }
  }

  const priceLabel =
    community.monthly_price_cents > 0
      ? `${formatEurFromCents(community.monthly_price_cents)} / mes`
      : "Suscripción mensual";

  return (
    <PaywallFrame community={community}>
      <Card className="hard-shadow w-full max-w-md border-border bg-background/95 backdrop-blur-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Entrar a {community.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted">
            Hola {user.full_name || user.email}. La comunidad ya está del otro lado:
            para pasar, activá la suscripción mensual.
          </p>
          <p className="text-3xl font-bold tracking-tight">{priceLabel}</p>
          {waiting ? (
            <p className="text-sm text-muted">Confirmando el pago…</p>
          ) : waitingForPayment ? (
            <p className="text-sm text-muted">
              Si ya pagaste, recargá esta página. No vuelvas a pulsar pagar.
            </p>
          ) : !community.stripe_price_id ? (
            <p className="text-sm text-muted">
              El pago todavía no está configurado. Pedile a la administradora que
              cargue el precio en Stripe.
            </p>
          ) : (
            <Button
              type="button"
              className="w-full"
              size="lg"
              disabled={paying}
              onClick={() => void startCheckout()}
            >
              {paying ? "Abriendo el pago…" : "Pagar y entrar"}
            </Button>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-muted">
            El cobro lo hace Stripe. Si cancelás, volvés a esta pantalla.
          </p>
        </CardContent>
      </Card>
    </PaywallFrame>
  );
}

function PaywallFrame({
  community,
  children,
}: {
  community: Community;
  children?: ReactNode;
}) {
  return (
    <div className="relative flex h-screen overflow-hidden bg-background">
      <aside
        className="hidden h-screen w-[88px] shrink-0 flex-col border-r border-border bg-background lg:flex"
        aria-hidden
      >
        <div className="flex flex-col items-center gap-1 border-b border-border px-2 py-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-band">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="mt-1 max-w-full truncate px-1 text-center text-[10px] font-bold uppercase tracking-wide">
            {community.name.slice(0, 8)}
          </span>
        </div>
        <nav className="flex flex-1 flex-col items-center gap-1 py-3">
          {GHOST_NAV.map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="flex h-12 w-12 items-center justify-center rounded-md text-muted"
            >
              <Icon className="h-5 w-5" />
            </span>
          ))}
        </nav>
      </aside>

      <div className="relative min-w-0 flex-1">
        <div className="pointer-events-none select-none blur-sm" aria-hidden>
          <div className="border-b border-border px-6 py-4">
            <div className="h-11 rounded-md border border-border bg-background" />
          </div>
          <div className="space-y-3 p-6">
            {FAKE_THREADS.map((thread) => (
              <div
                key={thread.title}
                className="rounded-md border border-border bg-background p-4"
              >
                <p className="font-semibold">{thread.title}</p>
                <p className="mt-1 text-sm text-muted">{thread.preview}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center bg-background/40 px-4">
          {children}
        </div>
      </div>
    </div>
  );
}
