import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import {
  createEmployeeScheduleShift,
  loadEmployeeScheduleWeek,
} from "@/lib/scheduling/employee-schedule-service";
import type { CreateEmployeeScheduleShiftInput } from "@/lib/scheduling/employee-schedule";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParam(value: string | null, label: string): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return { ok: false, error: `Missing ${label}` };
  if (!DATE_RE.test(trimmed)) return { ok: false, error: `Invalid ${label}` };
  return { ok: true, value: trimmed };
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function emptyWeek(start: string, end: string) {
  return {
    employees: [],
    shifts: [],
    meta: { tenantId: "", start, end, total: 0 },
  };
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
      return NextResponse.json(emptyWeek(startCheck.value, endCheck.value));
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Service unavailable. Please try again later." }, { status: 503 });
    }

    const data = await loadEmployeeScheduleWeek(
      supabase,
      scope.tenantId,
      startCheck.value,
      endCheck.value,
      req.nextUrl.searchParams.get("facilityId")
    );

    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin/scheduling/week GET]", err);
    return NextResponse.json({ error: "Failed to load the schedule." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const scope = await resolveStaffTenantScope(auth.authUser);
    if (scope.mode !== "scoped") {
      return NextResponse.json({ error: "Select a tenant before creating a shift." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
    }

    const body = (await req.json()) as CreateEmployeeScheduleShiftInput;
    const shift = await createEmployeeScheduleShift(supabase, scope.tenantId, body);
    return NextResponse.json({ shift }, { status: 201 });
  } catch (err) {
    console.error("[admin/scheduling/week POST]", err);
    const message = errorMessage(err, "Failed to create shift.");
    const status = /required|must be|select an employee|does not belong|invalid/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: status === 400 ? message : "Failed to create shift." }, { status });
  }
}
