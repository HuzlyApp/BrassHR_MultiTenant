import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import {
  assignWorkflowToJobRequisition,
  buildJobWorkflowPatch,
} from "@/lib/job-requisitions/assign-job-workflow";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { assertJobStatusTransition } from "@/lib/job-requisitions/status-transitions";
import { isPublishedJobStatus, remainingPositions } from "@/lib/job-requisitions/types";
import type {
  EmploymentType,
  JobRequisitionStatus,
  PlacementType,
} from "@/lib/job-requisitions/types";
import {
  deriveSourceType,
  parseEmploymentType,
  parseLocationType,
  parsePlacementType,
  parseRateUnit,
  parseSourceType,
  sanitizeConditionalJobFields,
  validateJobRequisition,
} from "@/lib/job-requisitions/validate-job";
import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const tenantId = await resolveEffectiveAdminTenantId(supabase as OnboardingDbClient, {
    userId: auth.userId,
    authUser: auth.authUser,
    godAdmin: auth.godAdmin,
  });
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  }

  const { id } = await context.params;
  const { data: job, error } = await supabase
    .from("job_requisitions")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: "Job requisition not found" }, { status: 404 });

  const [{ data: flow }, { data: applicants }] = await Promise.all([
    job.workflow_template_id
      ? supabase
          .from("onboarding_flows")
          .select("id, name, status")
          .eq("id", job.workflow_template_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("applicant_requisitions")
      .select("applicant_id, applied_at, pipeline_status")
      .eq("requisition_id", id),
  ]);

  const workerIds = (applicants ?? []).map((a) => a.applicant_id);
  const { data: workers } = workerIds.length
    ? await supabase
        .from("worker")
        .select("id, first_name, last_name, email, status, final_disposition")
        .in("id", workerIds)
    : {
        data: [] as Array<{
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          status: string;
          final_disposition: string | null;
        }>,
      };

  const workerById = new Map((workers ?? []).map((w) => [String(w.id), w]));
  const positionsCount = Number(job.positions_count ?? 1);
  const filled = Number(job.filled_positions ?? 0);

  return NextResponse.json({
    job: {
      ...job,
      workflow_name: flow?.name ?? null,
      workflow_status: flow?.status ?? null,
      remaining_positions: remainingPositions(positionsCount, filled),
    },
    applicants: (applicants ?? []).map((row) => {
      const w = workerById.get(String(row.applicant_id));
      return {
        applicantId: row.applicant_id,
        appliedAt: row.applied_at,
        pipelineStatus: row.pipeline_status,
        firstName: w?.first_name ?? null,
        lastName: w?.last_name ?? null,
        email: w?.email ?? null,
        status: w?.status ?? null,
        finalDisposition: w?.final_disposition ?? null,
      };
    }),
  });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const tenantId = await resolveEffectiveAdminTenantId(supabase as OnboardingDbClient, {
    userId: auth.userId,
    authUser: auth.authUser,
    godAdmin: auth.godAdmin,
  });
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  }

  const { id } = await context.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.workflowTemplateId || body.workflow_template_id) {
    return NextResponse.json(
      {
        error: "Workflow is assigned automatically and cannot be set manually.",
        code: "WORKFLOW_OVERRIDE_REJECTED",
      },
      { status: 400 }
    );
  }

  const { data: existing, error: loadErr } = await supabase
    .from("job_requisitions")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (loadErr) throw loadErr;
  if (!existing?.id) {
    return NextResponse.json({ error: "Job requisition not found" }, { status: 404 });
  }

  let nextStatus = body.status ? String(body.status) : String(existing.status);
  if (nextStatus === "Open") nextStatus = "Published";

  if (body.status !== undefined) {
    const transition = assertJobStatusTransition(String(existing.status), nextStatus);
    if (!transition.ok) {
      return NextResponse.json({ error: transition.error, code: "INVALID_STATUS_TRANSITION" }, { status: 400 });
    }
  }

  const employmentType = (
    body.employmentType
      ? parseEmploymentType(body.employmentType) ?? existing.employment_type
      : existing.employment_type
  ) as EmploymentType;
  const placementType = (
    body.placementType
      ? parsePlacementType(body.placementType) ?? existing.placement_type
      : existing.placement_type
  ) as PlacementType;
  const sourceType =
    parseSourceType(body.sourceType) ??
    deriveSourceType(placementType, existing.source_type);
  const profession =
    body.profession !== undefined
      ? typeof body.profession === "string"
        ? body.profession.trim() || null
        : null
      : body.jobRole !== undefined
        ? typeof body.jobRole === "string"
          ? body.jobRole.trim() || null
          : null
        : (existing.profession ?? existing.job_role);
  const specialty =
    body.specialty !== undefined
      ? typeof body.specialty === "string"
        ? body.specialty.trim() || null
        : null
      : existing.specialty ?? null;
  const jobRole = profession;
  const locationType =
    body.locationType !== undefined
      ? parseLocationType(body.locationType)
      : parseLocationType(existing.location_type);

  const forPublish = isPublishedJobStatus(nextStatus);

  const assignment = await assignWorkflowToJobRequisition(supabase, {
    tenantId,
    jobRole,
    profession,
    specialty,
    employmentType,
    placementType,
    sourceType,
    status: nextStatus as JobRequisitionStatus,
    actorUserId: auth.userId,
    request: req,
  });

  const validation = validateJobRequisition({
    title:
      body.title !== undefined ? String(body.title).trim() : String(existing.title ?? ""),
    status: nextStatus,
    employmentType,
    placementType,
    sourceType,
    profession,
    specialty,
    locationType,
    addressLine1:
      body.addressLine1 !== undefined
        ? typeof body.addressLine1 === "string"
          ? body.addressLine1
          : null
        : existing.address_line1,
    city:
      body.city !== undefined
        ? typeof body.city === "string"
          ? body.city
          : null
        : existing.city,
    mspId:
      body.mspId !== undefined
        ? typeof body.mspId === "string"
          ? body.mspId
          : null
        : existing.msp_id,
    mspName:
      body.mspName !== undefined
        ? typeof body.mspName === "string"
          ? body.mspName
          : null
        : existing.msp_name,
    externalReqId:
      body.externalReqId !== undefined
        ? typeof body.externalReqId === "string"
          ? body.externalReqId
          : null
        : existing.external_req_id,
    sourceJobUrl:
      body.sourceJobUrl !== undefined
        ? typeof body.sourceJobUrl === "string"
          ? body.sourceJobUrl
          : null
        : existing.source_job_url,
    eorTenantId:
      body.eorTenantId !== undefined
        ? typeof body.eorTenantId === "string"
          ? body.eorTenantId
          : null
        : existing.eor_tenant_id,
    positionsCount:
      body.positionsCount != null && body.positionsCount !== ""
        ? Number(body.positionsCount)
        : Number(existing.positions_count ?? 1),
    workflowTemplateId: assignment.ok
      ? assignment.workflowTemplateId
      : existing.workflow_template_id,
    forPublish,
  });

  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.issues[0]?.message ?? "Validation failed", issues: validation.issues },
      { status: 400 }
    );
  }

  if (forPublish && !assignment.ok) {
    return NextResponse.json(
      {
        error: assignment.error,
        configPath: assignment.configPath,
        code: "WORKFLOW_MAPPING_MISSING",
      },
      { status: 422 }
    );
  }

  const workflowPatch = buildJobWorkflowPatch(
    assignment,
    existing.public_job_token,
    nextStatus as JobRequisitionStatus
  );

  const conditional = sanitizeConditionalJobFields({
    sourceType,
    placementType,
    locationType,
    mspId:
      body.mspId !== undefined
        ? typeof body.mspId === "string"
          ? body.mspId
          : null
        : existing.msp_id,
    mspName:
      body.mspName !== undefined
        ? typeof body.mspName === "string"
          ? body.mspName
          : null
        : existing.msp_name,
    mspClientId:
      body.mspClientId !== undefined
        ? typeof body.mspClientId === "string"
          ? body.mspClientId
          : null
        : existing.msp_client_id,
    mspClientName:
      body.mspClientName !== undefined
        ? typeof body.mspClientName === "string"
          ? body.mspClientName
          : null
        : existing.msp_client_name,
    externalReqId:
      body.externalReqId !== undefined
        ? typeof body.externalReqId === "string"
          ? body.externalReqId
          : null
        : existing.external_req_id,
    sourceJobTitle:
      body.sourceJobTitle !== undefined
        ? typeof body.sourceJobTitle === "string"
          ? body.sourceJobTitle
          : null
        : existing.source_job_title,
    sourceJobUrl:
      body.sourceJobUrl !== undefined
        ? typeof body.sourceJobUrl === "string"
          ? body.sourceJobUrl
          : null
        : existing.source_job_url,
    sourceJobDetails:
      body.sourceJobDetails !== undefined
        ? typeof body.sourceJobDetails === "string"
          ? body.sourceJobDetails
          : null
        : existing.source_job_details,
    eorTenantId:
      body.eorTenantId !== undefined
        ? typeof body.eorTenantId === "string"
          ? body.eorTenantId
          : null
        : existing.eor_tenant_id,
    addressLine1:
      body.addressLine1 !== undefined
        ? typeof body.addressLine1 === "string"
          ? body.addressLine1
          : null
        : existing.address_line1,
    addressLine2:
      body.addressLine2 !== undefined
        ? typeof body.addressLine2 === "string"
          ? body.addressLine2
          : null
        : existing.address_line2,
    city:
      body.city !== undefined
        ? typeof body.city === "string"
          ? body.city
          : null
        : existing.city,
    stateProvince:
      body.stateProvince !== undefined
        ? typeof body.stateProvince === "string"
          ? body.stateProvince
          : null
        : existing.state_province,
    postalCode:
      body.postalCode !== undefined
        ? typeof body.postalCode === "string"
          ? body.postalCode
          : null
        : existing.postal_code,
    country:
      body.country !== undefined
        ? typeof body.country === "string"
          ? body.country
          : null
        : existing.country,
    latitude:
      body.latitude !== undefined
        ? body.latitude != null && body.latitude !== ""
          ? Number(body.latitude)
          : null
        : existing.latitude != null
          ? Number(existing.latitude)
          : null,
    longitude:
      body.longitude !== undefined
        ? body.longitude != null && body.longitude !== ""
          ? Number(body.longitude)
          : null
        : existing.longitude != null
          ? Number(existing.longitude)
          : null,
  });

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    updated_at: now,
    ...workflowPatch,
    ...conditional,
    employment_type: employmentType,
    placement_type: placementType,
    source_type: sourceType,
    job_role: jobRole,
    profession,
    specialty,
    location_type: locationType,
  };

  if (body.title !== undefined) patch.title = String(body.title).trim();
  if (body.description !== undefined) patch.description = body.description;
  if (body.internalNotes !== undefined) patch.internal_notes = body.internalNotes;
  if (body.department !== undefined) patch.department = body.department;
  if (body.location !== undefined) patch.location = body.location;
  if (body.facilityName !== undefined) patch.facility_name = body.facilityName;
  if (body.qualifications !== undefined) patch.qualifications = body.qualifications;
  if (body.specialRequirements !== undefined) {
    patch.special_requirements = body.specialRequirements;
  }
  if (body.payRate !== undefined) {
    patch.pay_rate = body.payRate != null && body.payRate !== "" ? Number(body.payRate) : null;
  }
  if (body.billRate !== undefined) {
    patch.bill_rate =
      body.billRate != null && body.billRate !== "" ? Number(body.billRate) : null;
  }
  if (body.rateUnit !== undefined) patch.rate_unit = parseRateUnit(body.rateUnit);
  if (body.currency !== undefined) patch.currency = body.currency || "USD";
  if (body.benefitsSummary !== undefined) patch.benefits_summary = body.benefitsSummary;
  if (body.targetStartDate !== undefined) patch.target_start_date = body.targetStartDate || null;
  if (body.jobDuration !== undefined) patch.job_duration = body.jobDuration;
  if (body.positionsCount !== undefined) {
    patch.positions_count = Math.max(1, Number(body.positionsCount) || 1);
  }
  if (body.payRatePublic !== undefined) patch.pay_rate_public = body.payRatePublic === true;
  if (body.assignedRecruiter !== undefined) {
    patch.assigned_recruiter = body.assignedRecruiter || null;
  }

  if (body.status !== undefined) {
    patch.status = nextStatus;
    if (nextStatus === "Published" && !existing.published_at) {
      patch.published_at = now;
    }
    if (nextStatus === "Closed" || nextStatus === "Filled" || nextStatus === "Cancelled") {
      patch.closed_at = now;
    }
    if (nextStatus === "Pending_Approval") {
      await supabase.from("job_requisition_approvals").insert({
        requisition_id: id,
        tenant_id: tenantId,
        action: "submitted",
        actor_user_id: auth.userId,
        comment: typeof body.comment === "string" ? body.comment : null,
      });
    }
    if (nextStatus === "Approved") {
      patch.approved_at = now;
      patch.approved_by = auth.userId;
      await supabase.from("job_requisition_approvals").insert({
        requisition_id: id,
        tenant_id: tenantId,
        action: "approved",
        actor_user_id: auth.userId,
        comment: typeof body.comment === "string" ? body.comment : null,
      });
    }
  }

  const { data, error } = await supabase
    .from("job_requisitions")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select(
      "id, job_number, title, status, workflow_template_id, workflow_assignment_error, public_job_token, job_role, profession, specialty, employment_type, placement_type, source_type, location, department, positions_count, filled_positions, eor_tenant_id, msp_id, external_req_id"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  void writeActivityLog({
    actorUserId: auth.userId,
    action: "job_requisition_updated",
    entityType: "job_requisitions",
    entityId: id,
    tenantId,
    metadata: {
      status: data.status,
      previous_status: existing.status,
      job_number: data.job_number,
    },
    request: req,
  });

  return NextResponse.json({
    job: {
      ...data,
      remaining_positions: remainingPositions(
        Number(data.positions_count ?? 1),
        Number(data.filled_positions ?? 0)
      ),
    },
    assignment: assignment.ok
      ? { matchLevel: assignment.match.matchLevel, mappingId: assignment.match.mappingId }
      : { error: assignment.error },
  });
}

export async function POST(req: NextRequest, context: RouteContext) {
  // Duplicate job
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const tenantId = await resolveEffectiveAdminTenantId(supabase as OnboardingDbClient, {
    userId: auth.userId,
    authUser: auth.authUser,
    godAdmin: auth.godAdmin,
  });
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  }

  const { id } = await context.params;
  const { data: source, error } = await supabase
    .from("job_requisitions")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!source) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.action !== "duplicate") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const omitKeys = new Set([
    "id",
    "job_number",
    "public_job_token",
    "status",
    "filled_positions",
    "published_at",
    "closed_at",
    "approved_at",
    "approved_by",
    "rejected_at",
    "rejection_reason",
    "created_at",
    "updated_at",
    "idempotency_key",
  ]);
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    if (!omitKeys.has(key)) rest[key] = value;
  }

  const { data: dup, error: dupErr } = await supabase
    .from("job_requisitions")
    .insert({
      ...rest,
      title: `${source.title} (Copy)`,
      status: "Draft",
      filled_positions: 0,
      public_job_token: null,
      published_at: null,
      closed_at: null,
      created_by: auth.userId,
      updated_at: new Date().toISOString(),
    })
    .select("id, job_number, title, status")
    .single();

  if (dupErr) return NextResponse.json({ error: dupErr.message }, { status: 500 });
  return NextResponse.json({ job: dup });
}
