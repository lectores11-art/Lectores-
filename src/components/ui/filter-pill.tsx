import * as React from "react";
import { cn } from "@/lib/utils";

interface FilterPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

const FilterPill = React.forwardRef<HTMLButtonElement, FilterPillProps>(
  ({ className, active = false, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50",
        active
          ? "border-accent bg-accent text-white"
          : "border-border bg-surface text-foreground hover:bg-accent-light",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);
FilterPill.displayName = "FilterPill";

export { FilterPill };
