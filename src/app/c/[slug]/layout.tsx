import { redirect, notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  getCommunityContext,
  hasActiveCommunityAccess,
  isCommunityAdmin,
  shouldSeePaywall,
} from "@/lib/auth/helpers";
import { CommunityShell } from "@/components/layout/community-shell";
import { CommunityPaywall } from "@/components/community/community-paywall";

export default async function CommunityLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, community, membership } = await getCommunityContext(slug);

  if (!user) redirect(`/login?redirect=/c/${slug}/forum`);
  if (!community) notFound();

  if (shouldSeePaywall(user, community, membership)) {
    return <CommunityPaywall community={community} user={user} />;
  }

  if (!hasActiveCommunityAccess(user, community, membership)) {
    redirect("/dashboard");
  }

  const admin = await isCommunityAdmin(community.id, user.id, user.is_super_admin);

  return (
    <CommunityShell community={community} user={user} isAdmin={admin}>
      {children}
    </CommunityShell>
  );
}
