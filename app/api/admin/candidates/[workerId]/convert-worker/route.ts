import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildEmploymentWorkerRow,
  isCandidateAlreadyConverted,
  normalizeCandidateStatus,
  parseConvertWorkerType,
  type CandidateConversionSnapshot,
  type ConvertWorkerType,
} from "@/lib/admin/convert-candidate-to-worker";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import { evaluateConversionReadiness } from "@/lib/job-requisitions/evaluate-conversion-readiness";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ workerId: string }> };

type ConvertResult =
  | {
      ok: true;
      workerRecordId: string;
      candidateId: string;
      workerType: ConvertWorkerType;
      created: boolean;
      profilePath: string;
    }
  | { ok: false; error: string; status: number };

async function loadCandidate(
  supabase: SupabaseClient,
  candidateId: string
): Promise<CandidateConversionSnapshot | null> {
  const { data, error } = await supabase
    .from("worker")
    .select(
      "id, tenant_id, first_name, last_name, email, phone, job_role, city, state, status, converted_worker_type, converted_at"
    )
    .eq("id", candidateId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id || !data.tenant_id) return null;

  return {
    id: String(data.id),
    tenant_id: String(data.tenant_id),
    first_name: data.first_name ?? null,
    last_name: data.last_name ?? null,
    email: data.email ?? null,
    phone: data.phone ?? null,
    job_role: data.job_role ?? null,
    city: data.city ?? null,
    state: data.state ?? null,
    status: data.status ?? null,
    converted_worker_type: data.converted_worker_type ?? null,
    converted_at: data.converted_at ?? null,
  };
}

export async function convertCandidateToWorker(
  supabase: SupabaseClient,
  candidateId: string,
  workerType: ConvertWorkerType,
  actorUserId?: string | null
): Promise<ConvertResult> {
  const candidate = await loadCandidate(supabase, candidateId);
  if (!candidate) {
    return { ok: false, error: "Candidate not found", status: 404 };
  }

  if (isCandidateAlreadyConverted(candidate)) {
    return {
      ok: false,
      error: "This candidate has already been converted.",
      status: 409,
    };
  }

  const readiness = await evaluateConversionReadiness(supabase, candidateId);
  if (!readiness.ready) {
    return {
      ok: false,
      error: readiness.reason ?? "Candidate is not ready for conversion.",
      status: 400,
    };
  }

  const candidateStatus = normalizeCandidateStatus(candidate.status);
  if (candidateStatus !== "approved") {
    return {
      ok: false,
      error: "Only approved candidates can be converted to workers.",
      status: 400,
    };
  }

  const { data: existing, error: existingErr } = await supabase
    .from("workers")
    .select("id")
    .eq("candidate_id", candidateId)
    .maybeSingle();

  if (existingErr) throw existingErr;
  if (existing?.id) {
    return {
      ok: false,
      error: "This candidate has already been converted.",
      status: 409,
    };
  }

  const convertedAt = new Date().toISOString();
  const employmentRow = buildEmploymentWorkerRow(candidate, workerType, convertedAt);

  const { data: inserted, error: insertErr } = await supabase
    .from("workers")
    .insert(employmentRow)
    .select("id")
    .maybeSingle();

  if (insertErr) throw insertErr;
  if (!inserted?.id) {
    return { ok: false, error: "Failed to create worker record", status: 500 };
  }

  const workerRecordId = String(inserted.id);

  const { error: candidateUpdateErr } = await supabase
    .from("worker")
    .update({
      status: "converted",
      converted_worker_type: workerType,
      converted_at: convertedAt,
      converted_worker_id: workerRecordId,
      converted_by: actorUserId ?? null,
      conversion_status: "completed",
      updated_at: convertedAt,
    })
    .eq("id", candidateId);

  if (candidateUpdateErr) throw candidateUpdateErr;

  const { data: workerRow } = await supabase
    .from("worker")
    .select("applicant_workflow_instance_id")
    .eq("id", candidateId)
    .maybeSingle();

  if (workerRow?.applicant_workflow_instance_id) {
    await supabase
      .from("applicant_workflow_instances")
      .update({
        conversion_status: "completed",
        converted_worker_id: workerRecordId,
        converted_at: convertedAt,
        converted_by: actorUserId ?? null,
        worker_type: workerType,
        updated_at: convertedAt,
      })
      .eq("id", workerRow.applicant_workflow_instance_id);
  }

  return {
    ok: true,
    workerRecordId,
    candidateId,
    workerType,
    created: true,
    profilePath: `/admin_recruiter/workers/${candidateId}/profile`,
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

    const body = (await req.json().catch(() => ({}))) as { workerType?: string };
    const workerType = parseConvertWorkerType(body.workerType);
    if (!workerType) {
      return NextResponse.json(
        { error: "Invalid workerType. Expected w2 or 1099." },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const { data: candidateAccess, error: accessErr } = await supabase
      .from("worker")
      .select("id, user_id, tenant_id, status, converted_worker_type")
      .eq("id", idCheck.value)
      .maybeSingle();

    if (accessErr) throw accessErr;
    if (!candidateAccess?.id) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }
    if (isCandidateAlreadyConverted(candidateAccess)) {
      return NextResponse.json(
        { error: "This candidate has already been converted." },
        { status: 409 }
      );
    }
    if (!canAccessWorkerRecord(auth, { id: String(candidateAccess.id), user_id: candidateAccess.user_id })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await convertCandidateToWorker(supabase, idCheck.value, workerType, auth.userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    void writeActivityLog({
      actorUserId: auth.userId,
      action: "candidate_converted_to_worker",
      entityType: "workers",
      entityId: result.workerRecordId,
      tenantId: candidateAccess.tenant_id != null ? String(candidateAccess.tenant_id) : null,
      metadata: {
        candidate_id: result.candidateId,
        worker_type: result.workerType,
        created: result.created,
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
    });
  } catch (err: unknown) {
    console.error("[admin/candidates/convert-worker]", err);
    const message = err instanceof Error ? err.message : "Failed to convert candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
