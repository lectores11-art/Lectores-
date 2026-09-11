"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function ReportButton({
  slug,
  targetType,
  targetId,
}: {
  slug: string;
  targetType: "book" | "thread" | "lesson";
  targetId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setMessage("");
    try {
      const res = await fetch(`/api/c/${slug}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || "No se pudo enviar.");
        return;
      }
      setMessage("Reporte enviado. Lo revisamos.");
      setReason("");
      setOpen(false);
    } catch {
      setMessage("No se pudo enviar.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-2">
      {!open ? (
        <button
          type="button"
          className="text-xs font-semibold uppercase tracking-wide text-muted hover:text-foreground"
          onClick={() => setOpen(true)}
        >
          Reportar
        </button>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="space-y-2 rounded-md border border-border p-3">
          <Label htmlFor={`report-${targetId}`}>¿Qué ocurre?</Label>
          <textarea
            id={`report-${targetId}`}
            required
            minLength={10}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-20 w-full rounded-md border border-border bg-background p-2 text-sm"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={sending}>
              {sending ? "Enviando…" : "Enviar"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
      {message && <p className="text-xs text-muted">{message}</p>}
    </div>
  );
}
