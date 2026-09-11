import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isCommunityAdmin, requireApiCommunityAccess } from "@/lib/auth/helpers";
import {
  bookParamsSchema,
  internalErrorResponse,
  parseData,
} from "@/lib/validation";
import { canOpenBookPdf, type LegalCategory } from "@/lib/legal/pdf-access";

/** Short-lived signed URL for the original PDF. Never use public bucket URLs. */
const SIGNED_URL_EXPIRES_SEC = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; bookId: string }> }
) {
  try {
    const paramsResult = parseData(bookParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const { slug, bookId } = paramsResult.data;

    const access = await requireApiCommunityAccess(slug);
    if (access instanceof NextResponse) return access;
    const { user, community } = access;

    const supabase = await createClient();
    const { data: book, error } = await supabase
      .from("books")
      .select(
        "id, community_id, pdf_storage_path, title, legal_category, license_territories, is_hidden"
      )
      .eq("id", bookId)
      .eq("community_id", community.id)
      .single();

    if (error || !book) {
      return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
    }

    const path = book.pdf_storage_path;
    if (!path) {
      return NextResponse.json({ error: "PDF no disponible" }, { status: 404 });
    }

    const admin = await isCommunityAdmin(
      community.id,
      user.id,
      user.is_super_admin
    );
    const pdfAccess = canOpenBookPdf({
      hasPdf: true,
      isHidden: Boolean(book.is_hidden),
      category: (book.legal_category as LegalCategory | null) ?? null,
      territories: book.license_territories,
      residenceCountry: user.residence_country,
    });
    if (!admin && !pdfAccess.ok) {
      return NextResponse.json(
        { error: "Este PDF no está autorizado para tu país de residencia." },
        { status: 403 }
      );
    }

    // Defense-in-depth: object must live under this community's folder.
    const prefix = `${community.id}/`;
    if (!path.startsWith(prefix) || path.includes("..")) {
      return NextResponse.json({ error: "Ruta de PDF inválida" }, { status: 400 });
    }

    // service_role after membership + community_id checks — mint short-lived URL
    // without relying on the caller talking to Storage directly.
    const serviceClient = await createServiceClient();
    const { data: signed, error: signError } = await serviceClient.storage
      .from("books")
      .createSignedUrl(path, SIGNED_URL_EXPIRES_SEC);

    if (signError || !signed?.signedUrl) {
      return internalErrorResponse("Error al firmar URL del PDF:", signError);
    }

    return NextResponse.json({
      url: signed.signedUrl,
      expiresIn: SIGNED_URL_EXPIRES_SEC,
      title: book.title,
    });
  } catch (err) {
    return internalErrorResponse("GET /api/c/[slug]/books/[bookId]/pdf failed:", err);
  }
}
