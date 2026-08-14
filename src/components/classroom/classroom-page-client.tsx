"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useDetailPanel } from "@/components/layout/detail-panel-context";
import { cn } from "@/lib/utils";
import { toEmbedPlayback } from "@/lib/video/embed-url";
import type { Course, Lesson } from "@/lib/types/database";

export function ClassroomPageClient({
  slug,
  communityId,
  isAdmin,
}: {
  slug: string;
  communityId: string;
  isAdmin: boolean;
}) {
  const [courses, setCourses] = useState<(Course & { lessons?: Lesson[] })[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { setSearchPlaceholder } = useDetailPanel();

  useEffect(() => {
    setSearchPlaceholder("Buscar encuentros o grabaciones…");
  }, [setSearchPlaceholder]);

  useEffect(() => {
    loadCourses();
  }, [communityId]);

  async function loadCourses() {
    const supabase = createClient();
    const { data } = await supabase
      .from("courses")
      .select("*, lessons(*)")
      .eq("community_id", communityId)
      .eq("is_published", true)
      .order("sort_order");

    setCourses(data || []);
  }

  function pickLesson(lesson: Lesson) {
    setSelectedLesson(lesson);
  }

  async function createCourse(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const supabase = createClient();

    const { data: course } = await supabase
      .from("courses")
      .insert({
        community_id: communityId,
        title: form.get("title") as string,
        description: form.get("description") as string,
        is_published: true,
      })
      .select()
      .single();

    if (course) {
      await supabase.from("lessons").insert({
        course_id: course.id,
        title: form.get("lessonTitle") as string,
        video_url: form.get("videoUrl") as string,
        video_provider: "embed",
        is_published: true,
      });
    }

    setShowForm(false);
    loadCourses();
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Encuentros</h1>
          <p className="text-sm text-muted">Grabaciones de encuentros</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm(!showForm)}>Nuevo encuentro</Button>
        )}
      </div>

      {showForm && isAdmin && (
        <Card className="mb-6 hard-shadow-sm">
          <CardContent className="pt-6">
            <form onSubmit={createCourse} className="space-y-4">
              <div className="space-y-2">
                <Label>Título del encuentro</Label>
                <Input name="title" required />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Input name="description" />
              </div>
              <div className="space-y-2">
                <Label>Título de la lección</Label>
                <Input name="lessonTitle" required />
              </div>
              <div className="space-y-2">
                <Label>URL del video (Vimeo/Mux/YouTube embed)</Label>
                <Input
                  name="videoUrl"
                  placeholder="https://youtu.be/… o URL de Vimeo / Mux"
                  required
                />
              </div>
              <Button type="submit">Crear</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          {courses.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted">
                No hay encuentros aún
              </CardContent>
            </Card>
          ) : (
            courses.map((course) => (
              <Card key={course.id} className="hard-shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <GraduationCap className="h-4 w-4 text-accent" />
                    {course.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(course.lessons || [])
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((lesson) => (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => pickLesson(lesson)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors",
                          selectedLesson?.id === lesson.id
                            ? "border-accent bg-accent text-white"
                            : "border-transparent hover:border-border hover:bg-accent-light"
                        )}
                      >
                        <Play className="h-3 w-3" />
                        {lesson.title}
                      </button>
                    ))}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          {selectedLesson ? (
            <Card className="overflow-visible rounded-none hard-shadow-sm">
              <CardHeader>
                <CardTitle>{selectedLesson.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedLesson.video_url ? (
                  <ClassroomVideoPlayer url={selectedLesson.video_url} />
                ) : (
                  <p className="text-muted">Video no disponible</p>
                )}
                <div className="mt-4">
                  <Progress value={0} />
                  <p className="mt-1 text-xs text-muted">Progreso de la lección</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex h-64 items-center justify-center text-muted">
                Seleccioná una lección para ver el video
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ClassroomVideoPlayer({ url }: { url: string }) {
  const playback = toEmbedPlayback(url);

  if (!playback) {
    return <p className="text-muted">No se pudo cargar este enlace</p>;
  }

  // Hardware-accelerated YouTube/video layers paint in horizontal stripes when a
  // parent clips them (overflow:hidden, border-radius). Keep this unclipped and
  // on its own compositor layer. Confirmed against screenshot: ~11px bars on the
  // top half only; the YouTube thumbnail of the same video has no bars.
  const layerStyle = {
    aspectRatio: "16 / 9",
    height: "auto",
    transform: "translate3d(0, 0, 0)",
    backfaceVisibility: "hidden" as const,
  };

  if (playback.kind === "iframe") {
    return (
      <iframe
        src={playback.src}
        title="Grabación del encuentro"
        width={560}
        height={315}
        className="block w-full border-0"
        style={layerStyle}
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  }

  return (
    <video src={playback.src} controls className="block w-full" style={layerStyle} />
  );
}
