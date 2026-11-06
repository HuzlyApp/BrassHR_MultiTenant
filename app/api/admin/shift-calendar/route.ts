import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { loadShiftCalendarForTenant } from "@/lib/shifts/shift-calendar-service";
import { createTenantShift, type CreateShiftInput } from "@/lib/shifts/shift-management-service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParam(value: string | null, label: string): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return { ok: false, error: `Missing ${label}` };
  if (!DATE_RE.test(trimmed)) return { ok: false, error: `Invalid ${label}` };
  return { ok: true, value: trimmed };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const startCheck = parseDateParam(req.nextUrl.searchParams.get("start"), "start");
    if (!startCheck.ok) {
      return NextResponse.json({ error: startCheck.error }, { status: 400 });
    }

    const endCheck = parseDateParam(req.nextUrl.searchParams.get("end"), "end");
    if (!endCheck.ok) {
      return NextResponse.json({ error: endCheck.error }, { status: 400 });
    }

    if (startCheck.value > endCheck.value) {
      return NextResponse.json({ error: "Start date must be on or before end date." }, { status: 400 });
    }

    const scope = await resolveStaffTenantScope(auth.authUser);
    if (scope.mode !== "scoped") {
      return NextResponse.json({
        events: [],
        filterOptions: { workers: [], jobRoles: [], facilities: [], statuses: [] },
        meta: { tenantId: "", start: startCheck.value, end: endCheck.value, total: 0 },
      });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Service unavailable. Please try again later." }, { status: 503 });
    }

    const data = await loadShiftCalendarForTenant(
      supabase,
      scope.tenantId,
      startCheck.value,
      endCheck.value
    );

    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin/shift-calendar GET]", err);
    return NextResponse.json({ error: "Failed to load shift calendar." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const scope = await resolveStaffTenantScope(auth.authUser);
    if (scope.mode !== "scoped") {
      return NextResponse.json(
        { error: "Select a tenant before creating a shift." },
        { status: 400 }
      );
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
    console.error("[admin/shift-calendar POST]", err);
    const message = err instanceof Error ? err.message : "Failed to create shift.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
