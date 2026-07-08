"use client";

import { useEffect, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CalendarEvent } from "@/lib/types/database";

export function CalendarPageClient({
  communityId,
  isAdmin,
}: {
  communityId: string;
  isAdmin: boolean;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadEvents();
  }, [communityId, currentMonth]);

  async function loadEvents() {
    const supabase = createClient();
    const start = startOfMonth(currentMonth).toISOString();
    const end = endOfMonth(currentMonth).toISOString();

    const { data } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("community_id", communityId)
      .gte("starts_at", start)
      .lte("starts_at", end)
      .order("starts_at");

    setEvents(data || []);
  }

  async function createEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("calendar_events").insert({
      community_id: communityId,
      title: form.get("title") as string,
      description: form.get("description") as string,
      event_type: (form.get("eventType") as string) || "other",
      starts_at: form.get("startsAt") as string,
      created_by: user.id,
    });

    setShowForm(false);
    loadEvents();
  }

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const dayEvents = selectedDate
    ? events.filter((e) => isSameDay(new Date(e.starts_at), selectedDate))
    : [];

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calendario</h1>
          <p className="text-sm text-slate-500">Eventos del mes</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm(!showForm)}>Nuevo evento</Button>
        )}
      </div>

      {showForm && isAdmin && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <form onSubmit={createEvent} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input name="title" required />
              </div>
              <div className="space-y-2">
                <Label>Fecha y hora</Label>
                <Input name="startsAt" type="datetime-local" required />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <select
                  name="eventType"
                  className="flex h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                >
                  <option value="meeting">Reunión</option>
                  <option value="deadline">Fecha límite</option>
                  <option value="announcement">Anuncio</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Input name="description" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Crear evento</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{format(currentMonth, "MMMM yyyy", { locale: es })}</CardTitle>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                <div key={d} className="py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: (days[0].getDay() + 6) % 7 }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {days.map((day) => {
                const dayEvts = events.filter((e) =>
                  isSameDay(new Date(e.starts_at), day)
                );
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`relative rounded-lg p-2 text-sm transition-colors ${
                      isSelected
                        ? "bg-sky-500 text-white"
                        : isSameMonth(day, currentMonth)
                          ? "hover:bg-slate-100"
                          : "text-slate-300"
                    }`}
                  >
                    {format(day, "d")}
                    {dayEvts.length > 0 && (
                      <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-sky-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedDate
                ? format(selectedDate, "d MMMM", { locale: es })
                : "Selecciona un día"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dayEvents.length === 0 ? (
              <p className="text-sm text-slate-500">Sin eventos</p>
            ) : (
              <div className="space-y-3">
                {dayEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border border-slate-200 p-3">
                    <p className="font-medium text-slate-900">{event.title}</p>
                    <p className="text-xs text-slate-500">
                      {format(new Date(event.starts_at), "HH:mm")} · {event.event_type}
                    </p>
                    {event.description && (
                      <p className="mt-1 text-sm text-slate-600">{event.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
