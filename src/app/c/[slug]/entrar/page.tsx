import { redirect, notFound } from "next/navigation";
import {
  getCommunityContext,
  hasActiveCommunityAccess,
  shouldSeePaywall,
} from "@/lib/auth/helpers";

export default async function EntrarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, community, membership } = await getCommunityContext(slug);

  if (!user) redirect(`/login?redirect=/c/${slug}/entrar`);
  if (!community) notFound();
  if (hasActiveCommunityAccess(user, community, membership)) {
    redirect(`/c/${slug}/forum`);
  }
  if (!shouldSeePaywall(user, community, membership)) {
    redirect("/dashboard");
  }

  return null;
}
