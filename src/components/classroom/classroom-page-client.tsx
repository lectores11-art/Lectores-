"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Classroom</h1>
          <p className="text-sm text-slate-500">Grabaciones y lecciones</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm(!showForm)}>Nuevo curso</Button>
        )}
      </div>

      {showForm && isAdmin && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <form onSubmit={createCourse} className="space-y-4">
              <div className="space-y-2">
                <Label>Título del curso</Label>
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
                <Input name="videoUrl" placeholder="https://..." required />
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
              <CardContent className="py-8 text-center text-slate-500">
                No hay cursos aún
              </CardContent>
            </Card>
          ) : (
            courses.map((course) => (
              <Card key={course.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <GraduationCap className="h-4 w-4 text-sky-500" />
                    {course.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(course.lessons || [])
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((lesson) => (
                      <button
                        key={lesson.id}
                        onClick={() => setSelectedLesson(lesson)}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          selectedLesson?.id === lesson.id
                            ? "bg-sky-50 text-sky-700"
                            : "hover:bg-slate-50"
                        }`}
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
            <Card>
              <CardHeader>
                <CardTitle>{selectedLesson.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedLesson.video_url ? (
                  <div className="aspect-video overflow-hidden rounded-lg bg-black">
                    {selectedLesson.video_url.includes("youtube") ||
                    selectedLesson.video_url.includes("vimeo") ||
                    selectedLesson.video_url.includes("mux") ? (
                      <iframe
                        src={selectedLesson.video_url}
                        className="h-full w-full"
                        allowFullScreen
                        allow="autoplay; encrypted-media"
                      />
                    ) : (
                      <video src={selectedLesson.video_url} controls className="h-full w-full" />
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500">Video no disponible</p>
                )}
                <div className="mt-4">
                  <Progress value={0} />
                  <p className="mt-1 text-xs text-slate-500">Progreso de la lección</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex h-64 items-center justify-center text-slate-500">
                Selecciona una lección para ver el video
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
