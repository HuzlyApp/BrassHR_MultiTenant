import { NextResponse } from "next/server";
import { editionError, requireEditionContext } from "@/lib/tenant/edition-api-context";
import { loadTenantFeatures } from "@/lib/tenant/edition-features";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await requireEditionContext(request);
    if (context instanceof NextResponse) return context;
    return NextResponse.json(await loadTenantFeatures(context.supabase, context.tenantId), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) { return editionError(error); }
}
