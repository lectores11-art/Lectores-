import { requireCommunityAccess, isCommunityAdmin } from "@/lib/auth/helpers";
import { MeetingRoomClient } from "@/components/meeting/meeting-room-client";

export default async function MeetingPage({
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

  return <MeetingRoomClient slug={slug} isAdmin={admin} />;
}
