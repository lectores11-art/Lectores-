import { describe, expect, it } from "vitest";
import { parseYoutubeId, toEmbedPlayback } from "./embed-url";

describe("toEmbedPlayback", () => {
  it("converts youtu.be share links to youtube embed", () => {
    expect(
      toEmbedPlayback("https://youtu.be/Nfo6ZwZsL04?si=abc")
    ).toEqual({
      kind: "iframe",
      src: "https://www.youtube.com/embed/Nfo6ZwZsL04",
    });
  });

  it("converts youtube watch URLs", () => {
    expect(
      toEmbedPlayback("https://www.youtube.com/watch?v=Nfo6ZwZsL04")
    ).toEqual({
      kind: "iframe",
      src: "https://www.youtube.com/embed/Nfo6ZwZsL04",
    });
  });

  it("passes through existing embed URLs", () => {
    expect(
      toEmbedPlayback("https://www.youtube.com/embed/Nfo6ZwZsL04")
    ).toEqual({
      kind: "iframe",
      src: "https://www.youtube.com/embed/Nfo6ZwZsL04",
    });
  });

  it("converts vimeo page URLs to player embed", () => {
    expect(toEmbedPlayback("https://vimeo.com/123456789")).toEqual({
      kind: "iframe",
      src: "https://player.vimeo.com/video/123456789",
    });
  });

  it("returns null for empty or invalid input", () => {
    expect(toEmbedPlayback("")).toBeNull();
    expect(toEmbedPlayback("not a url")).toBeNull();
  });

  it("keeps Mux HLS in a video element", () => {
    expect(
      toEmbedPlayback("https://stream.mux.com/abc.m3u8")
    ).toEqual({
      kind: "video",
      src: "https://stream.mux.com/abc.m3u8",
    });
  });
});

describe("parseYoutubeId", () => {
  it("extracts ids from share and watch URLs", () => {
    expect(parseYoutubeId("https://youtu.be/Nfo6ZwZsL04?si=abc")).toBe(
      "Nfo6ZwZsL04"
    );
    expect(parseYoutubeId("https://www.youtube.com/watch?v=Nfo6ZwZsL04")).toBe(
      "Nfo6ZwZsL04"
    );
  });
});
