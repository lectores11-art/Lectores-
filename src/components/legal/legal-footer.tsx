import Link from "next/link";
import { LEGAL_PAGES } from "@/lib/legal/copy";

export function LegalFooter({ className = "" }: { className?: string }) {
  return (
    <nav
      className={`flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted ${className}`}
      aria-label="Documentos legales"
    >
      {LEGAL_PAGES.map((page) => (
        <Link key={page.href} href={page.href} className="hover:text-foreground hover:underline">
          {page.label}
        </Link>
      ))}
    </nav>
  );
}
