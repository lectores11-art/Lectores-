"use client";

import { Search } from "lucide-react";
import { useDetailPanel } from "@/components/layout/detail-panel-context";

export function YellowSearchBand() {
  const { searchQuery, setSearchQuery, searchPlaceholder } = useDetailPanel();

  return (
    <div className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur-sm lg:px-6">
      <label className="relative block">
        <span
          className="pointer-events-none absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-band"
          aria-hidden
        />
        <Search className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-11 w-full rounded-md border border-border bg-background pl-14 pr-3 text-sm font-medium placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>
    </div>
  );
}
