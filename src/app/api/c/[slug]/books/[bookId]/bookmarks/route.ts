import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/helpers";
import {
  bookParamsSchema,
  bookmarkSchema,
  internalErrorResponse,
  parseData,
  parseJsonBody,
} from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; bookId: string }> }
) {
  const paramsResult = parseData(bookParamsSchema, await params);
  if ("error" in paramsResult) return paramsResult.error;
  const { bookId } = paramsResult.data;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const bodyResult = await parseJsonBody(request, bookmarkSchema);
  if ("error" in bodyResult) return bodyResult.error;
  const { pageNumber, label } = bodyResult.data;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reading_bookmarks")
    .insert({
      user_id: user.id,
      book_id: bookId,
      page_number: pageNumber,
      label: label || `Página ${pageNumber + 1}`,
    })
    .select()
    .single();

  if (error) return internalErrorResponse("Error al crear marcador:", error);
  return NextResponse.json({ bookmark: data });
}
