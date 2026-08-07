import { redirect } from "next/navigation";
import { requireCommunityAccess } from "@/lib/auth/helpers";
import { SettingsPageClient } from "@/components/settings/settings-page-client";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, community } = await requireCommunityAccess(slug);

  if (!user) redirect("/login");
  if (!community) redirect("/dashboard");

  return (
    <SettingsPageClient communityId={community.id} user={user} />
  );
}
