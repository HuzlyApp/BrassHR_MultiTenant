import { NextRequest, NextResponse } from "next/server";
import {
  isCandidateAlreadyConverted,
  parseConvertWorkerType,
} from "@/lib/admin/convert-candidate-to-worker";
import { convertCandidateToWorker } from "@/lib/admin/convert-candidate-to-worker.server";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { resolveApplicantEmailAppOrigin } from "@/lib/resolve-app-origin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ workerId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const { workerId: rawWorkerId } = await context.params;
    const idCheck = parseRequiredUuid(rawWorkerId?.trim() ?? "", "workerId");
    if (!idCheck.ok) {
      return NextResponse.json({ error: idCheck.error }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      workerType?: string;
      sourceJobApplicationId?: string | null;
    };
    const workerType = parseConvertWorkerType(body.workerType);
    if (!workerType) {
      return NextResponse.json(
        { error: "Invalid workerType. Expected w2 or 1099." },
        { status: 400 }
      );
    }

    const sourceJobApplicationId =
      typeof body.sourceJobApplicationId === "string" && body.sourceJobApplicationId.trim()
        ? body.sourceJobApplicationId.trim()
        : null;

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const tenantId = await resolveStaffTenantId(supabase, auth).catch(() => null);
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
    }

    const { data: candidateAccess, error: accessErr } = await supabase
      .from("worker")
      .select("id, user_id, tenant_id, status, converted_worker_type")
      .eq("id", idCheck.value)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (accessErr) throw accessErr;
    if (!candidateAccess?.id) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }
    if (!canAccessWorkerRecord(auth, { id: String(candidateAccess.id), user_id: candidateAccess.user_id })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Already fully converted: return existing employment worker idempotently.
    if (isCandidateAlreadyConverted(candidateAccess)) {
      const { data: existing } = await supabase
        .from("workers")
        .select("id, worker_type")
        .eq("candidate_id", idCheck.value)
        .maybeSingle();
      if (existing?.id) {
        return NextResponse.json({
          ok: true,
          workerRecordId: String(existing.id),
          candidateId: idCheck.value,
          workerType: existing.worker_type ?? workerType,
          created: false,
          profilePath: `/admin_recruiter/workers/${idCheck.value}/profile`,
          postHire: null,
        });
      }
    }

    const origin = resolveApplicantEmailAppOrigin(req);
    const result = await convertCandidateToWorker(supabase, {
      candidateId: idCheck.value,
      workerType,
      actorUserId: auth.devBypass ? null : auth.userId,
      origin,
      sourceJobApplicationId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code ?? null },
        { status: result.status }
      );
    }

    void writeActivityLog({
      actorUserId: auth.devBypass ? null : auth.userId,
      action: "candidate_converted_to_worker",
      entityType: "workers",
      entityId: result.workerRecordId,
      tenantId,
      metadata: {
        candidate_id: result.candidateId,
        worker_type: result.workerType,
        created: result.created,
        source_job_application_id: result.sourceJobApplicationId,
        post_hire_activated: result.postHire.activated,
        post_hire_warning: result.postHire.warning,
      },
      request: req,
    });

    return NextResponse.json({
      ok: true,
      workerRecordId: result.workerRecordId,
      candidateId: result.candidateId,
      workerType: result.workerType,
      created: result.created,
      profilePath: result.profilePath,
      sourceJobApplicationId: result.sourceJobApplicationId,
      postHire: result.postHire,
      message:
        "Worker created successfully. This person has been moved from Candidates to Workforce.",
    });
  } catch (err: unknown) {
    console.error("[admin/candidates/convert-worker]", err);
    const message = err instanceof Error ? err.message : "Failed to convert candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
