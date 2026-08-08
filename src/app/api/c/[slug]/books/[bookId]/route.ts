import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isCommunityAdmin, requireApiCommunityAccess } from "@/lib/auth/helpers";
import {
  COVER_BUCKET,
  coverPathFromPublicUrl,
  isCommunityScopedPath,
} from "@/lib/storage/book-upload-paths";
import {
  bookParamsSchema,
  bookPatchSchema,
  internalErrorResponse,
  parseData,
  parseJsonBody,
} from "@/lib/validation";

const BOOK_SELECT =
  "id, community_id, title, author, description, cover_url, pdf_storage_path, total_pages, table_of_contents, is_published, pipeline_version, created_at, updated_at";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; bookId: string }> }
) {
  const paramsResult = parseData(bookParamsSchema, await params);
  if ("error" in paramsResult) return paramsResult.error;
  const { slug, bookId } = paramsResult.data;

  const access = await requireApiCommunityAccess(slug);
  if (access instanceof NextResponse) return access;
  const { user, community } = access;

  const supabase = await createClient();

  const { data: book, error } = await supabase
    .from("books")
    .select("*")
    .eq("id", bookId)
    .eq("community_id", community.id)
    .single();

  if (error || !book) {
    return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
  }

  const { data: userProgress } = await supabase
    .from("reading_progress")
    .select("current_page, progress_percent")
    .eq("book_id", bookId)
    .eq("user_id", user.id)
    .maybeSingle();

  // Never return a public storage URL — clients must call .../pdf for a signed link.
  return NextResponse.json({
    book,
    initialPage: userProgress?.current_page ?? 0,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; bookId: string }> }
) {
  try {
    const paramsResult = parseData(bookParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const { slug, bookId } = paramsResult.data;

    const access = await requireApiCommunityAccess(slug);
    if (access instanceof NextResponse) return access;
    const { user, community } = access;

    const admin = await isCommunityAdmin(
      community.id,
      user.id,
      user.is_super_admin
    );
    if (!admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const bodyResult = await parseJsonBody(request, bookPatchSchema);
    if ("error" in bodyResult) return bodyResult.error;
    const { is_published, title, author, description, coverStoragePath } =
      bodyResult.data;

    const supabase = await createClient();
    const { data: existing, error: fetchError } = await supabase
      .from("books")
      .select("id, cover_url")
      .eq("id", bookId)
      .eq("community_id", community.id)
      .maybeSingle();

    if (fetchError) {
      return internalErrorResponse("Error al buscar libro:", fetchError);
    }
    if (!existing) {
      return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
    }

    const updates: {
      is_published?: boolean;
      title?: string;
      author?: string | null;
      description?: string | null;
      cover_url?: string;
    } = {};

    if (is_published !== undefined) updates.is_published = is_published;
    if (title !== undefined) updates.title = title;
    if (author !== undefined) updates.author = author;
    if (description !== undefined) updates.description = description;

    let previousCoverPath: string | null = null;
    const previousCoverUrl: string | null = existing.cover_url;

    if (coverStoragePath) {
      if (!isCommunityScopedPath(community.id, coverStoragePath)) {
        return NextResponse.json(
          { error: "Ruta de portada inválida" },
          { status: 400 }
        );
      }

      const serviceClient = await createServiceClient();
      const { error: coverStatError } = await serviceClient.storage
        .from(COVER_BUCKET)
        .download(coverStoragePath);
      if (coverStatError) {
        return NextResponse.json(
          { error: "No se encontró la portada subida. Volvé a intentar." },
          { status: 400 }
        );
      }

      const { data: publicData } = serviceClient.storage
        .from(COVER_BUCKET)
        .getPublicUrl(coverStoragePath);
      if (!publicData?.publicUrl) {
        return NextResponse.json(
          { error: "No se pudo armar la URL de la portada." },
          { status: 500 }
        );
      }

      const { data: coverInUse, error: coverInUseError } = await supabase
        .from("books")
        .select("id")
        .eq("community_id", community.id)
        .neq("id", bookId)
        .eq("cover_url", publicData.publicUrl)
        .limit(1);
      if (coverInUseError) {
        return internalErrorResponse(
          "Error al validar portada en uso:",
          coverInUseError
        );
      }
      if (coverInUse && coverInUse.length > 0) {
        return NextResponse.json(
          { error: "Esa portada ya está en uso por otro libro." },
          { status: 409 }
        );
      }

      updates.cover_url = publicData.publicUrl;
      previousCoverPath = coverPathFromPublicUrl(existing.cover_url);
    }

    // Never touch content_json / pipeline — publish + metadata + cover only.
    const { data: book, error } = await supabase
      .from("books")
      .update(updates)
      .eq("id", bookId)
      .eq("community_id", community.id)
      .select(BOOK_SELECT)
      .maybeSingle();

    if (error) {
      return internalErrorResponse("Error al actualizar libro:", error);
    }
    if (!book) {
      return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
    }

    if (
      previousCoverPath &&
      coverStoragePath &&
      previousCoverPath !== coverStoragePath &&
      isCommunityScopedPath(community.id, previousCoverPath) &&
      previousCoverUrl
    ) {
      const { data: stillUsed, error: stillUsedError } = await supabase
        .from("books")
        .select("id")
        .eq("community_id", community.id)
        .eq("cover_url", previousCoverUrl)
        .limit(1);
      if (stillUsedError) {
        console.error("Old cover reuse check failed:", stillUsedError);
      } else if (!stillUsed || stillUsed.length === 0) {
        try {
          const serviceClient = await createServiceClient();
          const { error: removeError } = await serviceClient.storage
            .from(COVER_BUCKET)
            .remove([previousCoverPath]);
          if (removeError) {
            console.error("Old cover cleanup failed:", removeError);
          }
        } catch (cleanupErr) {
          console.error("Old cover cleanup failed:", cleanupErr);
        }
      }
    }

    return NextResponse.json({ book });
  } catch (err) {
    return internalErrorResponse(
      "PATCH /api/c/[slug]/books/[bookId] failed:",
      err
    );
  }
}
