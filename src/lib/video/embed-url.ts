export type EmbedPlayback =
  | { kind: "iframe"; src: string }
  | { kind: "video"; src: string };

function youtubeVideoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id || null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname.startsWith("/embed/")) {
      return url.pathname.split("/")[2] || null;
    }
    if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/live/")) {
      return url.pathname.split("/")[2] || null;
    }
    return url.searchParams.get("v");
  }
  return null;
}

function vimeoVideoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "player.vimeo.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const videoIdx = parts.indexOf("video");
    return videoIdx >= 0 ? parts[videoIdx + 1] || null : null;
  }
  if (host === "vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && /^\d+$/.test(id) ? id : null;
  }
  return null;
}

/** Turn a pasted watch/share URL into something the classroom player can load. */
export function toEmbedPlayback(raw: string): EmbedPlayback | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(url.protocol)) return null;

  const yt = youtubeVideoId(url);
  if (yt) {
    return {
      kind: "iframe",
      src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}`,
    };
  }

  const vimeo = vimeoVideoId(url);
  if (vimeo) {
    return {
      kind: "iframe",
      src: `https://player.vimeo.com/video/${encodeURIComponent(vimeo)}`,
    };
  }

  const host = url.hostname.replace(/^www\./, "");
  if (host === "stream.mux.com" || host.endsWith(".mux.com")) {
    if (url.pathname.includes("/embed") || host === "player.mux.com") {
      return { kind: "iframe", src: url.toString() };
    }
    return { kind: "video", src: url.toString() };
  }

  return { kind: "video", src: url.toString() };
}
