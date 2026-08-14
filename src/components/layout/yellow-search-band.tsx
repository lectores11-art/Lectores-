"use client";

import { Search } from "lucide-react";
import { useDetailPanel } from "@/components/layout/detail-panel-context";
import { UserChromeCompact } from "@/components/layout/detail-panel";
import type { Community, Profile } from "@/lib/types/database";

export function YellowSearchBand({
  user,
  community,
}: {
  user: Profile;
  community: Community;
}) {
  const { searchQuery, setSearchQuery, searchPlaceholder } = useDetailPanel();

  return (
    <div className="sticky top-0 z-20 flex items-center gap-4 border-b border-border bg-background px-4 py-3 lg:px-6">
      <label className="relative block min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-11 w-full rounded-md border border-border bg-background pl-10 pr-3 text-sm font-medium placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>
      <div className="hidden shrink-0 sm:block">
        <UserChromeCompact user={user} community={community} />
      </div>
    </div>
  );
}
