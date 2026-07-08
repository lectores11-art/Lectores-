import { requireCommunityAccess, isCommunityAdmin } from "@/lib/auth/helpers";
import { ClassroomPageClient } from "@/components/classroom/classroom-page-client";

export default async function ClassroomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, community } = await requireCommunityAccess(slug);
  const admin =
    community && user
      ? await isCommunityAdmin(community.id, user.id, user.is_super_admin)
      : false;

  if (!community) return null;

  return (
    <ClassroomPageClient
      slug={slug}
      communityId={community.id}
      isAdmin={admin}
    />
  );
}
