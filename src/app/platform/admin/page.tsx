import { getCurrentUser } from "@/lib/auth/helpers";
import { PlatformAdminClient } from "@/components/admin/platform-admin-client";

export const dynamic = "force-dynamic";

export default async function PlatformAdminPage() {
  const user = await getCurrentUser();
  if (!user?.is_super_admin) {
    return null;
  }

  return <PlatformAdminClient />;
}
