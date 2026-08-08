import { redirect } from "next/navigation";
import { requireCommunityAccess } from "@/lib/auth/helpers";
import { SettingsPageClient } from "@/components/settings/settings-page-client";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, community, membership } = await requireCommunityAccess(slug);

  if (!user) redirect("/login");
  if (!community) redirect("/dashboard");

  const isOwner =
    community.owner_id === user.id ||
    membership?.role === "community_owner";

  return (
    <SettingsPageClient
      slug={slug}
      communityId={community.id}
      user={user}
      isOwner={Boolean(isOwner)}
    />
  );
}
