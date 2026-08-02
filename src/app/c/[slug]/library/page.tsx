import { requireCommunityAccess, isCommunityAdmin } from "@/lib/auth/helpers";
import { LibraryPageClient } from "@/components/library/library-page-client";

export default async function LibraryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, community } = await requireCommunityAccess(slug);
  if (!community) return null;

  const admin = user
    ? await isCommunityAdmin(community.id, user.id, user.is_super_admin)
    : false;

  return (
    <LibraryPageClient
      slug={slug}
      communityId={community.id}
      isAdmin={admin}
    />
  );
}
