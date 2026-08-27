import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import { loadCandidateWorkflowStepInspection } from "@/lib/onboarding/candidate-workflow-step-inspection";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ workerId: string; stepId: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
    }

    const { workerId: workerIdRaw, stepId: stepIdRaw } = await context.params;
    const workerCheck = parseRequiredUuid(workerIdRaw, "workerId");
    const stepCheck = parseRequiredUuid(stepIdRaw, "stepId");
    if (!workerCheck.ok) {
      return NextResponse.json({ error: workerCheck.error }, { status: 400 });
    }
    if (!stepCheck.ok) {
      return NextResponse.json({ error: stepCheck.error }, { status: 400 });
    }

    const { data: worker, error: workerError } = await supabase
      .from("worker")
      .select("id, user_id")
      .eq("id", workerCheck.value)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (workerError) throw workerError;
    if (!worker) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }
    if (!canAccessWorkerRecord(auth, { id: String(worker.id), user_id: worker.user_id })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await loadCandidateWorkflowStepInspection(supabase, {
      workerId: workerCheck.value,
      tenantId,
      stepId: stepCheck.value,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code ?? null },
        { status: result.status }
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load workflow step inspection",
      },
      { status: 500 }
    );
  }
}
