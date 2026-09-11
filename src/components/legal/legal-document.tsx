import Link from "next/link";
import { BookOpen } from "lucide-react";
import { LEGAL_COPY, LEGAL_DRAFT_NOTICE } from "@/lib/legal/copy";
import { LegalFooter } from "@/components/legal/legal-footer";

export function LegalDocument({ slug }: { slug: keyof typeof LEGAL_COPY }) {
  const doc = LEGAL_COPY[slug];
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-band">
              <BookOpen className="h-4 w-4" />
            </span>
            Hilo de Letras
          </Link>
          <Link href="/login" className="text-sm font-semibold text-accent hover:underline">
            Entrar
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="mb-6 rounded-md border border-border bg-band/40 px-4 py-3 text-sm font-medium">
          {LEGAL_DRAFT_NOTICE}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{doc.title}</h1>
        <div className="mt-8 space-y-8">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-bold">{section.heading}</h2>
              <p className="mt-2 text-muted leading-relaxed">{section.body}</p>
            </section>
          ))}
        </div>
      </main>
      <footer className="border-t border-border px-6 py-6">
        <LegalFooter />
      </footer>
    </div>
  );
}
