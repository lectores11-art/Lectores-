"use client";

import { Search } from "lucide-react";
import { useDetailPanel } from "@/components/layout/detail-panel-context";

export function YellowSearchBand() {
  const { searchQuery, setSearchQuery, searchPlaceholder } = useDetailPanel();

  return (
    <div className="sticky top-0 z-20 border-b-2 border-foreground bg-band px-4 py-3 lg:px-6">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-11 w-full rounded-sm border-2 border-foreground bg-surface pl-10 pr-3 text-sm font-medium placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>
    </div>
  );
}
