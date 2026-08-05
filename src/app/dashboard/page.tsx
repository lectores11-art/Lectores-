import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/helpers";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/components/auth/logout-button";
import type { Community, Membership } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("*, community:communities(*)")
    .eq("user_id", user.id)
    .eq("status", "active");

  const userCommunities = (memberships || []) as (Membership & { community: Community })[];

  if (user.is_super_admin) {
    const { data: allCommunities } = await supabase
      .from("communities")
      .select("*")
      .order("created_at", { ascending: false });

    return (
      <DashboardLayout user={user}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold tracking-tight">Panel de plataforma</h2>
          <Button asChild>
            <Link href="/platform/admin">
              <Plus className="h-4 w-4" />
              Nueva comunidad
            </Link>
          </Button>
        </div>
        <CommunityGrid
          communities={
            allCommunities?.map((c) => ({
              community: c as Community,
              isAdmin: true,
            })) || []
          }
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user}>
      <h2 className="mb-6 text-2xl font-bold tracking-tight">Mis comunidades</h2>
      {userCommunities.length === 0 ? (
        <Card className="hard-shadow-sm">
          <CardContent className="py-12 text-center">
            <p className="text-muted">
              Aún no pertenecés a ninguna comunidad. Usá el link de invitación que te compartió la
              administradora.
            </p>
          </CardContent>
        </Card>
      ) : (
        <CommunityGrid
          communities={userCommunities.map((m) => ({
            community: m.community,
            isAdmin: m.role === "community_owner",
          }))}
        />
      )}
    </DashboardLayout>
  );
}

function DashboardLayout({
  user,
  children,
}: {
  user: { full_name: string | null; email: string };
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-band text-foreground">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="font-bold">Lectores</span>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-sm font-medium">{user.full_name || user.email}</p>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}

function CommunityGrid({
  communities,
}: {
  communities: { community: Community; isAdmin: boolean }[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {communities.map(({ community, isAdmin }) => (
        <Link key={community.id} href={`/c/${community.slug}/forum`}>
          <Card className="h-full transition-shadow hover:shadow-md hard-shadow-sm">
            <CardHeader>
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-band text-foreground">
                  <BookOpen className="h-5 w-5" />
                </div>
                {community.accent_color ? (
                  <span
                    className="h-3 w-3 rounded-sm border border-border"
                    style={{ backgroundColor: community.accent_color }}
                    aria-hidden
                  />
                ) : null}
              </div>
              <CardTitle className="text-lg">{community.name}</CardTitle>
              <CardDescription>
                {isAdmin ? "Administradora" : "Miembro"}
                {community.description
                  ? ` · ${community.description.slice(0, 60)}`
                  : ""}
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
