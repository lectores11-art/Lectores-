import { requireCommunityAccess, isCommunityAdmin } from "@/lib/auth/helpers";
import { ForumPageClient } from "@/components/forum/forum-page-client";

export default async function ForumPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, community } = await requireCommunityAccess(slug);
  const admin = community && user
    ? await isCommunityAdmin(community.id, user.id, user.is_super_admin)
    : false;

  return <ForumPageClient slug={slug} isAdmin={admin} />;
}
