"use client";

import { toEmbedPlayback } from "@/lib/video/embed-url";

export function ClassroomVideoPlayer({ url }: { url: string }) {
  const playback = toEmbedPlayback(url);

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
