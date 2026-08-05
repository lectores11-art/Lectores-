import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_COVER_BYTES, MAX_PDF_BYTES } from "./schemas";
import { validationErrorResponse } from "./errors";

const COVER_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function parseData<T>(
  schema: z.ZodType<T>,
  data: unknown
): { data: T } | { error: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { error: validationErrorResponse() };
  }
  return { data: result.data };
}

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<{ data: T } | { error: NextResponse }> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { error: validationErrorResponse() };
  }
  return parseData(schema, json);
}

function isPdfFile(file: File): boolean {
  if (file.type === "application/pdf") return true;
  // Some browsers (notably Safari) leave type empty or use octet-stream for PDFs.
  if (!file.type || file.type === "application/octet-stream") {
    return file.name.toLowerCase().endsWith(".pdf");
  }
  return false;
}

export function validatePdfFile(file: File | null): NextResponse | null {
  if (!file) {
    return validationErrorResponse();
  }
  if (!isPdfFile(file)) {
    return validationErrorResponse();
  }
  if (file.size <= 0 || file.size > MAX_PDF_BYTES) {
    return validationErrorResponse();
  }
  return null;
}

function isCoverFile(file: File): boolean {
  if (COVER_MIME_TYPES.has(file.type)) return true;
  // Some browsers leave type empty; fall back to extension.
  if (!file.type || file.type === "application/octet-stream") {
    const lower = file.name.toLowerCase();
    return (
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".webp")
    );
  }
  return false;
}

export function validateCoverFile(file: File | null): NextResponse | null {
  if (!file) {
    return validationErrorResponse();
  }
  if (!isCoverFile(file)) {
    return validationErrorResponse();
  }
  if (file.size <= 0 || file.size > MAX_COVER_BYTES) {
    return validationErrorResponse();
  }
  return null;
}

export function coverContentType(file: File): string {
  if (COVER_MIME_TYPES.has(file.type)) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}
