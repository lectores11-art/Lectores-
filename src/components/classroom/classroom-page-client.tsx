"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Pencil, Play, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useDetailPanel } from "@/components/layout/detail-panel-context";
import { cn } from "@/lib/utils";
import { ClassroomVideoPlayer } from "@/components/classroom/classroom-video-player";
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
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [addingToCourseId, setAddingToCourseId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const { setSearchPlaceholder } = useDetailPanel();

  useEffect(() => {
    setSearchPlaceholder("Buscar encuentros o grabaciones…");
  }, [setSearchPlaceholder]);

  useEffect(() => {
    void loadCourses();
  }, [communityId, isAdmin]);

  async function loadCourses() {
    const supabase = createClient();
    let query = supabase
      .from("courses")
      .select("*, lessons(*)")
      .eq("community_id", communityId)
      .order("sort_order");
    if (!isAdmin) query = query.eq("is_published", true);

    const { data } = await query;
    setCourses(data || []);
  }

  function pickLesson(lesson: Lesson) {
    setSelectedLesson(lesson);
    setEditingLesson(null);
  }

  async function createCourse(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionError("");
    const form = new FormData(e.currentTarget);
    const supabase = createClient();

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .insert({
        community_id: communityId,
        title: form.get("title") as string,
        description: form.get("description") as string,
        is_published: true,
      })
      .select()
      .single();

    if (courseError || !course) {
      setActionError("No se pudo crear el encuentro.");
      return;
    }

    const { error: lessonError } = await supabase.from("lessons").insert({
      course_id: course.id,
      title: form.get("lessonTitle") as string,
      video_url: form.get("videoUrl") as string,
      video_provider: "embed",
      is_published: true,
    });

    if (lessonError) {
      setActionError("El encuentro se creó, pero no se pudo guardar el video.");
      return;
    }

    setShowForm(false);
    await loadCourses();
  }

  async function saveCourse(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingCourse) return;
    setActionError("");
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const { error } = await supabase
      .from("courses")
      .update({
        title: String(form.get("title") || "").trim(),
        description: String(form.get("description") || "").trim() || null,
      })
      .eq("id", editingCourse.id);

    if (error) {
      setActionError("No se pudo guardar el encuentro.");
      return;
    }
    setEditingCourse(null);
    await loadCourses();
  }

  async function saveLesson(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingLesson) return;
    setActionError("");
    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") || "").trim();
    const videoUrl = String(form.get("videoUrl") || "").trim();
    const supabase = createClient();
    const { error } = await supabase
      .from("lessons")
      .update({ title, video_url: videoUrl })
      .eq("id", editingLesson.id);

    if (error) {
      setActionError("No se pudo guardar la grabación.");
      return;
    }
    setSelectedLesson((current) =>
      current?.id === editingLesson.id
        ? { ...current, title, video_url: videoUrl }
        : current
    );
    setEditingLesson(null);
    await loadCourses();
  }

  async function addLesson(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!addingToCourseId) return;
    setActionError("");
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const { error } = await supabase.from("lessons").insert({
      course_id: addingToCourseId,
      title: String(form.get("lessonTitle") || "").trim(),
      video_url: String(form.get("videoUrl") || "").trim(),
      video_provider: "embed",
      is_published: true,
    });
    if (error) {
      setActionError("No se pudo añadir la grabación.");
      return;
    }
    setAddingToCourseId(null);
    await loadCourses();
  }

  async function deleteCourse(course: Course) {
    if (
      !window.confirm(
        `¿Eliminar el encuentro “${course.title}” y todas sus grabaciones?`
      )
    ) {
      return;
    }
    setBusyId(course.id);
    setActionError("");
    const supabase = createClient();
    const { error } = await supabase.from("courses").delete().eq("id", course.id);
    setBusyId(null);
    if (error) {
      setActionError("No se pudo eliminar el encuentro.");
      return;
    }
    if (selectedLesson && course.lessons?.some((l) => l.id === selectedLesson.id)) {
      setSelectedLesson(null);
    }
    if (editingCourse?.id === course.id) setEditingCourse(null);
    await loadCourses();
  }

  async function deleteLesson(lesson: Lesson) {
    if (!window.confirm(`¿Eliminar la grabación “${lesson.title}”?`)) return;
    setBusyId(lesson.id);
    setActionError("");
    const supabase = createClient();
    const { error } = await supabase.from("lessons").delete().eq("id", lesson.id);
    setBusyId(null);
    if (error) {
      setActionError("No se pudo eliminar la grabación.");
      return;
    }
    if (selectedLesson?.id === lesson.id) setSelectedLesson(null);
    if (editingLesson?.id === lesson.id) setEditingLesson(null);
    await loadCourses();
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Encuentros</h1>
          <p className="text-sm text-muted">Grabaciones de encuentros</p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => {
              setShowForm(!showForm);
              setEditingCourse(null);
              setEditingLesson(null);
              setActionError("");
            }}
          >
            Nuevo encuentro
          </Button>
        )}
      </div>

      {actionError ? (
        <p className="mb-4 text-sm text-red-600">{actionError}</p>
      ) : null}

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

      {editingCourse && isAdmin && (
        <Card className="mb-6 hard-shadow-sm">
          <CardContent className="pt-6">
            <form onSubmit={saveCourse} className="space-y-4">
              <p className="text-sm font-semibold">Editar encuentro</p>
              <div className="space-y-2">
                <Label>Título</Label>
                <Input name="title" defaultValue={editingCourse.title} required />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Input name="description" defaultValue={editingCourse.description || ""} />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Guardar</Button>
                <Button type="button" variant="outline" onClick={() => setEditingCourse(null)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {editingLesson && isAdmin && (
        <Card className="mb-6 hard-shadow-sm">
          <CardContent className="pt-6">
            <form key={editingLesson.id} onSubmit={saveLesson} className="space-y-4">
              <p className="text-sm font-semibold">Editar grabación</p>
              <div className="space-y-2">
                <Label>Título</Label>
                <Input name="title" defaultValue={editingLesson.title} required />
              </div>
              <div className="space-y-2">
                <Label>URL del video</Label>
                <Input
                  name="videoUrl"
                  defaultValue={editingLesson.video_url || ""}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Guardar</Button>
                <Button type="button" variant="outline" onClick={() => setEditingLesson(null)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {addingToCourseId && isAdmin && (
        <Card className="mb-6 hard-shadow-sm">
          <CardContent className="pt-6">
            <form onSubmit={addLesson} className="space-y-4">
              <p className="text-sm font-semibold">Añadir grabación</p>
              <div className="space-y-2">
                <Label>Título de la lección</Label>
                <Input name="lessonTitle" required />
              </div>
              <div className="space-y-2">
                <Label>URL del video</Label>
                <Input name="videoUrl" required />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Añadir</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddingToCourseId(null)}
                >
                  Cancelar
                </Button>
              </div>
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
                  <CardTitle className="flex items-start justify-between gap-2 text-base">
                    <span className="flex min-w-0 items-center gap-2">
                      <GraduationCap className="h-4 w-4 shrink-0 text-accent" />
                      <span className="leading-snug">{course.title}</span>
                    </span>
                  </CardTitle>
                  {isAdmin && (
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingCourse(course);
                          setEditingLesson(null);
                          setShowForm(false);
                          setAddingToCourseId(null);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAddingToCourseId(course.id);
                          setEditingCourse(null);
                          setEditingLesson(null);
                          setShowForm(false);
                        }}
                      >
                        Añadir video
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busyId === course.id}
                        onClick={() => void deleteCourse(course)}
                      >
                        <Trash2 className="h-4 w-4" />
                        {busyId === course.id ? "Eliminando…" : "Eliminar"}
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {(course.lessons || [])
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((lesson) => (
                      <div key={lesson.id} className="flex items-stretch gap-1">
                        <button
                          type="button"
                          onClick={() => pickLesson(lesson)}
                          className={cn(
                            "flex min-w-0 flex-1 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors",
                            selectedLesson?.id === lesson.id
                              ? "border-accent bg-accent text-white"
                              : "border-transparent hover:border-border hover:bg-accent-light"
                          )}
                        >
                          <Play className="h-3 w-3 shrink-0" />
                          <span className="truncate">{lesson.title}</span>
                        </button>
                        {isAdmin && (
                          <div className="flex shrink-0 gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="px-2"
                              aria-label={`Editar ${lesson.title}`}
                              onClick={() => {
                                setEditingLesson(lesson);
                                setEditingCourse(null);
                                setShowForm(false);
                                setAddingToCourseId(null);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="px-2"
                              disabled={busyId === lesson.id}
                              aria-label={`Eliminar ${lesson.title}`}
                              onClick={() => void deleteLesson(lesson)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          {selectedLesson ? (
            <Card className="hard-shadow-sm">
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
