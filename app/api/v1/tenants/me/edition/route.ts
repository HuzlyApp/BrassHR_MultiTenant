import { NextResponse } from "next/server";
import { z } from "zod";
import { editionError, requireEditionContext } from "@/lib/tenant/edition-api-context";
import { loadTenantFeatures } from "@/lib/tenant/edition-features";

export const runtime = "nodejs";
const schema = z.object({ edition: z.enum(["smb", "staffing"]) }).strict();

export async function PATCH(request: Request) {
  try {
    const context = await requireEditionContext(request, true);
    if (context instanceof NextResponse) return context;
    const { auth, supabase, tenantId } = context;
    if (!auth.godAdmin && auth.role !== "admin") {
      return NextResponse.json({ error: "Administrator role required", code: "FORBIDDEN" }, { status: 403 });
    }
    const body = schema.safeParse(await request.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "Invalid edition", code: "VALIDATION_ERROR" }, { status: 422 });
    const { error } = await supabase.from("tenant_categories").upsert({
      tenant_id: tenantId,
      category: body.data.edition === "smb" ? "SMB" : "Staffing",
      edition_set_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id" });
    if (error) throw error;
    return NextResponse.json(await loadTenantFeatures(supabase, tenantId));
  } catch (error) { return editionError(error); }
}
