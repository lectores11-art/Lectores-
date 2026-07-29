"use client";

import Link from "next/link";
import { Bell, BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDetailPanel } from "@/components/layout/detail-panel-context";
import { cn } from "@/lib/utils";
import type { Profile, Community } from "@/lib/types/database";

export function UserChrome({
  user,
  community,
}: {
  user: Profile;
  community: Community;
}) {
  const initial = (user.full_name || user.email).charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
      <Avatar className="h-10 w-10">
        {user.avatar_url ? (
          <AvatarImage src={user.avatar_url} alt="" />
        ) : null}
        <AvatarFallback>{initial}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold leading-tight">
          {user.full_name || "Usuario"}
        </p>
        <p className="truncate text-xs text-muted">{community.name}</p>
      </div>
      <button
        type="button"
        className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-muted hover:bg-accent-light hover:text-foreground"
        aria-label="Notificaciones"
        title="Próximamente"
      >
        <Bell className="h-4 w-4" />
      </button>
    </div>
  );
}

export function DetailPanelBody() {
  const { detail, clearDetail } = useDetailPanel();

  if (!detail) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-md bg-band text-foreground">
          <BookOpen className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-muted">
          Elegí un ítem de la lista para ver el detalle aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-band">
          {detail.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={detail.imageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <BookOpen className="h-6 w-6" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold leading-snug">{detail.title}</h2>
          {detail.subtitle ? (
            <p className="mt-1 text-sm text-muted">{detail.subtitle}</p>
          ) : null}
        </div>
      </div>

      {(detail.primaryAction || detail.secondaryAction) && (
        <div className="mb-4 flex flex-col gap-2">
          {detail.primaryAction ? (
            detail.primaryAction.href ? (
              <Button asChild className="w-full">
                <Link href={detail.primaryAction.href}>
                  {detail.primaryAction.label}
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                className="w-full"
                onClick={detail.primaryAction.onClick}
              >
                {detail.primaryAction.label}
              </Button>
            )
          ) : null}
          {detail.secondaryAction ? (
            detail.secondaryAction.href ? (
              <Button asChild variant="outline" className="w-full">
                <Link href={detail.secondaryAction.href}>
                  {detail.secondaryAction.label}
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={detail.secondaryAction.onClick}
              >
                {detail.secondaryAction.label}
              </Button>
            )
          ) : null}
        </div>
      )}

      {detail.meta && detail.meta.length > 0 ? (
        <dl className="mb-4 space-y-2 border-y border-border py-3">
          {detail.meta.map((row) => (
            <div key={row.label} className="flex justify-between gap-3 text-sm">
              <dt className="font-semibold uppercase tracking-wide text-muted">
                {row.label}
              </dt>
              <dd className="text-right font-medium">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {detail.description ? (
        <p className="text-sm leading-relaxed text-foreground/90">
          {detail.description}
        </p>
      ) : null}

      <button
        type="button"
        onClick={clearDetail}
        className="mt-6 text-left text-xs font-semibold uppercase tracking-wide text-muted hover:text-accent"
      >
        Limpiar selección
      </button>
    </div>
  );
}

export function DetailPanel({
  user,
  community,
  className,
}: {
  user: Profile;
  community: Community;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "hidden h-screen w-[340px] shrink-0 flex-col border-l border-border bg-surface lg:flex",
        className
      )}
    >
      <UserChrome user={user} community={community} />
      <DetailPanelBody />
    </aside>
  );
}

export function MobileDetailSheet() {
  const { detail, mobileOpen, setMobileOpen, clearDetail } = useDetailPanel();

  if (!mobileOpen || !detail) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40"
        aria-label="Cerrar"
        onClick={() => setMobileOpen(false)}
      />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col border-t border-border bg-surface pb-16">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide">Detalle</p>
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              clearDetail();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background"
            aria-label="Cerrar detalle"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto">
          <DetailPanelBody />
        </div>
      </div>
    </div>
  );
}
