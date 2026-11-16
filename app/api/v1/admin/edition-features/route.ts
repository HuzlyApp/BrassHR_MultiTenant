import { NextResponse } from "next/server";
import { editionError, requireEditionContext } from "@/lib/tenant/edition-api-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await requireEditionContext(request, true);
    if (context instanceof NextResponse) return context;
    const { data, error } = await context.supabase.from("edition_features")
      .select("feature_key, label, description, smb_default, staffing_default").order("feature_key");
    if (error) throw error;
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return editionError(error); }
}
