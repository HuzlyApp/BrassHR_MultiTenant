import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildEmploymentWorkerRow,
  isCandidateAlreadyConverted,
  normalizeCandidateStatus,
  parseConvertWorkerType,
  type CandidateConversionSnapshot,
  type ConvertWorkerType,
} from "@/lib/admin/convert-candidate-to-worker";
import { evaluateConversionReadiness } from "@/lib/job-requisitions/evaluate-conversion-readiness";
import type { PlacementType } from "@/lib/job-requisitions/types";

export type ConversionOutcome =
  | "internal_worker"
  | "eor_worker"
  | "hired_by_client";

export type DispositionConvertResult =
  | {
      ok: true;
      outcome: ConversionOutcome;
      workerRecordId: string | null;
      placementId: string | null;
      candidateId: string;
      created: boolean;
      profilePath: string | null;
      filledPositions: number | null;
      remainingPositions: number | null;
    }
  | { ok: false; error: string; status: number };

export function resolveConversionOutcome(
  placementType: PlacementType | string | null | undefined
): ConversionOutcome {
  if (placementType === "Recruit_and_Release") return "hired_by_client";
  if (placementType === "Recruit_and_EOR") return "eor_worker";
  return "internal_worker";
}

export function isPayrollWorkerOutcome(outcome: ConversionOutcome): boolean {
  return outcome === "internal_worker" || outcome === "eor_worker";
}

async function loadCandidate(
  supabase: SupabaseClient,
  candidateId: string
): Promise<
  | (CandidateConversionSnapshot & {
      job_requisition_id: string | null;
      applicant_workflow_instance_id: string | null;
    })
  | null
> {
  const { data, error } = await supabase
    .from("worker")
    .select(
      "id, tenant_id, first_name, last_name, email, phone, job_role, city, state, status, converted_worker_type, converted_at, job_requisition_id, applicant_workflow_instance_id, final_disposition"
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
    job_requisition_id: data.job_requisition_id ? String(data.job_requisition_id) : null,
    applicant_workflow_instance_id: data.applicant_workflow_instance_id
      ? String(data.applicant_workflow_instance_id)
      : null,
  };
}

async function resolveJobPlacement(
  supabase: SupabaseClient,
  candidate: { job_requisition_id: string | null; tenant_id: string; id: string }
): Promise<{
  requisitionId: string | null;
  placementType: PlacementType;
  eorTenantId: string | null;
  mspId: string | null;
  mspName: string | null;
  mspClientId: string | null;
  billRate: number | null;
  payRate: number | null;
  facilityName: string | null;
} | null> {
  let requisitionId = candidate.job_requisition_id;

  if (!requisitionId) {
    const { data: link } = await supabase
      .from("applicant_requisitions")
      .select("requisition_id")
      .eq("applicant_id", candidate.id)
      .order("applied_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    requisitionId = link?.requisition_id ? String(link.requisition_id) : null;
  }

  if (!requisitionId) {
    return {
      requisitionId: null,
      placementType: "Internal",
      eorTenantId: null,
      mspId: null,
      mspName: null,
      mspClientId: null,
      billRate: null,
      payRate: null,
      facilityName: null,
    };
  }

  const { data: job, error } = await supabase
    .from("job_requisitions")
    .select(
      "id, placement_type, eor_tenant_id, msp_id, msp_name, msp_client_id, bill_rate, pay_rate, facility_name, positions_count, filled_positions, status"
    )
    .eq("id", requisitionId)
    .eq("tenant_id", candidate.tenant_id)
    .maybeSingle();

  if (error) throw error;
  if (!job) return null;

  return {
    requisitionId: String(job.id),
    placementType: String(job.placement_type) as PlacementType,
    eorTenantId: job.eor_tenant_id ? String(job.eor_tenant_id) : null,
    mspId: job.msp_id ? String(job.msp_id) : null,
    mspName: job.msp_name ?? null,
    mspClientId: job.msp_client_id ? String(job.msp_client_id) : null,
    billRate: job.bill_rate != null ? Number(job.bill_rate) : null,
    payRate: job.pay_rate != null ? Number(job.pay_rate) : null,
    facilityName: job.facility_name ?? null,
  };
}

async function bumpFilledPositions(
  supabase: SupabaseClient,
  requisitionId: string | null
): Promise<{ filled: number | null; remaining: number | null }> {
  if (!requisitionId) return { filled: null, remaining: null };

  const { data, error } = await supabase.rpc("increment_job_filled_positions", {
    p_requisition_id: requisitionId,
    p_allow_overfill: false,
  });

  if (error) {
    // Fallback for environments where RPC is not yet applied
    const { data: job } = await supabase
      .from("job_requisitions")
      .select("positions_count, filled_positions, status")
      .eq("id", requisitionId)
      .maybeSingle();

    if (!job) throw error;
    const positions = Number(job.positions_count ?? 1);
    const filled = Number(job.filled_positions ?? 0);
    if (filled >= positions) {
      throw new Error("No remaining positions for this job requisition");
    }
    const nextFilled = filled + 1;
    const patch: Record<string, unknown> = {
      filled_positions: nextFilled,
      updated_at: new Date().toISOString(),
    };
    if (nextFilled >= positions && (job.status === "Published" || job.status === "Paused")) {
      patch.status = "Filled";
      patch.closed_at = new Date().toISOString();
    }
    await supabase.from("job_requisitions").update(patch).eq("id", requisitionId);
    return { filled: nextFilled, remaining: Math.max(0, positions - nextFilled) };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    filled: row?.filled_positions != null ? Number(row.filled_positions) : null,
    remaining: row?.remaining_positions != null ? Number(row.remaining_positions) : null,
  };
}

/**
 * Explicit, idempotent conversion / disposition by job placement type.
 */
export async function convertCandidateByDisposition(
  supabase: SupabaseClient,
  candidateId: string,
  options: {
    workerType?: ConvertWorkerType | null;
    actorUserId?: string | null;
    clientName?: string | null;
    notes?: string | null;
    hireDate?: string | null;
  } = {}
): Promise<DispositionConvertResult> {
  const candidate = await loadCandidate(supabase, candidateId);
  if (!candidate) {
    return { ok: false, error: "Candidate not found", status: 404 };
  }

  if (
    isCandidateAlreadyConverted(candidate) ||
    normalizeCandidateStatus(candidate.status) === "hired_by_client"
  ) {
    // Idempotent: return existing outcome when possible
    const { data: existingWorker } = await supabase
      .from("workers")
      .select("id")
      .eq("candidate_id", candidateId)
      .maybeSingle();
    const { data: existingPlacement } = await supabase
      .from("client_hire_placements")
      .select("id")
      .eq("applicant_id", candidateId)
      .maybeSingle();

    return {
      ok: true,
      outcome: existingPlacement?.id
        ? "hired_by_client"
        : existingWorker?.id
          ? "internal_worker"
          : "internal_worker",
      workerRecordId: existingWorker?.id ? String(existingWorker.id) : null,
      placementId: existingPlacement?.id ? String(existingPlacement.id) : null,
      candidateId,
      created: false,
      profilePath: existingWorker?.id
        ? `/admin_recruiter/workers/${candidateId}/profile`
        : null,
      filledPositions: null,
      remainingPositions: null,
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
      error: "Only approved candidates can be converted or marked hired by client.",
      status: 400,
    };
  }

  const job = await resolveJobPlacement(supabase, candidate);
  if (!job) {
    return { ok: false, error: "Linked job requisition not found.", status: 400 };
  }

  const outcome = resolveConversionOutcome(job.placementType);
  const convertedAt = new Date().toISOString();

  if (outcome === "hired_by_client") {
    const { data: existingPlacement } = await supabase
      .from("client_hire_placements")
      .select("id")
      .eq("applicant_id", candidateId)
      .maybeSingle();

    if (existingPlacement?.id) {
      return {
        ok: true,
        outcome: "hired_by_client",
        workerRecordId: null,
        placementId: String(existingPlacement.id),
        candidateId,
        created: false,
        profilePath: null,
        filledPositions: null,
        remainingPositions: null,
      };
    }

    const { data: placement, error: placeErr } = await supabase
      .from("client_hire_placements")
      .insert({
        tenant_id: candidate.tenant_id,
        requisition_id: job.requisitionId,
        applicant_id: candidateId,
        applicant_workflow_instance_id: candidate.applicant_workflow_instance_id,
        client_name: options.clientName?.trim() || job.facilityName || null,
        msp_id: job.mspId,
        msp_client_id: job.mspClientId,
        hire_date: options.hireDate || convertedAt.slice(0, 10),
        notes: options.notes?.trim() || null,
        created_by: options.actorUserId ?? null,
      })
      .select("id")
      .maybeSingle();

    if (placeErr) throw placeErr;
    if (!placement?.id) {
      return { ok: false, error: "Failed to create client hire placement", status: 500 };
    }

    await supabase
      .from("worker")
      .update({
        status: "hired_by_client",
        final_disposition: "hired_by_client",
        hired_by_client_at: convertedAt,
        client_hire_placement_id: placement.id,
        conversion_status: "skipped",
        updated_at: convertedAt,
      })
      .eq("id", candidateId);

    if (candidate.applicant_workflow_instance_id) {
      await supabase
        .from("applicant_workflow_instances")
        .update({
          conversion_status: "skipped",
          updated_at: convertedAt,
        })
        .eq("id", candidate.applicant_workflow_instance_id);
    }

    const counts = await bumpFilledPositions(supabase, job.requisitionId);

    return {
      ok: true,
      outcome: "hired_by_client",
      workerRecordId: null,
      placementId: String(placement.id),
      candidateId,
      created: true,
      profilePath: null,
      filledPositions: counts.filled,
      remainingPositions: counts.remaining,
    };
  }

  // Internal or EOR → create payroll worker
  const workerType =
    options.workerType ??
    parseConvertWorkerType(
      // Prefer employment type from context; default w2
      "w2"
    ) ??
    "w2";

  const { data: existing } = await supabase
    .from("workers")
    .select("id")
    .eq("candidate_id", candidateId)
    .maybeSingle();

  if (existing?.id) {
    return {
      ok: true,
      outcome,
      workerRecordId: String(existing.id),
      placementId: null,
      candidateId,
      created: false,
      profilePath: `/admin_recruiter/workers/${candidateId}/profile`,
      filledPositions: null,
      remainingPositions: null,
    };
  }

  if (outcome === "eor_worker" && !job.eorTenantId) {
    return {
      ok: false,
      error: "This job requires an Employer of Record before conversion.",
      status: 400,
    };
  }

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

  const { data: assignment, error: assignErr } = await supabase
    .from("worker_assignments")
    .insert({
      worker_id: workerRecordId,
      requisition_id: job.requisitionId,
      tenant_id: candidate.tenant_id,
      applicant_id: candidateId,
      placement_type: job.placementType,
      eor_type: outcome === "eor_worker" ? "Tenant" : null,
      eor_tenant_id: job.eorTenantId,
      msp_id: job.mspId,
      msp_name: job.mspName,
      bill_rate: job.billRate,
      pay_rate: job.payRate,
      assignment_start: convertedAt.slice(0, 10),
      status: "Active",
      integration_status: outcome === "eor_worker" ? "Pending" : "Not_Required",
    })
    .select("id")
    .maybeSingle();

  if (assignErr) throw assignErr;

  await supabase
    .from("worker")
    .update({
      status: "converted",
      converted_worker_type: workerType,
      converted_at: convertedAt,
      converted_worker_id: workerRecordId,
      converted_by: options.actorUserId ?? null,
      conversion_status: "completed",
      final_disposition: "converted_to_worker",
      updated_at: convertedAt,
    })
    .eq("id", candidateId);

  if (candidate.applicant_workflow_instance_id) {
    await supabase
      .from("applicant_workflow_instances")
      .update({
        conversion_status: "completed",
        converted_worker_id: workerRecordId,
        converted_at: convertedAt,
        converted_by: options.actorUserId ?? null,
        worker_type: workerType,
        updated_at: convertedAt,
      })
      .eq("id", candidate.applicant_workflow_instance_id);
  }

  const counts = await bumpFilledPositions(supabase, job.requisitionId);

  return {
    ok: true,
    outcome,
    workerRecordId,
    placementId: assignment?.id ? String(assignment.id) : null,
    candidateId,
    created: true,
    profilePath: `/admin_recruiter/workers/${candidateId}/profile`,
    filledPositions: counts.filled,
    remainingPositions: counts.remaining,
  };
}
