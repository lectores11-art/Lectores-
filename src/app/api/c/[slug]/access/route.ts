import { NextResponse } from "next/server";
import {
  getCommunityContext,
  hasActiveCommunityAccess,
  shouldSeePaywall,
} from "@/lib/auth/helpers";
import { internalErrorResponse, parseData, slugParamsSchema } from "@/lib/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const paramsResult = parseData(slugParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const { slug } = paramsResult.data;

    const { user, community, membership } = await getCommunityContext(slug);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!community) {
      return NextResponse.json({ error: "Comunidad no encontrada" }, { status: 404 });
    }

    if (hasActiveCommunityAccess(user, community, membership)) {
      return NextResponse.json({ access: "active" });
    }
    if (shouldSeePaywall(user, community, membership)) {
      return NextResponse.json({ access: "paywall" });
    }
    return NextResponse.json({ access: "none" });
  } catch (err) {
    return internalErrorResponse("GET /api/c/[slug]/access failed:", err);
  }
}
