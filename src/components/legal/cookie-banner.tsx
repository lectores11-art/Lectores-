"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  COOKIE_CONSENT_KEY,
  parseCookieConsent,
  serializeCookieConsent,
} from "@/lib/legal/cookies";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function reopen() {
      setVisible(true);
    }
    function syncFromStorage() {
      const existing = parseCookieConsent(
        window.localStorage.getItem(COOKIE_CONSENT_KEY)
      );
      setVisible(!existing);
    }
    window.addEventListener("hilo-open-cookies", reopen);
    const id = window.setTimeout(syncFromStorage, 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("hilo-open-cookies", reopen);
    };
  }, []);

  function decide(embeds: boolean) {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, serializeCookieConsent(embeds));
    window.dispatchEvent(new Event("hilo-cookie-consent"));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background px-4 py-4 shadow-lg">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          Usamos cookies de sesión para entrar. Los vídeos de YouTube o Vimeo solo se cargan si
          aceptás embeds.{" "}
          <Link href="/cookies" className="font-semibold text-accent hover:underline">
            Política de cookies
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => decide(false)}>
            Solo necesarias
          </Button>
          <Button type="button" size="sm" onClick={() => decide(true)}>
            Aceptar embeds
          </Button>
        </div>
      </div>
    </div>
  );
}
