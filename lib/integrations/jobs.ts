import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { saveJobRequisition } from "@/lib/jobs/service";
import {
  EMPLOYMENT_TYPES,
  PLACEMENT_TYPES,
  SOURCE_TYPES,
  type EmploymentType,
  type FieldErrors,
  type JobRequisitionInput,
  type PlacementType,
  type SourceType,
} from "@/lib/jobs/types";
import { JobValidationError } from "@/lib/jobs/types";

export type InboundCreateJobBody = Record<string, unknown>;

export type InboundJobSummary = {
  id: string;
  external_req_id: string | null;
  title: string;
  status: string;
  created_at?: string;
  created?: boolean;
};

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeSourceType(value: unknown): SourceType | null {
  const raw = asString(value);
  if (!raw) return null;
  const match = SOURCE_TYPES.find((item) => item.toLowerCase() === raw.toLowerCase());
  return match ?? null;
}

function normalizePlacementType(value: unknown): PlacementType | null {
  const raw = asString(value);
  if (!raw) return null;
  const normalized = raw.replace(/\s+/g, "_");
  const match = PLACEMENT_TYPES.find(
    (item) => item.toLowerCase() === normalized.toLowerCase()
  );
  return match ?? null;
}

function normalizeEmploymentType(value: unknown): EmploymentType | null {
  const raw = asString(value);
  if (!raw) return null;
  const match = EMPLOYMENT_TYPES.find((item) => item.toLowerCase() === raw.toLowerCase());
  return match ?? null;
}

function normalizeStatus(value: unknown): "draft" | "open" {
  const raw = asString(value)?.toLowerCase();
  if (!raw || raw === "draft") return "draft";
  if (raw === "open" || raw === "published") return "open";
  return "draft";
}

async function resolveInboundActorUserId(
  supabase: SupabaseClient,
  tenantId: string,
  preferredUserId: string | null
): Promise<string> {
  if (preferredUserId?.trim()) return preferredUserId.trim();

  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data?.id) return String(data.id);

  throw new JobValidationError(
    "No staff user available to attribute API-created jobs. Recreate the API key from Settings.",
    {},
    "VALIDATION_ERROR"
  );
}

async function resolveJobSourceId(
  supabase: SupabaseClient,
  code: string | null
): Promise<string | null> {
  if (!code) return null;
  const { data, error } = await supabase
    .from("job_sources")
    .select("id, code")
    .ilike("code", code)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) {
    throw new JobValidationError(
      `Unknown job_source_code "${code}". Pre-register the source before using it.`,
      {},
      "VALIDATION_ERROR"
    );
  }
  return String(data.id);
}

function mapBodyToJobInput(body: InboundCreateJobBody): {
  input: JobRequisitionInput;
  status: "draft" | "open";
  jobSourceCode: string | null;
  externalReqId: string | null;
} {
  const sourceType = normalizeSourceType(body.source_type) ?? "MSP";
  const placementType =
    normalizePlacementType(body.placement_type) ??
    (sourceType === "MSP" ? "Recruit_and_Release" : "Internal");
  const employmentType = normalizeEmploymentType(body.employment_type);
  const title =
    asString(body.title) ??
    asString(body.public_title) ??
    asString(body.source_job_title);
  const sourceJobTitle = asString(body.source_job_title) ?? title;
  const externalReqId =
    asString(body.external_req_id) ?? asString(body.external_requisition_id);
  const location = asString(body.location);
  const profession = asString(body.profession);

  const errors: FieldErrors = {};
  if (sourceType === "MSP") {
    if (!placementType) errors.placementType = "placement_type is required for MSP jobs";
    if (!employmentType) errors.employmentType = "employment_type is required for MSP jobs";
    if (!sourceJobTitle) errors.sourceJobTitle = "source_job_title or title is required";
    if (!profession) errors.profession = "profession is required for MSP jobs";
    if (!externalReqId) errors.externalRequisitionId = "external_req_id is required for MSP jobs";
    if (!location) errors.location = "location is required for MSP jobs";
  } else {
    if (!employmentType) errors.employmentType = "employment_type is required";
    if (!title) errors.publicTitle = "title is required";
  }

  if (Object.keys(errors).length) {
    throw new JobValidationError("Validation failed", errors, "VALIDATION_ERROR");
  }

  const payRate = asNumber(body.pay_rate);
  const billRate = asNumber(body.bill_rate);
  const numberOfPositions = asNumber(body.number_of_positions);

  const input: JobRequisitionInput = {
    sourceType,
    placementType,
    employmentType: employmentType!,
    publicTitle: asString(body.public_title) ?? title,
    sourceJobTitle,
    publicDescription: asString(body.description) ?? asString(body.public_description),
    sourceJobDetails: asString(body.source_description),
    externalRequisitionId: externalReqId,
    internalRequisitionNumber: asString(body.internal_requisition_number),
    mspName: asString(body.msp_name),
    mspClient: asString(body.msp_client_name) ?? asString(body.msp_client),
    facility: asString(body.facility_name) ?? asString(body.facility),
    location,
    jobLocationType: asString(body.location_type),
    profession,
    specialtyId: null,
    billRate,
    payRateMin: payRate,
    payRateMax: payRate,
    suggestedPayRate: payRate,
    payRatePeriod: asString(body.rate_unit),
    numberOfPositions: numberOfPositions ?? 1,
    sourceJobUrl: asString(body.source_job_url),
    yearsOfExperience: asString(body.years_of_experience),
    acceptableMatchRate: asString(body.acceptable_match_rate),
    internalNotes: asString(body.internal_notes),
    duration: asString(body.job_duration),
    targetStartDate: asString(body.target_start_date),
    hoursPerWeek: asNumber(body.expected_hours),
    showPayBy: asString(body.show_pay_by),
    benefits: Array.isArray(body.benefits)
      ? body.benefits.map((item) => String(item)).join("\n")
      : asString(body.benefits),
  };

  return {
    input,
    status: normalizeStatus(body.status),
    jobSourceCode: asString(body.job_source_code),
    externalReqId,
  };
}

function toJobSummary(data: Record<string, unknown>): InboundJobSummary {
  return {
    id: String(data.id),
    external_req_id:
      (data.external_req_id ? String(data.external_req_id) : null) ??
      (data.external_requisition_id ? String(data.external_requisition_id) : null),
    title: String(data.public_title ?? data.title ?? ""),
    status: String(data.status ?? ""),
    created_at: data.created_at ? String(data.created_at) : undefined,
  };
}

async function findJobByExternalReqId(
  supabase: SupabaseClient,
  tenantId: string,
  externalReqId: string
): Promise<InboundJobSummary | null> {
  const trimmed = externalReqId.trim();
  const select =
    "id, external_req_id, external_requisition_id, title, public_title, status, created_at";

  const byExternalReq = await supabase
    .from("job_requisitions")
    .select(select)
    .eq("tenant_id", tenantId)
    .eq("external_req_id", trimmed)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byExternalReq.error) throw byExternalReq.error;
  if (byExternalReq.data) return toJobSummary(byExternalReq.data as Record<string, unknown>);

  const byExternalRequisition = await supabase
    .from("job_requisitions")
    .select(select)
    .eq("tenant_id", tenantId)
    .eq("external_requisition_id", trimmed)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byExternalRequisition.error) throw byExternalRequisition.error;
  if (!byExternalRequisition.data) return null;
  return toJobSummary(byExternalRequisition.data as Record<string, unknown>);
}

export async function createInboundJob(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    actorUserId: string | null;
    body: InboundCreateJobBody;
  }
): Promise<InboundJobSummary> {
  const mapped = mapBodyToJobInput(input.body);

  if (mapped.externalReqId) {
    const existing = await findJobByExternalReqId(
      supabase,
      input.tenantId,
      mapped.externalReqId
    );
    if (existing) {
      return { ...existing, created: false };
    }
  }

  const jobSourceId = await resolveJobSourceId(supabase, mapped.jobSourceCode);
  const actorUserId = await resolveInboundActorUserId(
    supabase,
    input.tenantId,
    input.actorUserId
  );

  const result = await saveJobRequisition(
    supabase,
    input.tenantId,
    actorUserId,
    mapped.input,
    {
      publish: mapped.status === "open",
    }
  );

  const job = result.job as Record<string, unknown>;
  const jobId = String(job.id);

  if (jobSourceId) {
    await supabase
      .from("job_requisitions")
      .update({
        job_source_id: jobSourceId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("tenant_id", input.tenantId);
  }

  if (asString(input.body.specialty)) {
    await supabase
      .from("job_requisitions")
      .update({
        specialty: asString(input.body.specialty),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("tenant_id", input.tenantId);
  }

  return {
    id: jobId,
    external_req_id:
      mapped.externalReqId ??
      (job.external_req_id ? String(job.external_req_id) : null) ??
      (job.external_requisition_id ? String(job.external_requisition_id) : null),
    title: String(job.public_title ?? job.title ?? mapped.input.publicTitle ?? ""),
    status: String(job.status ?? mapped.status),
    created: true,
  };
}

export async function searchInboundJob(
  supabase: SupabaseClient,
  tenantId: string,
  params: URLSearchParams
): Promise<InboundJobSummary | null> {
  const allowed = ["id", "external_req_id", "title"];
  const keys = [...params.keys()];
  if (keys.length !== 1 || !allowed.includes(keys[0]!)) {
    throw new JobValidationError(
      "Provide exactly one of: id, external_req_id, or title",
      {},
      "VALIDATION_ERROR"
    );
  }

  const id = asString(params.get("id"));
  const externalReqId = asString(params.get("external_req_id"));
  const title = asString(params.get("title"));

  const select =
    "id, external_req_id, external_requisition_id, title, public_title, status, created_at";

  if (id) {
    const { data, error } = await supabase
      .from("job_requisitions")
      .select(select)
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toJobSummary(data as Record<string, unknown>) : null;
  }

  if (externalReqId) {
    return findJobByExternalReqId(supabase, tenantId, externalReqId);
  }

  if (title) {
    const byPublic = await supabase
      .from("job_requisitions")
      .select(select)
      .eq("tenant_id", tenantId)
      .eq("public_title", title)
      .limit(1)
      .maybeSingle();
    if (byPublic.error) throw byPublic.error;
    if (byPublic.data) return toJobSummary(byPublic.data as Record<string, unknown>);

    const byTitle = await supabase
      .from("job_requisitions")
      .select(select)
      .eq("tenant_id", tenantId)
      .eq("title", title)
      .limit(1)
      .maybeSingle();
    if (byTitle.error) throw byTitle.error;
    return byTitle.data ? toJobSummary(byTitle.data as Record<string, unknown>) : null;
  }

  return null;
}
