import { describe, expect, it } from "vitest";
import {
  COVER_BUCKET,
  coverPathFromPublicUrl,
  isCommunityScopedPath,
} from "./book-upload-paths";

const COMMUNITY = "11111111-1111-4111-8111-111111111111";

describe("isCommunityScopedPath", () => {
  it("accepts paths under the community folder", () => {
    expect(
      isCommunityScopedPath(COMMUNITY, `${COMMUNITY}/cover.jpg`)
    ).toBe(true);
  });

  it("rejects other communities, traversal, and bare ids", () => {
    expect(isCommunityScopedPath(COMMUNITY, "other/cover.jpg")).toBe(false);
    expect(
      isCommunityScopedPath(COMMUNITY, `${COMMUNITY}/../other/x.jpg`)
    ).toBe(false);
    expect(isCommunityScopedPath(COMMUNITY, COMMUNITY)).toBe(false);
  });
});

describe("coverPathFromPublicUrl", () => {
  it("parses public book-covers URLs", () => {
    const path = `${COMMUNITY}/123-cover.jpg`;
    const url = `https://xyz.supabase.co/storage/v1/object/public/${COVER_BUCKET}/${path}`;
    expect(coverPathFromPublicUrl(url)).toBe(path);
  });

  it("strips query strings and decodes path segments", () => {
    const path = `${COMMUNITY}/foo%20bar.jpg`;
    const url = `https://xyz.supabase.co/storage/v1/object/public/${COVER_BUCKET}/${path}?t=1`;
    expect(coverPathFromPublicUrl(url)).toBe(`${COMMUNITY}/foo bar.jpg`);
  });

  it("returns null for empty or unrecognized URLs", () => {
    expect(coverPathFromPublicUrl(null)).toBeNull();
    expect(coverPathFromPublicUrl("")).toBeNull();
    expect(
      coverPathFromPublicUrl("https://cdn.example/covers/x.jpg")
    ).toBeNull();
  });
});
