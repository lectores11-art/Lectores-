import { requireCommunityAccess, isCommunityAdmin } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import { CommunityAdminClient } from "@/components/admin/community-admin-client";

export default async function CommunityAdminPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, community } = await requireCommunityAccess(slug);

  if (!user || !community) redirect("/login");

  const admin = await isCommunityAdmin(community.id, user.id, user.is_super_admin);
  if (!admin) redirect(`/c/${slug}/forum`);

  return <CommunityAdminClient slug={slug} />;
}
