import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { loadTenantFeatures, EditionFeatureError } from "@/lib/tenant/edition-features";
import { SchedulingError } from "./v1-contract";

export function schedulingError(error: unknown) {
  if (error instanceof SchedulingError || error instanceof EditionFeatureError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  const code = (error as { code?: string } | null)?.code;
  if (["23503", "23514", "23505", "P0002"].includes(code ?? "")) {
    const status = code === "23505" ? 409 : code === "P0002" ? 404 : 422;
    return NextResponse.json({ error: status === 409 ? "Record already exists" : status === 404 ? "Shift not found" : "Invalid schedule reference, dates or assignment",
      code: status === 409 ? "CONFLICT" : status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR" }, { status });
  }
  console.error("[v1/scheduling]", error);
  return NextResponse.json({ error: "Schedule data unavailable", code: "DATA_UNAVAILABLE" }, { status: 503 });
}

export function invalidSchedule() {
  return NextResponse.json({ error: "Invalid scheduling input", code: "VALIDATION_ERROR" }, { status: 422 });
}

export async function requireSchedulingContext(request: Request, checkSchedulingFeature = true) {
  const auth = await requireStaffApiSession(request);
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) throw new SchedulingError("Supabase not configured", "DATA_UNAVAILABLE", 503);
  const tenantId = await resolveStaffTenantId(supabase, auth);
  if (!tenantId) throw new SchedulingError("No authorized tenant selected", "TENANT_REQUIRED", 403);
  const resolved = await loadTenantFeatures(supabase, tenantId);
  if (checkSchedulingFeature && !resolved.features.internal_scheduling && !resolved.features.manage_clients) {
    throw new SchedulingError("Scheduling is disabled for this tenant", "FEATURE_DISABLED", 403);
  }
  return { auth, supabase, tenantId, ...resolved };
}
