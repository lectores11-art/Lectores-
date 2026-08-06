"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Calendar,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  Users,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Community } from "@/lib/types/database";

const mainNav = [
  { href: "forum", label: "Foro", icon: MessageSquare },
  { href: "classroom", label: "Aula", icon: GraduationCap },
  { href: "library", label: "Biblio", icon: BookOpen },
  { href: "meeting", label: "Sala", icon: Video },
  { href: "calendar", label: "Agenda", icon: Calendar },
];

interface IconRailProps {
  community: Community;
  isAdmin: boolean;
}

export function IconRail({ community, isAdmin }: IconRailProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const base = `/c/${community.slug}`;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <aside className="hidden h-screen w-[88px] shrink-0 flex-col border-r border-border bg-background lg:flex">
      <div className="flex flex-col items-center gap-1 border-b border-border px-2 py-4">
        <Link
          href="/dashboard"
          className="flex h-11 w-11 items-center justify-center rounded-md bg-band text-foreground"
          title="Lectores"
        >
          <BookOpen className="h-5 w-5" />
        </Link>
        <span
          className="mt-1 max-w-full truncate px-1 text-center text-[10px] font-bold uppercase tracking-wide"
          title={community.name}
        >
          {community.name.slice(0, 8)}
        </span>
        {community.accent_color && (
          <span
            className="mt-0.5 h-1.5 w-6 rounded-sm"
            style={{ backgroundColor: community.accent_color }}
            aria-hidden
          />
        )}
      </div>

      <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-3">
        {mainNav.map(({ href, label, icon: Icon }) => {
          const fullHref = `${base}/${href}`;
          const active = pathname.startsWith(fullHref);
          return (
            <Link
              key={href}
              href={fullHref}
              className={cn(
                "flex w-[72px] flex-col items-center gap-1 rounded-sm px-1 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                active
                  ? "text-accent"
                  : "text-foreground hover:bg-accent-light"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-accent")} strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}

        {isAdmin && (
          <Link
            href={`${base}/admin`}
            className={cn(
              "mt-2 flex w-[72px] flex-col items-center gap-1 rounded-md border-t border-border px-1 pt-3 text-[10px] font-semibold uppercase tracking-wide",
              pathname.startsWith(`${base}/admin`)
                ? "text-accent"
                : "text-foreground hover:bg-accent-light"
            )}
          >
            <Users className="h-5 w-5" />
            Admin
          </Link>
        )}
      </nav>

      <div className="flex flex-col items-center gap-1 border-t border-border py-3">
        <Link
          href={`${base}/settings`}
          className={cn(
            "flex w-[72px] flex-col items-center gap-1 rounded-sm px-1 py-2 text-[10px] font-semibold uppercase tracking-wide",
            pathname.startsWith(`${base}/settings`)
              ? "text-accent"
              : "text-foreground hover:bg-accent-light"
          )}
        >
          <Settings className="h-5 w-5" />
          Cuenta
        </Link>
        <Link
          href="/dashboard"
          className="flex w-[72px] flex-col items-center gap-1 rounded-sm px-1 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted hover:bg-accent-light hover:text-foreground"
        >
          <LayoutDashboard className="h-5 w-5" />
          Home
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-[72px] flex-col items-center gap-1 rounded-sm px-1 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted hover:bg-accent-light hover:text-foreground disabled:opacity-50"
        >
          <LogOut className="h-5 w-5" />
          {loggingOut ? "…" : "Salir"}
        </button>
      </div>
    </aside>
  );
}

/** Mobile bottom nav — primary destinations + "Más" sheet (Agenda, Admin, Cuenta) */
export function MobileBottomNav({
  community,
  isAdmin,
}: {
  community: Community;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const base = `/c/${community.slug}`;
  const [moreOpen, setMoreOpen] = useState(false);

  const primary = mainNav.slice(0, 4); // Foro, Aula, Biblio, Sala
  const moreItems = [
    { href: `${base}/calendar`, label: "Agenda", icon: Calendar },
    ...(isAdmin
      ? [{ href: `${base}/admin`, label: "Admin", icon: Users }]
      : []),
    { href: `${base}/settings`, label: "Cuenta", icon: Settings },
  ];

  const moreActive = moreItems.some((item) => pathname.startsWith(item.href));

  return (
    <>
      {moreOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background lg:hidden">
        {moreOpen && (
          <div className="border-b border-border px-3 py-2">
            <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wide text-muted">
              Más
            </p>
            <ul className="space-y-1">
              {moreItems.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold",
                        active
                          ? "bg-accent-light text-accent"
                          : "text-foreground hover:bg-accent-light"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <div className="flex h-16 items-stretch">
          {primary.map(({ href, label, icon: Icon }) => {
            const fullHref = `${base}/${href}`;
            const active = pathname.startsWith(fullHref);
            return (
              <Link
                key={href}
                href={fullHref}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold uppercase",
                  active ? "text-accent" : "text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold uppercase",
              moreActive || moreOpen ? "text-accent" : "text-foreground"
            )}
            aria-expanded={moreOpen}
            aria-label="Más opciones"
          >
            <Settings className="h-5 w-5" />
            Más
          </button>
        </div>
      </nav>
    </>
  );
}
