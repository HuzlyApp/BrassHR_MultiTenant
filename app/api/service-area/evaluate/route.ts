import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { resolvePublicTenant } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { evaluateServiceAreaWithDb, toPublicEvaluateResponse } from "@/lib/service-area/db";
import { parseServiceAreaLocation } from "@/lib/service-area/parse-location";
import { SERVICE_AREA_ACTIONS, type ServiceAreaAction } from "@/lib/service-area/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "") as ServiceAreaAction;
  if (!SERVICE_AREA_ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const location = parseServiceAreaLocation(body.location);
  if (!location) {
    return NextResponse.json({ error: "location.locationType is required" }, { status: 400 });
  }

  const publicClient = body.public === true || action === "apply" || action === "signup";
  let tenantId: string | null = typeof body.tenantId === "string" ? body.tenantId.trim() : null;
  let jobId: string | null = typeof body.jobId === "string" ? body.jobId.trim() : null;
  const jobToken = typeof body.jobToken === "string" ? body.jobToken.trim() : "";
  const tenantSlug = typeof body.tenantSlug === "string" ? body.tenantSlug.trim().toLowerCase() : "";

  if (action === "apply" || action === "attach_candidate" || action === "publish_job") {
    if (jobToken && tenantSlug) {
      const tenant = await resolvePublicTenant(supabase, tenantSlug);
      if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
      tenantId = tenant.id;
      const { data: job } = await supabase
        .from("job_requisitions")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("public_job_token", jobToken)
        .maybeSingle();
      jobId = job?.id ? String(job.id) : null;
    } else {
      const auth = await requireStaffApiSession();
      if (auth instanceof NextResponse) return auth;
      tenantId = await resolveStaffTenantId(supabase, auth);
    }
  } else if (action === "signup") {
    tenantId = null;
  } else {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;
    tenantId = await resolveStaffTenantId(supabase, auth);
  }

  if (!tenantId && action !== "signup") {
    return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  }

  const decision = await evaluateServiceAreaWithDb(supabase, {
    tenantId,
    jobId,
    action,
    location,
  });

  if (publicClient) {
    return NextResponse.json(toPublicEvaluateResponse(decision));
  }

  return NextResponse.json({
    allowed: decision.allowed,
    reasonCode: decision.reasonCode,
    messageKey: decision.messageKey,
    layer: decision.layer,
    matchedPolicyId: decision.matchedPolicyId,
  });
}
