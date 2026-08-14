"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  addMonths,
  format,
  isSameMonth,
  isToday,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, List, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EventDetailModal } from "@/components/calendar/event-detail-modal";
import { useDetailPanel } from "@/components/layout/detail-panel-context";
import {
  formatClockLabel,
  formatEventChip,
  formatEventTime,
  monthGridDays,
  resolveEventRange,
  visibleRange,
} from "@/lib/calendar/format";
import { cn } from "@/lib/utils";
import type { CalendarEvent, EventType } from "@/lib/types/database";

const EVENT_TYPES: EventType[] = ["meeting", "deadline", "announcement", "other"];

function parseEventType(raw: FormDataEntryValue | null): EventType {
  const value = String(raw || "other");
  return EVENT_TYPES.includes(value as EventType) ? (value as EventType) : "other";
}

const WEEKDAYS = ["lun.", "mar.", "mié.", "jue.", "vie.", "sáb.", "dom."];

function subscribeClock(onStoreChange: () => void) {
  const id = window.setInterval(onStoreChange, 30_000);
  return () => window.clearInterval(id);
}

function clockMinuteTick() {
  return Math.floor(Date.now() / 60_000);
}

function eventMatchesQuery(event: CalendarEvent, q: string) {
  if (!q) return true;
  return (
    event.title.toLowerCase().includes(q) ||
    (event.description || "").toLowerCase().includes(q)
  );
}

export function CalendarPageClient({
  communityId,
  slug,
  logoUrl,
  isAdmin,
}: {
  communityId: string;
  slug: string;
  logoUrl: string | null;
  isAdmin: boolean;
}) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const minuteTick = useSyncExternalStore(subscribeClock, clockMinuteTick, () => 0);
  const now = minuteTick === 0 ? null : new Date(minuteTick * 60_000);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<"month" | "list">("month");
  const [reloadToken, setReloadToken] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const { searchQuery, setSearchPlaceholder } = useDetailPanel();

  useEffect(() => {
    setSearchPlaceholder("Buscar eventos…");
  }, [setSearchPlaceholder]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const { start, end } = visibleRange(currentMonth);

    void (async () => {
      try {
        const { data, error } = await supabase
          .from("calendar_events")
          .select("*")
          .eq("community_id", communityId)
          .gte("starts_at", start.toISOString())
          .lte("starts_at", end.toISOString())
          .order("starts_at");

        if (cancelled) return;
        if (error) {
          setLoadError("No se pudieron cargar los eventos. Intentá de nuevo.");
          return;
        }
        setLoadError("");
        setEvents(data || []);
      } catch {
        if (!cancelled) {
          setLoadError(
            "No se pudieron cargar los eventos. Revisá tu conexión e intentá de nuevo."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [communityId, currentMonth, reloadToken]);

  async function createEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitError("");
    setSubmitting(true);

    try {
      const form = new FormData(e.currentTarget);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSubmitError("Tenés que iniciar sesión para crear un evento.");
        return;
      }

      const title = String(form.get("title") || "").trim();
      if (!title) {
        setSubmitError("El título es obligatorio.");
        return;
      }

      const endsRaw = String(form.get("endsAt") || "").trim();
      const range = resolveEventRange(
        new Date(String(form.get("startsAt") || "")),
        endsRaw ? new Date(endsRaw) : null
      );
      if (!range.ok) {
        setSubmitError(range.error);
        return;
      }

      const description = String(form.get("description") || "").trim();
      const { error } = await supabase.from("calendar_events").insert({
        community_id: communityId,
        title,
        description: description || null,
        event_type: parseEventType(form.get("eventType")),
        starts_at: range.startsAt.toISOString(),
        ends_at: range.endsAt.toISOString(),
        created_by: user.id,
      });

      if (error) {
        setSubmitError("No se pudo guardar el evento. Intentá de nuevo.");
        return;
      }

      setShowForm(false);
      setReloadToken((token) => token + 1);
    } catch {
      setSubmitError("No se pudo guardar el evento. Revisá tu conexión e intentá de nuevo.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const days = useMemo(() => monthGridDays(currentMonth), [currentMonth]);
  const q = searchQuery.trim().toLowerCase();
  const visibleEvents = useMemo(
    () => events.filter((event) => eventMatchesQuery(event, q)),
    [events, q]
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of visibleEvents) {
      const key = format(new Date(event.starts_at), "yyyy-MM-dd");
      const list = map.get(key) || [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [visibleEvents]);

  const listGroups = useMemo(() => {
    const groups: { key: string; label: string; events: CalendarEvent[] }[] = [];
    for (const [key, dayEvents] of eventsByDay) {
      groups.push({
        key,
        label: format(new Date(dayEvents[0].starts_at), "EEEE, d 'de' MMMM", {
          locale: es,
        }),
        events: dayEvents,
      });
    }
    return groups.sort((a, b) => a.key.localeCompare(b.key));
  }, [eventsByDay]);

  return (
    <div className="flex min-h-full flex-col bg-white px-3 pb-6 pt-3 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col">
        <div className="relative mb-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentMonth(new Date())}
              className="h-9 rounded-full border border-[#d8d8d8] bg-white px-4 text-sm font-medium text-[#1a1a1a] hover:bg-[#f7f7f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B6BF2]"
            >
              Hoy
            </button>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => {
                  setShowForm((open) => !open);
                  setSubmitError("");
                }}
                className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium text-[#2B6BF2] hover:bg-[#f3f7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B6BF2]"
              >
                <Plus className="h-4 w-4" />
                Nuevo
              </button>
            ) : null}
          </div>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Mes anterior"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#5f5f5f] hover:bg-[#f3f3f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B6BF2]"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h1 className="min-w-[11ch] text-center text-[22px] font-semibold capitalize tracking-tight text-[#1a1a1a]">
                {format(currentMonth, "MMMM yyyy", { locale: es })}
              </h1>
              <button
                type="button"
                aria-label="Mes siguiente"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#5f5f5f] hover:bg-[#f3f3f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B6BF2]"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <p className="h-[18px] text-[13px] text-[#8a8a8a]">
              {now ? formatClockLabel(now) : ""}
            </p>
          </div>

          <div className="flex justify-end">
            <div className="inline-flex rounded-lg p-0.5">
              <button
                type="button"
                aria-label="Vista de lista"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md text-[#5f5f5f]",
                  view === "list" && "bg-[#ececec] text-[#1a1a1a]"
                )}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Vista de calendario"
                aria-pressed={view === "month"}
                onClick={() => setView("month")}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md text-[#5f5f5f]",
                  view === "month" && "bg-[#ececec] text-[#1a1a1a]"
                )}
              >
                <CalendarDays className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {showForm && isAdmin ? (
          <form
            onSubmit={createEvent}
            className="mb-4 grid gap-4 rounded-xl border border-[#ececec] bg-white p-4 sm:grid-cols-2"
          >
            <div className="space-y-2">
              <Label>Título</Label>
              <Input name="title" required />
            </div>
            <div className="space-y-2">
              <Label>Inicio</Label>
              <Input name="startsAt" type="datetime-local" required />
            </div>
            <div className="space-y-2">
              <Label>Fin</Label>
              <Input name="endsAt" type="datetime-local" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <select
                name="eventType"
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="meeting">Reunión</option>
                <option value="deadline">Fecha límite</option>
                <option value="announcement">Anuncio</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Descripción (podés pegar un enlace)</Label>
              <Input name="description" />
            </div>
            {submitError ? (
              <p className="sm:col-span-2 text-sm text-red-600" role="alert">
                {submitError}
              </p>
            ) : null}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Guardando…" : "Crear evento"}
              </Button>
            </div>
          </form>
        ) : null}

        {loadError ? (
          <div
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className="font-semibold underline underline-offset-2"
            >
              Reintentar
            </button>
          </div>
        ) : null}

        {view === "month" ? (
          <div className="flex min-h-[min(72vh,760px)] flex-1 flex-col">
            <div className="grid grid-cols-7 border-b border-[#ececec]">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="px-2 py-2 text-left text-[13px] text-[#8a8a8a]"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid flex-1 grid-cols-7 grid-rows-6 border-l border-t border-[#ececec]">
              {days.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayEvents = eventsByDay.get(key) || [];
                const inMonth = isSameMonth(day, currentMonth);
                return (
                  <div
                    key={key}
                    className="min-h-[96px] border-b border-r border-[#ececec] p-1.5 sm:min-h-[108px] sm:p-2"
                  >
                    <div className="mb-1">
                      <span
                        className={cn(
                          "inline-flex h-7 min-w-7 items-center justify-center rounded-full text-sm",
                          isToday(day)
                            ? "bg-[#EA4335] font-semibold text-white"
                            : inMonth
                              ? "text-[#3c3c3c]"
                              : "text-[#c0c0c0]"
                        )}
                      >
                        {format(day, "d")}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          title={event.title}
                          onClick={() => setSelectedEvent(event)}
                          className="block w-full truncate text-left text-[12px] font-medium leading-5 text-[#2B6BF2] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B6BF2]"
                        >
                          {formatEventChip(new Date(event.starts_at), event.title)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 border-t border-[#ececec] pt-4">
            {listGroups.length === 0 ? (
              <p className="py-16 text-center text-sm text-[#8a8a8a]">
                {loadError
                  ? loadError
                  : q
                    ? `Ningún evento coincide con «${searchQuery.trim()}».`
                    : "No hay eventos este mes."}
              </p>
            ) : (
              <ul className="divide-y divide-[#ececec]">
                {listGroups.map((group) => (
                  <li key={group.key} className="py-4">
                    <p className="mb-2 text-sm font-semibold capitalize text-[#1a1a1a]">
                      {group.label}
                    </p>
                    <div className="space-y-1">
                      {group.events.map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => setSelectedEvent(event)}
                          className="flex w-full items-baseline gap-3 rounded-md px-1 py-1.5 text-left hover:bg-[#f7f7f7]"
                        >
                          <span className="w-28 shrink-0 text-sm text-[#5f5f5f]">
                            {formatEventTime(new Date(event.starts_at))}
                            {event.ends_at
                              ? ` - ${formatEventTime(new Date(event.ends_at))}`
                              : ""}
                          </span>
                          <span className="truncate text-sm font-medium text-[#2B6BF2]">
                            {event.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <EventDetailModal
        event={selectedEvent}
        slug={slug}
        logoUrl={logoUrl}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
