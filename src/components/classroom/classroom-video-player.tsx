"use client";

import { useEffect, useState } from "react";
import { toEmbedPlayback } from "@/lib/video/embed-url";
import {
  COOKIE_CONSENT_KEY,
  isEmbedAllowed,
  parseCookieConsent,
} from "@/lib/legal/cookies";
import { Button } from "@/components/ui/button";

export function ClassroomVideoPlayer({ url }: { url: string }) {
  const playback = toEmbedPlayback(url);
  const [consent, setConsent] = useState(() =>
    typeof window === "undefined"
      ? null
      : parseCookieConsent(window.localStorage.getItem(COOKIE_CONSENT_KEY))
  );

  useEffect(() => {
    function sync() {
      setConsent(parseCookieConsent(window.localStorage.getItem(COOKIE_CONSENT_KEY)));
    }
    window.addEventListener("hilo-cookie-consent", sync);
    return () => window.removeEventListener("hilo-cookie-consent", sync);
  }, []);

  if (!playback) {
    return <p className="text-muted">No se pudo cargar este enlace</p>;
  }

  if (playback.kind === "video") {
    return (
      <video
        src={playback.src}
        controls
        className="block w-full"
        style={{ aspectRatio: "16 / 9", height: "auto" }}
      />
    );
  }

  if (!isEmbedAllowed(consent)) {
    return (
      <div className="space-y-3 rounded-md border border-border p-4 text-sm">
        <p className="text-muted">
          Este vídeo viene de un sitio tercero (YouTube, Vimeo o Mux) y puede usar cookies.
          Aceptá embeds para verlo.
        </p>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            window.dispatchEvent(new Event("hilo-open-cookies"));
          }}
        >
          Revisar cookies
        </Button>
      </div>
    );
  }

  const src = new URL(playback.src);
  src.searchParams.set("rel", "0");
  src.searchParams.set("playsinline", "1");
  src.searchParams.set("modestbranding", "1");

  return (
    <iframe
      src={src.toString()}
      title="Grabación del encuentro"
      width={560}
      height={315}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      className="block w-full border-0"
      style={{ aspectRatio: "16 / 9", height: "auto" }}
    />
  );
}
