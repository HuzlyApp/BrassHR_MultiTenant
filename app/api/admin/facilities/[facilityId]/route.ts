import { NextRequest, NextResponse } from "next/server";
import { resolveStaffFacilityTenantContext } from "@/lib/facilities/staff-tenant-access";
import { parseRequiredUuid } from "@/lib/validation/uuid";
import { phoneValidationMessage } from "@/lib/tenant/business-info-validation";

export async function PATCH(req: NextRequest, context: { params: Promise<{ facilityId: string }> }) {
  const resolved = await resolveStaffFacilityTenantContext();
  if ("error" in resolved && resolved.error) return resolved.error;
  const { facilityId } = await context.params;
  if (!parseRequiredUuid(facilityId, "facilityId").ok) return NextResponse.json({ error: "Invalid facility" }, { status: 400 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const patch: { name?: string; phone?: string | null; archived_at?: string | null } = {};
  if (body.action === "archive" || body.action === "restore") patch.archived_at = body.action === "archive" ? new Date().toISOString() : null;
  else if (body.action === "edit") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 200) return NextResponse.json({ error: "Facility name is required and must be 200 characters or fewer." }, { status: 400 });
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const phoneError = phone ? phoneValidationMessage(phone) : null;
    if (phoneError) return NextResponse.json({ error: phoneError }, { status: 400 });
    patch.name = name;
    patch.phone = phone || null;
  } else return NextResponse.json({ error: "Choose edit, archive or restore." }, { status: 400 });
  const { data, error } = await resolved.supabase.from("facility").update(patch)
    .eq("tenant_id", resolved.tenantId).eq("id", facilityId).select("id, name, phone, archived_at").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not update the facility." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Facility not found" }, { status: 404 });
  return NextResponse.json({ facility: data });
}
