import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/helpers";
import { PlatformAdminClient } from "@/components/admin/platform-admin-client";

export const dynamic = "force-dynamic";

export default async function PlatformAdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/platform/admin");
  }

  if (!user.is_super_admin) {
    redirect("/dashboard");
  }

  return <PlatformAdminClient />;
}
