import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { loadTenantHiringArea } from "@/lib/service-area/db";
import { normalizeRemoteStates } from "@/lib/service-area/normalize";

export const runtime = "nodejs";

const MODES = ["locations_only", "locations_plus_states", "all_allowed_platform"] as const;

export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const tenantId = await resolveStaffTenantId(supabase, auth);
  if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

  const area = await loadTenantHiringArea(supabase, tenantId);
  return NextResponse.json({
    mode: area.mode,
    extraAllowedStates: area.extraAllowedStates,
    locations: area.locations,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const tenantId = await resolveStaffTenantId(supabase, auth);
  if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const mode = String(body.mode ?? "locations_only");
  if (!MODES.includes(mode as (typeof MODES)[number])) {
    return NextResponse.json({ error: "Invalid hiring area mode" }, { status: 400 });
  }

  const extraAllowedStates = normalizeRemoteStates(
    Array.isArray(body.extraAllowedStates) ? body.extraAllowedStates.map(String) : []
  );

  const { error } = await supabase.from("tenant_hiring_areas").upsert({
    tenant_id: tenantId,
    mode,
    extra_allowed_states: extraAllowedStates,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const area = await loadTenantHiringArea(supabase, tenantId);
  return NextResponse.json({
    mode: area.mode,
    extraAllowedStates: area.extraAllowedStates,
    locations: area.locations,
  });
}
