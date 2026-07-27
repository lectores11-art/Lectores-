import { NextResponse } from "next/server";

export const VALIDATION_ERROR_MESSAGE = "Datos inválidos";
export const INTERNAL_ERROR_MESSAGE = "Error interno";

export function validationErrorResponse() {
  return NextResponse.json({ error: VALIDATION_ERROR_MESSAGE }, { status: 400 });
}

export function internalErrorResponse(context: string, error: unknown) {
  console.error(context, error);
  return NextResponse.json({ error: INTERNAL_ERROR_MESSAGE }, { status: 500 });
}
