import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_PDF_BYTES } from "./schemas";
import { validationErrorResponse } from "./errors";

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

export function validatePdfFile(file: File | null): NextResponse | null {
  if (!file) {
    return validationErrorResponse();
  }
  if (file.type !== "application/pdf") {
    return validationErrorResponse();
  }
  if (file.size <= 0 || file.size > MAX_PDF_BYTES) {
    return validationErrorResponse();
  }
  return null;
}
