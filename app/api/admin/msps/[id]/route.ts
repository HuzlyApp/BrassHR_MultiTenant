import { NextRequest, NextResponse } from "next/server";
import { requireGodAdminApiSession } from "@/lib/auth/require-god-admin-api";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireGodAdminApiSession();
  if (auth instanceof NextResponse) return auth;

  const { id: rawId } = await context.params;
  const idCheck = parseRequiredUuid(rawId?.trim() ?? "", "mspId");
  if (!idCheck.ok) {
    return NextResponse.json({ error: idCheck.error }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ error: "MSP name is required" }, { status: 400 });
    }
    patch.name = name;
  }
  if (body.code !== undefined) {
    patch.code = typeof body.code === "string" ? body.code.trim() || null : null;
  }
  if (body.notes !== undefined) {
    patch.notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  }
  if (body.isActive !== undefined) {
    patch.is_active = body.isActive === true;
  }

  const { data, error } = await supabase
    .from("msps")
    .update(patch)
    .eq("id", idCheck.value)
    .select("id, name, code, is_active, notes, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (Array.isArray(body.tenantIds)) {
    const tenantIds = body.tenantIds.filter((t): t is string => typeof t === "string");
    await supabase.from("msp_tenant_associations").delete().eq("msp_id", idCheck.value);
    if (tenantIds.length) {
      await supabase.from("msp_tenant_associations").upsert(
        tenantIds.map((tenant_id) => ({
          msp_id: idCheck.value,
          tenant_id,
          is_active: true,
        }))
      );
    }
  }

  void writeActivityLog({
    actorUserId: auth.userId,
    action: "msp_updated",
    entityType: "msps",
    entityId: idCheck.value,
    metadata: { is_active: data.is_active },
    request: req,
  });

  return NextResponse.json({ msp: data });
}
