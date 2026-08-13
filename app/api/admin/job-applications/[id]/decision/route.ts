import { NextRequest, NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import {
  isRecruiterDecision,
  RECRUITER_DECISIONS,
} from "@/lib/jobs/match-analysis/workspace";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const tenantId = await resolveStaffTenantId(supabase, auth).catch(() => null);
  if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

  const { id } = await context.params;
  if (!id?.trim()) return NextResponse.json({ error: "Application id required" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { decision?: string; note?: string };
  const decision = String(body.decision ?? "").trim();
  if (!isRecruiterDecision(decision)) {
    return NextResponse.json(
      { error: `Invalid decision. Expected one of: ${RECRUITER_DECISIONS.join(", ")}` },
      { status: 400 }
    );
  }

  const { data: application, error: appError } = await supabase
    .from("job_applications")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (appError) return NextResponse.json({ error: appError.message }, { status: 500 });
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const recordedAt = new Date().toISOString();
  const note = typeof body.note === "string" ? body.note.trim() || null : null;
  const recordedBy = auth.devBypass ? null : auth.userId;

  const { error: insertError } = await supabase.from("job_application_decisions").insert({
    tenant_id: tenantId,
    application_id: id,
    decision,
    note,
    recorded_by: recordedBy,
    recorded_at: recordedAt,
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const { error: updateError } = await supabase
    .from("job_applications")
    .update({
      recruiter_decision: decision,
      recruiter_decision_note: note,
      recruiter_decision_at: recordedAt,
      recruiter_decision_by: recordedBy,
      updated_at: recordedAt,
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  void writeActivityLog({
    actorUserId: recordedBy,
    action: "job_application.decision_recorded",
    entityType: "job_application",
    entityId: id,
    tenantId,
    request: req,
    metadata: { decision },
  });

  return NextResponse.json({ ok: true, decision, recordedAt });
}
