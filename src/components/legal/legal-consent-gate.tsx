"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LegalConsentFields,
  emptyLegalConsent,
} from "@/components/legal/legal-consent-fields";
import { LegalFooter } from "@/components/legal/legal-footer";
import { LEGAL_DRAFT_NOTICE } from "@/lib/legal/copy";

export function LegalConsentGate() {
  const router = useRouter();
  const [values, setValues] = useState(emptyLegalConsent);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/account/legal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo guardar.");
        return;
      }
      router.refresh();
    } catch {
      setError("No se pudo guardar. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md hard-shadow">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-band">
            <BookOpen className="h-5 w-5" />
          </div>
          <CardTitle>Antes de entrar</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-muted">{LEGAL_DRAFT_NOTICE}</p>
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            <LegalConsentFields values={values} onChange={setValues} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Guardando…" : "Continuar"}
            </Button>
          </form>
          <LegalFooter className="mt-6" />
        </CardContent>
      </Card>
    </div>
  );
}
