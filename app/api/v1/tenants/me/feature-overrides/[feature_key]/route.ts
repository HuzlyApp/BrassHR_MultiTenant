import { NextResponse } from "next/server";
import { z } from "zod";
import { editionError, requireEditionContext } from "@/lib/tenant/edition-api-context";

export const runtime = "nodejs";
const schema = z.object({ enabled: z.boolean(), notes: z.string().max(2000).optional() }).strict();

export async function PUT(request: Request, route: { params: Promise<{ feature_key: string }> }) {
  try {
    const context = await requireEditionContext(request, true);
    if (context instanceof NextResponse) return context;
    const { feature_key: featureKey } = await route.params;
    const body = schema.safeParse(await request.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "Invalid override", code: "VALIDATION_ERROR" }, { status: 422 });
    const { data: feature, error: catalogError } = await context.supabase.from("edition_features")
      .select("feature_key").eq("feature_key", featureKey).maybeSingle();
    if (catalogError) throw catalogError;
    if (!feature) return NextResponse.json({ error: "Unknown feature", code: "FEATURE_NOT_FOUND" }, { status: 404 });
    const { data, error } = await context.supabase.from("tenant_feature_overrides").upsert({
      tenant_id: context.tenantId, feature_key: featureKey, enabled: body.data.enabled,
      notes: body.data.notes ?? null, updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,feature_key" }).select("feature_key, enabled, notes")
      .eq("tenant_id", context.tenantId).single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) { return editionError(error); }
}
