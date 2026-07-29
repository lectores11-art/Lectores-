import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-foreground bg-band">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-surface hard-shadow-sm">
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">Lectores</span>
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
              Lectores
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

          <div className="border-2 border-foreground bg-surface p-4 hard-shadow lg:p-6">
            <div className="mb-4 border-2 border-foreground bg-band px-4 py-3">
              <p className="text-sm font-semibold">Buscar título, autor o tema…</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {["Foro", "Biblioteca", "Sala", "Classroom", "Agenda", "Invite"].map(
                (label, i) => (
                  <div
                    key={label}
                    className="flex aspect-[3/4] flex-col justify-between border-2 border-foreground bg-background p-3"
                    style={{
                      backgroundColor: i % 2 === 0 ? "var(--band)" : "var(--accent-light)",
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
