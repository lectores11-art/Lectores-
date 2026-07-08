"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Calendar,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Users,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Community, Profile } from "@/lib/types/database";

const navItems = [
  { href: "forum", label: "Foro", icon: MessageSquare },
  { href: "classroom", label: "Classroom", icon: GraduationCap },
  { href: "library", label: "Biblioteca", icon: BookOpen },
  { href: "meeting", label: "Sala", icon: Video },
  { href: "calendar", label: "Calendario", icon: Calendar },
  { href: "settings", label: "Cuenta", icon: Settings },
];

interface CommunitySidebarProps {
  community: Community;
  user: Profile;
  isAdmin: boolean;
}

export function CommunitySidebar({ community, user, isAdmin }: CommunitySidebarProps) {
  const pathname = usePathname();
  const base = `/c/${community.slug}`;

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-200 bg-slate-50">
      <div className="border-b border-slate-200 p-5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: community.accent_color }}
          >
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-slate-900">{community.name}</h1>
            <p className="truncate text-xs text-slate-500">Comunidad privada</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const fullHref = `${base}/${href}`;
          const active = pathname.startsWith(fullHref);
          return (
            <Link
              key={href}
              href={fullHref}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sky-50 text-sky-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className={cn("h-4 w-4", active && "text-sky-500")} />
              {label}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="my-3 border-t border-slate-200 pt-3">
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Admin
              </p>
              <Link
                href={`${base}/admin`}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname.startsWith(`${base}/admin`)
                    ? "bg-sky-50 text-sky-700"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <Users className="h-4 w-4" />
                Panel admin
              </Link>
            </div>
          </>
        )}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-xs font-medium text-sky-700">
            {(user.full_name || user.email).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">
              {user.full_name || "Usuario"}
            </p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="mt-3 flex items-center gap-2 text-xs text-slate-500 hover:text-sky-600"
        >
          <LayoutDashboard className="h-3 w-3" />
          Mis comunidades
        </Link>
      </div>
    </aside>
  );
}
