/** Shared path helpers for client→Storage book uploads. */

export const BOOKS_BUCKET = "books";
export const COVER_BUCKET = "book-covers";

const COVER_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function sanitizeStorageFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}

export function coverObjectContentType(file: File): string {
  if (COVER_MIME_TYPES.has(file.type)) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export function buildCommunityObjectPath(
  communityId: string,
  fileName: string
): string {
  return `${communityId}/${Date.now()}-${sanitizeStorageFileName(fileName)}`;
}

/** Ensures Storage object path is scoped to this community folder. */
export function isCommunityScopedPath(
  communityId: string,
  storagePath: string
): boolean {
  const prefix = `${communityId}/`;
  return (
    storagePath.startsWith(prefix) &&
    storagePath.length > prefix.length &&
    !storagePath.includes("..")
  );
}

/** Extract object path from a public book-covers URL (or null if unrecognized). */
export function coverPathFromPublicUrl(coverUrl: string | null): string | null {
  if (!coverUrl) return null;
  const marker = `/object/public/${COVER_BUCKET}/`;
  const idx = coverUrl.indexOf(marker);
  if (idx === -1) return null;
  const path = decodeURIComponent(
    coverUrl.slice(idx + marker.length).split("?")[0] || ""
  );
  return path || null;
}
