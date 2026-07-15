import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500 text-white">
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold text-slate-900">Lectores</span>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild>
              <Link href="/login">Iniciar sesión</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Tu comunidad de lectura,{" "}
            <span className="text-sky-500">privada y exclusiva</span>
          </h1>
          <p className="mt-6 text-lg text-slate-600">
            Foro, classroom, biblioteca con lector de libros, salas en vivo y calendario.
            Acceso solo por invitación.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" asChild>
              <Link href="/login">Iniciar sesión</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            El acceso es solo por invitación de tu comunidad.
          </p>
        </div>

        <div className="mt-24 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "Foro", desc: "Hilos, comentarios y likes entre lectoras" },
            { title: "Biblioteca", desc: "Lector de libros con progreso personal" },
            { title: "Sala en vivo", desc: "Video, chat y lectura simultánea" },
            { title: "Classroom", desc: "Grabaciones y lecciones organizadas" },
            { title: "Calendario", desc: "Eventos y reuniones del mes" },
            { title: "Privacidad", desc: "Comunidades 100% aisladas por invitación" },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-slate-200 p-6 transition-shadow hover:shadow-md"
            >
              <h3 className="font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
