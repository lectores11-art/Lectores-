import { redirect, notFound } from "next/navigation";
import { requireCommunityAccess, isCommunityAdmin } from "@/lib/auth/helpers";
import { CommunityShell } from "@/components/layout/community-shell";

export default async function CommunityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, community, membership } = await requireCommunityAccess(slug);

  if (!user) redirect(`/login?redirect=/c/${slug}/forum`);
  if (!community) notFound();
  if (!membership && !user.is_super_admin && community.owner_id !== user.id) {
    redirect("/dashboard");
  }

  const admin = await isCommunityAdmin(community.id, user.id, user.is_super_admin);

  return (
    <CommunityShell community={community} user={user} isAdmin={admin}>
      {children}
    </CommunityShell>
  );
}
