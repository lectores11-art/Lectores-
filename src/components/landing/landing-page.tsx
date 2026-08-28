import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-band text-foreground">
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">Hilo de Letras</span>
          </div>
          <Button asChild>
            <Link href="/login">Iniciar sesión</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-muted">
              Comunidades privadas
            </p>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Hilo de Letras
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted">
              Foro, biblioteca, classroom y sala en vivo. Acceso solo por invitación.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/login">Iniciar sesión</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Ya tengo cuenta</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted">
              Si te invitaron, abrí el link de tu comunidad para registrarte.
            </p>
          </div>

          <div className="rounded-md border border-border bg-background p-4 hard-shadow-sm lg:p-6">
            <div className="mb-4 flex items-center gap-2 rounded-md border border-border bg-background px-4 py-3">
              <span className="h-2 w-2 rounded-full bg-band" aria-hidden />
              <p className="text-sm text-muted">Buscar título, autor o tema…</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {["Foro", "Libros", "Sala", "Encuentros", "Agenda", "Invite"].map(
                (label, i) => (
                  <div
                    key={label}
                    className="flex aspect-[3/4] flex-col justify-between rounded-md border border-border bg-background p-3"
                    style={{
                      backgroundColor:
                        i === 0
                          ? "var(--accent-light)"
                          : i === 1
                            ? "var(--band)"
                            : undefined,
                    }}
                  >
                    <BookOpen className="h-5 w-5" />
                    <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
