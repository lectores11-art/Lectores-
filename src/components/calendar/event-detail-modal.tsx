"use client";

import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, CalendarPlus, ChevronDown, Link2 } from "lucide-react";
import {
  firstUrl,
  formatEventTime,
  formatHubTimes,
  googleCalendarUrl,
  icsContent,
  icsFilename,
  outlookCalendarUrl,
  type CalendarExportEvent,
} from "@/lib/calendar/format";
import { CALENDAR_DAY_ZONE } from "@/lib/calendar/timezone";
import type { CalendarEvent } from "@/lib/types/database";

function eventEnd(event: CalendarEvent): Date {
  if (event.ends_at) return new Date(event.ends_at);
  return new Date(new Date(event.starts_at).getTime() + 60 * 60 * 1000);
}

function eventHref(event: CalendarEvent, slug: string): string | null {
  const fromDescription = firstUrl(event.description);
  if (fromDescription) return fromDescription;
  if (event.meeting_id && typeof window !== "undefined") {
    return `${window.location.origin}/c/${slug}/meeting`;
  }
  if (event.meeting_id) return `/c/${slug}/meeting`;
  return null;
}

function downloadIcs(event: CalendarEvent, url: string | null) {
  const blob = new Blob(
    [
      icsContent({
        uid: event.id,
        title: event.title,
        description: event.description,
        startsAt: new Date(event.starts_at),
        endsAt: eventEnd(event),
        url,
      }),
    ],
    { type: "text/calendar;charset=utf-8" }
  );
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = icsFilename(event.title);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

export function EventDetailModal({
  event,
  slug,
  logoUrl,
  onClose,
}: {
  event: CalendarEvent | null;
  slug: string;
  logoUrl: string | null;
  onClose: () => void;
}) {
  const startsAt = event ? new Date(event.starts_at) : null;
  const endsAt = event ? eventEnd(event) : null;
  const href = event ? eventHref(event, slug) : null;
  const exportEvent =
    event && startsAt && endsAt
      ? {
          uid: event.id,
          title: event.title,
          description: event.description,
          startsAt,
          endsAt,
          url: href,
        }
      : null;

  const day = startsAt
    ? startsAt.toLocaleDateString("es-AR", {
        day: "numeric",
        timeZone: CALENDAR_DAY_ZONE,
      })
    : "";
  const weekday = startsAt
    ? startsAt.toLocaleDateString("es-AR", {
        weekday: "long",
        timeZone: CALENDAR_DAY_ZONE,
      })
    : "";
  const month = startsAt
    ? startsAt.toLocaleDateString("es-AR", {
        month: "long",
        timeZone: CALENDAR_DAY_ZONE,
      })
    : "";

  return (
    <Dialog.Root open={!!event} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(100%-2rem,440px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)] focus:outline-none"
        >
          {event && startsAt && exportEvent ? (
            <>
              <div className="relative h-44 overflow-hidden bg-[#161616]">
                <div className="flex h-full items-end justify-between px-6 pb-5">
                  <p className="font-serif text-7xl font-medium leading-none tracking-tight text-white">
                    {day}
                  </p>
                  <p className="pb-1 text-right text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                    {weekday}
                    <span className="mt-1 block tracking-[0.18em]">{month}</span>
                  </p>
                </div>
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt=""
                    className="absolute right-4 top-4 h-10 w-10 rounded-md object-cover ring-1 ring-white/25"
                  />
                ) : null}
              </div>

              <div className="px-6 pb-6 pt-5">
                <Dialog.Title className="text-[22px] font-bold leading-tight tracking-tight text-[#1a1a1a]">
                  {event.title}
                </Dialog.Title>
                <Dialog.Description className="sr-only">
                  {startsAt
                    ? formatHubTimes(startsAt)
                        .map((hub) => `${hub.time} ${hub.label}`)
                        .join(", ")
                    : ""}
                  {event.description ? `. ${event.description}` : ""}
                </Dialog.Description>

                <div className="mt-4 flex gap-3">
                  <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-[#5f5f5f]" />
                  <ul className="space-y-1 text-sm">
                    {formatHubTimes(startsAt).map((hub) => (
                      <li key={hub.id} className="flex gap-3">
                        <span className="w-[5.5rem] shrink-0 text-[#8a8a8a]">
                          {hub.label}
                        </span>
                        <span className="font-medium text-[#1a1a1a]">
                          {hub.time}
                          {endsAt ? ` – ${formatEventTime(endsAt, hub.id)}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {href ? (
                  <div className="mt-3 flex items-start gap-3">
                    <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-[#5f5f5f]" />
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-sm text-[#2B6BF2] underline decoration-[#2B6BF2]/40 underline-offset-2 hover:decoration-[#2B6BF2]"
                    >
                      {href}
                    </a>
                  </div>
                ) : null}

                {event.description &&
                event.description.trim() !== href ? (
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-[#3d3d3d]">
                    {event.description}
                  </p>
                ) : null}

                {event && exportEvent ? (
                  <AddToCalendarMenu
                    key={event.id}
                    event={event}
                    exportEvent={exportEvent}
                    href={href}
                  />
                ) : null}
              </div>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AddToCalendarMenu({
  event,
  exportEvent,
  href,
}: {
  event: CalendarEvent;
  exportEvent: CalendarExportEvent;
  href: string | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointer(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, [menuOpen]);

  return (
    <div className="relative mt-6" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#2B6BF2] text-sm font-bold uppercase tracking-wide text-white hover:bg-[#1f5ad6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B6BF2] focus-visible:ring-offset-2"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        <CalendarPlus className="h-4 w-4" />
        Añadir al calendario
        <ChevronDown className="h-4 w-4" />
      </button>
      {menuOpen ? (
        <div
          role="menu"
          className="absolute inset-x-0 bottom-[calc(100%+6px)] overflow-hidden rounded-lg border border-[#e8e8e8] bg-white py-1 shadow-lg"
        >
          <a
            role="menuitem"
            href={googleCalendarUrl(exportEvent)}
            target="_blank"
            rel="noreferrer"
            onClick={() => setMenuOpen(false)}
            className="block px-4 py-2.5 text-sm text-[#1a1a1a] hover:bg-[#f5f5f5]"
          >
            Google Calendar
          </a>
          <a
            role="menuitem"
            href={outlookCalendarUrl(exportEvent)}
            target="_blank"
            rel="noreferrer"
            onClick={() => setMenuOpen(false)}
            className="block px-4 py-2.5 text-sm text-[#1a1a1a] hover:bg-[#f5f5f5]"
          >
            Outlook
          </a>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              downloadIcs(event, href);
              setMenuOpen(false);
            }}
            className="block w-full px-4 py-2.5 text-left text-sm text-[#1a1a1a] hover:bg-[#f5f5f5]"
          >
            Descargar .ics
          </button>
        </div>
      ) : null}
    </div>
  );
}
