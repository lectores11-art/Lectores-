"use client";

import { Button } from "@/components/ui/button";

export function MeetingNotice({
  onAccept,
  onCancel,
}: {
  onAccept: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 px-4">
      <div className="w-full max-w-md rounded-md border border-border bg-background p-6 hard-shadow">
        <h2 className="text-lg font-bold">Sala en vivo</h2>
        <p className="mt-3 text-sm text-muted">
          Si prendés cámara o micrófono, las demás miembros de este club pueden verte u oírte.
          Hilo de Letras no graba esta sala. El chat queda guardado en la comunidad.
        </p>
        <div className="mt-6 flex gap-2">
          <Button type="button" onClick={onAccept}>
            Entendido, entrar
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
