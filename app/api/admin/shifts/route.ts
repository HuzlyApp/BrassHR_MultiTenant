import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { createTenantShift, type CreateShiftInput } from "@/lib/shifts/shift-management-service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const scope = await resolveStaffTenantScope(auth.authUser);
    if (scope.mode !== "scoped") {
      return NextResponse.json({ error: "Tenant required." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
    }

    const facilityId = req.nextUrl.searchParams.get("facilityId");
    let query = supabase
      .from("shifts")
      .select("id, tenant_id, client_id, facility_id, title, description, start_date, end_date, rate_per_hour, posted_at, created_at")
      .eq("tenant_id", scope.tenantId)
      .order("start_date", { ascending: false })
      .limit(200);

    if (facilityId) {
      query = query.eq("facility_id", facilityId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ shifts: data ?? [] });
  } catch (err) {
    console.error("[admin/shifts GET]", err);
    return NextResponse.json({ error: "Failed to load shifts." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const scope = await resolveStaffTenantScope(auth.authUser);
    if (scope.mode !== "scoped") {
      return NextResponse.json({ error: "Tenant required." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
    }

    const body = (await req.json()) as CreateShiftInput;
    if (!body?.title?.trim()) {
      return NextResponse.json({ error: "Shift title / role is required." }, { status: 400 });
    }
    if (!body?.startDate) {
      return NextResponse.json({ error: "Start date is required." }, { status: 400 });
    }

    const result = await createTenantShift(supabase, scope.tenantId, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[admin/shifts POST]", err);
    const message = err instanceof Error ? err.message : "Failed to create shift.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

