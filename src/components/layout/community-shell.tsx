"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Community, Profile } from "@/lib/types/database";
import { DetailPanelProvider } from "@/components/layout/detail-panel-context";
import { IconRail, MobileBottomNav } from "@/components/layout/icon-rail";
import { YellowSearchBand } from "@/components/layout/yellow-search-band";
import {
  DetailPanel,
  MobileDetailSheet,
} from "@/components/layout/detail-panel";

export function CommunityShell({
  community,
  user,
  isAdmin,
  children,
}: {
  community: Community;
  user: Profile;
  isAdmin: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // Book reader is immersive: /c/[slug]/library/[bookId]
  const isBookReader = /\/library\/[^/]+$/.test(pathname);

  if (isBookReader) {
    return <>{children}</>;
  }

  return (
    <DetailPanelProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <IconRail community={community} isAdmin={isAdmin} />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <YellowSearchBand />
          <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">{children}</main>
        </div>

        <DetailPanel user={user} community={community} />
        <MobileDetailSheet />
        <MobileBottomNav community={community} isAdmin={isAdmin} />
      </div>
    </DetailPanelProvider>
  );
}
