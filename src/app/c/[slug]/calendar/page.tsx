import { requireCommunityAccess, isCommunityAdmin } from "@/lib/auth/helpers";
import { CalendarPageClient } from "@/components/calendar/calendar-page-client";

export default async function CalendarPage({
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

  return <CalendarPageClient communityId={community.id} isAdmin={admin} />;
}
