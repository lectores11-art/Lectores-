import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/helpers";
import { PlatformAdminClient } from "@/components/admin/platform-admin-client";

export const dynamic = "force-dynamic";

export default async function PlatformAdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/platform/admin");
  }

  // Hide the surface entirely from non–super-admins (no dashboard hint).
  if (!user.is_super_admin) {
    notFound();
  }

  return <PlatformAdminClient />;
}
