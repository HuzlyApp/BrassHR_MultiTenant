import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export async function PATCH(req: NextRequest, context: { params: Promise<{ workerId: string }> }) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const db = createServiceRoleClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  const tenantId = await resolveStaffTenantId(db, auth);
  if (!tenantId) return NextResponse.json({ error: "Select a company first." }, { status: 400 });
  const { workerId } = await context.params;
  if (!parseRequiredUuid(workerId, "workerId").ok) return NextResponse.json({ error: "Invalid worker" }, { status: 400 });
  const body = await req.json().catch(() => null);
  if (body?.action !== "archive" && body?.action !== "restore") return NextResponse.json({ error: "Choose archive or restore." }, { status: 400 });
  // Never delete the employment record or change its onboarding/employment status.
  const { data, error } = await db.from("workers").update({ archived_at: body.action === "archive" ? new Date().toISOString() : null })
    .eq("tenant_id", tenantId).eq("id", workerId).select("id, archived_at").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not update the worker archive." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  return NextResponse.json({ worker: data });
}
