import { redirect, notFound } from "next/navigation";
import { requireCommunityAccess, isCommunityAdmin } from "@/lib/auth/helpers";
import { CommunitySidebar } from "@/components/layout/community-sidebar";

export default async function CommunityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, community, membership } = await requireCommunityAccess(slug);

  if (!user) redirect("/login");
  if (!community) notFound();
  if (
    process.env.NEXT_PUBLIC_DISABLE_AUTH !== "true" &&
    !membership &&
    !user.is_super_admin &&
    community.owner_id !== user.id
  ) {
    redirect(`/join?community=${slug}`);
  }

  const admin = await isCommunityAdmin(community.id, user.id, user.is_super_admin);

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <CommunitySidebar community={community} user={user} isAdmin={admin} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
