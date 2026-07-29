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
import { useDetailPanel } from "@/components/layout/detail-panel-context";
import { cn } from "@/lib/utils";
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
  const { setDetail, setSearchPlaceholder } = useDetailPanel();

  useEffect(() => {
    setSearchPlaceholder("Buscar eventos…");
  }, [setSearchPlaceholder]);

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

  function pickDate(day: Date) {
    setSelectedDate(day);
    const dayEvts = events.filter((e) => isSameDay(new Date(e.starts_at), day));
    if (dayEvts.length === 0) {
      setDetail({
        kind: "day",
        title: format(day, "d MMMM yyyy", { locale: es }),
        description: "Sin eventos este día.",
      });
      return;
    }
    const first = dayEvts[0];
    setDetail({
      kind: "event",
      title: first.title,
      subtitle: format(day, "d MMMM yyyy", { locale: es }),
      description:
        dayEvts.length > 1
          ? `${dayEvts.length} eventos. Primero: ${first.description || first.title}`
          : first.description || undefined,
      meta: [
        { label: "Hora", value: format(new Date(first.starts_at), "HH:mm") },
        { label: "Tipo", value: first.event_type },
        ...(dayEvts.length > 1
          ? [{ label: "Total", value: String(dayEvts.length) }]
          : []),
      ],
    });
  }

  function pickEvent(event: CalendarEvent) {
    setDetail({
      kind: "event",
      title: event.title,
      subtitle: format(new Date(event.starts_at), "d MMMM yyyy · HH:mm", {
        locale: es,
      }),
      description: event.description || undefined,
      meta: [{ label: "Tipo", value: event.event_type }],
    });
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
    <div className="p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendario</h1>
          <p className="text-sm text-muted">Eventos del mes</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm(!showForm)}>Nuevo evento</Button>
        )}
      </div>

      {showForm && isAdmin && (
        <Card className="mb-6 hard-shadow-sm">
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
                  className="flex h-10 w-full rounded-sm border-2 border-foreground bg-surface px-3 text-sm"
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
        <Card className="lg:col-span-2 hard-shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: es })}
            </CardTitle>
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
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase tracking-wide text-muted">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
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
                    type="button"
                    onClick={() => pickDate(day)}
                    className={cn(
                      "relative rounded-sm border-2 p-2 text-sm font-semibold transition-colors",
                      isSelected
                        ? "border-foreground bg-accent text-white"
                        : isSameMonth(day, currentMonth)
                          ? "border-transparent hover:border-foreground hover:bg-accent-light"
                          : "border-transparent text-muted/40"
                    )}
                  >
                    {format(day, "d")}
                    {dayEvts.length > 0 && (
                      <span
                        className={cn(
                          "absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full",
                          isSelected ? "bg-white" : "bg-accent"
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="hard-shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">
              {selectedDate
                ? format(selectedDate, "d MMMM", { locale: es })
                : "Seleccioná un día"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dayEvents.length === 0 ? (
              <p className="text-sm text-muted">Sin eventos</p>
            ) : (
              <div className="space-y-3">
                {dayEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => pickEvent(event)}
                    className="w-full rounded-sm border-2 border-foreground bg-surface p-3 text-left hard-shadow-sm hard-shadow-hover"
                  >
                    <p className="font-bold">{event.title}</p>
                    <p className="text-xs text-muted">
                      {format(new Date(event.starts_at), "HH:mm")} · {event.event_type}
                    </p>
                    {event.description && (
                      <p className="mt-1 text-sm text-muted">{event.description}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
