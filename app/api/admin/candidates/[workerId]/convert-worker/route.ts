import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isCandidateAlreadyConverted,
  normalizeCandidateStatus,
  parseConvertWorkerType,
  type ConvertWorkerType,
} from "@/lib/admin/convert-candidate-to-worker";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import {
  convertCandidateByDisposition,
  resolveConversionOutcome,
} from "@/lib/job-requisitions/convert-disposition";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ workerId: string }> };

/** @deprecated Prefer convertCandidateByDisposition — kept for internal W2/1099 callers. */
export async function convertCandidateToWorker(
  supabase: SupabaseClient,
  candidateId: string,
  workerType: ConvertWorkerType,
  actorUserId?: string | null
) {
  const result = await convertCandidateByDisposition(supabase, candidateId, {
    workerType,
    actorUserId,
  });

  if (!result.ok) {
    return { ok: false as const, error: result.error, status: result.status };
  }

  if (!result.workerRecordId && result.outcome === "hired_by_client") {
    return {
      ok: false as const,
      error:
        "This candidate's job is Recruit and Release. Use hired-by-client disposition instead of payroll worker conversion.",
      status: 400,
    };
  }

  if (!result.workerRecordId) {
    return { ok: false as const, error: "Failed to create worker record", status: 500 };
  }

  return {
    ok: true as const,
    workerRecordId: result.workerRecordId,
    candidateId: result.candidateId,
    workerType,
    created: result.created,
    profilePath: result.profilePath ?? `/admin_recruiter/workers/${candidateId}/profile`,
    outcome: result.outcome,
    placementId: result.placementId,
    filledPositions: result.filledPositions,
    remainingPositions: result.remainingPositions,
  };
}

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
      disposition?: string;
      clientName?: string;
      notes?: string;
      hireDate?: string;
    };

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const { data: candidateAccess, error: accessErr } = await supabase
      .from("worker")
      .select(
        "id, user_id, tenant_id, status, converted_worker_type, job_requisition_id, final_disposition"
      )
      .eq("id", idCheck.value)
      .maybeSingle();

    if (accessErr) throw accessErr;
    if (!candidateAccess?.id) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }
    if (
      isCandidateAlreadyConverted(candidateAccess) ||
      normalizeCandidateStatus(candidateAccess.status) === "hired_by_client"
    ) {
      // Idempotent re-read
      const existing = await convertCandidateByDisposition(supabase, idCheck.value, {
        actorUserId: auth.userId,
      });
      if (existing.ok && !existing.created) {
        return NextResponse.json({
          ok: true,
          ...existing,
          deduplicated: true,
        });
      }
      return NextResponse.json(
        { error: "This candidate has already been converted or hired by client." },
        { status: 409 }
      );
    }
    if (
      !canAccessWorkerRecord(auth, {
        id: String(candidateAccess.id),
        user_id: candidateAccess.user_id,
      })
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Resolve job placement to decide outcome when disposition not explicit
    let placementType: string | null = null;
    if (candidateAccess.job_requisition_id) {
      const { data: job } = await supabase
        .from("job_requisitions")
        .select("placement_type, employment_type")
        .eq("id", candidateAccess.job_requisition_id)
        .maybeSingle();
      placementType = job?.placement_type ?? null;
    }

    const outcomeHint =
      body.disposition === "hired_by_client"
        ? "hired_by_client"
        : resolveConversionOutcome(placementType);

    let workerType = parseConvertWorkerType(body.workerType);
    if (!workerType && outcomeHint !== "hired_by_client") {
      // Infer from job employment type when possible
      if (candidateAccess.job_requisition_id) {
        const { data: job } = await supabase
          .from("job_requisitions")
          .select("employment_type")
          .eq("id", candidateAccess.job_requisition_id)
          .maybeSingle();
        if (job?.employment_type === "1099") workerType = "1099";
        else workerType = "w2";
      } else {
        return NextResponse.json(
          { error: "Invalid workerType. Expected w2 or 1099." },
          { status: 400 }
        );
      }
    }

    const result = await convertCandidateByDisposition(supabase, idCheck.value, {
      workerType,
      actorUserId: auth.userId,
      clientName: body.clientName,
      notes: body.notes,
      hireDate: body.hireDate,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    void writeActivityLog({
      actorUserId: auth.userId,
      action:
        result.outcome === "hired_by_client"
          ? "candidate_hired_by_client"
          : "candidate_converted_to_worker",
      entityType: result.outcome === "hired_by_client" ? "client_hire_placements" : "workers",
      entityId: result.placementId ?? result.workerRecordId,
      tenantId:
        candidateAccess.tenant_id != null ? String(candidateAccess.tenant_id) : null,
      metadata: {
        candidate_id: result.candidateId,
        outcome: result.outcome,
        worker_type: workerType,
        created: result.created,
        filled_positions: result.filledPositions,
      },
      request: req,
    });

    return NextResponse.json({
      ok: true,
      outcome: result.outcome,
      workerRecordId: result.workerRecordId,
      placementId: result.placementId,
      candidateId: result.candidateId,
      workerType: workerType,
      created: result.created,
      profilePath: result.profilePath,
      filledPositions: result.filledPositions,
      remainingPositions: result.remainingPositions,
    });
  } catch (err: unknown) {
    console.error("[admin/candidates/convert-worker]", err);
    const message = err instanceof Error ? err.message : "Failed to convert candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
