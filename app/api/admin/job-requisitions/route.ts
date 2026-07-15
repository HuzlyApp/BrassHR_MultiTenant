import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import {
  assignWorkflowToJobRequisition,
  buildJobWorkflowPatch,
} from "@/lib/job-requisitions/assign-job-workflow";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { remainingPositions } from "@/lib/job-requisitions/types";
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
import { isPublishedJobStatus } from "@/lib/job-requisitions/types";
import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";

export const runtime = "nodejs";

const LIST_SELECT =
  "id, job_number, title, description, job_role, profession, specialty, department, location, location_type, city, state_province, facility_name, employment_type, placement_type, source_type, status, workflow_template_id, workflow_assignment_error, public_job_token, pay_rate, bill_rate, rate_unit, currency, qualifications, target_start_date, positions_count, filled_positions, msp_id, msp_name, msp_client_name, external_req_id, eor_tenant_id, assigned_recruiter, created_at, updated_at, published_at";

export async function GET(req: NextRequest) {
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

  const status = req.nextUrl.searchParams.get("status");
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() || "";
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(req.nextUrl.searchParams.get("pageSize") ?? 50) || 50)
  );

  let query = supabase
    .from("job_requisitions")
    .select(LIST_SELECT, { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });

  if (status && status !== "All") {
    const statusFilter = status === "Open" ? "Published" : status;
    query = query.eq("status", statusFilter);
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let jobs = data ?? [];
  if (q) {
    jobs = jobs.filter((job) => {
      const hay = [
        job.job_number,
        job.title,
        job.job_role,
        job.profession,
        job.specialty,
        job.location,
        job.department,
        job.msp_name,
        job.msp_client_name,
        job.external_req_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  // Metrics over full filtered set (not just one page)
  const metrics = {
    draft: 0,
    pendingApproval: 0,
    published: 0,
    paused: 0,
    closed: 0,
    filled: 0,
    cancelled: 0,
    openPositions: 0,
    filledPositions: 0,
    totalApplicants: 0,
  };
  for (const job of jobs) {
    if (job.status === "Draft") metrics.draft += 1;
    else if (job.status === "Pending_Approval") metrics.pendingApproval += 1;
    else if (job.status === "Published") metrics.published += 1;
    else if (job.status === "Paused") metrics.paused += 1;
    else if (job.status === "Closed") metrics.closed += 1;
    else if (job.status === "Filled") metrics.filled += 1;
    else if (job.status === "Cancelled") metrics.cancelled += 1;
    metrics.openPositions += remainingPositions(
      Number(job.positions_count ?? 1),
      Number(job.filled_positions ?? 0)
    );
    metrics.filledPositions += Number(job.filled_positions ?? 0);
  }

  const flowIds = [
    ...new Set(
      jobs
        .map((j) => j.workflow_template_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];
  const jobIds = jobs.map((j) => j.id);

  const [{ data: flows }, { data: applicantLinks }] = await Promise.all([
    flowIds.length
      ? supabase.from("onboarding_flows").select("id, name, status").in("id", flowIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; status: string }> }),
    jobIds.length
      ? supabase
          .from("applicant_requisitions")
          .select("requisition_id")
          .in("requisition_id", jobIds)
      : Promise.resolve({ data: [] as Array<{ requisition_id: string }> }),
  ]);

  const flowById = new Map((flows ?? []).map((f) => [String(f.id), f]));
  const applicantCountByJob = new Map<string, number>();
  for (const row of applicantLinks ?? []) {
    const id = String(row.requisition_id);
    applicantCountByJob.set(id, (applicantCountByJob.get(id) ?? 0) + 1);
  }
  for (const countVal of applicantCountByJob.values()) {
    metrics.totalApplicants += countVal;
  }

  const enriched = jobs.map((job) => {
    const flow = job.workflow_template_id
      ? flowById.get(String(job.workflow_template_id))
      : null;
    const positionsCount = Number(job.positions_count ?? 1);
    const filled = Number(job.filled_positions ?? 0);
    return {
      ...job,
      workflow_name: flow?.name ?? null,
      workflow_status: flow?.status ?? null,
      applicant_count: applicantCountByJob.get(String(job.id)) ?? 0,
      remaining_positions: remainingPositions(positionsCount, filled),
    };
  });

  const start = (page - 1) * pageSize;
  const pageRows = enriched.slice(start, start + pageSize);

  return NextResponse.json({
    jobs: pageRows,
    metrics,
    pagination: {
      page,
      pageSize,
      total: q ? enriched.length : (count ?? enriched.length),
      totalPages: Math.max(1, Math.ceil((q ? enriched.length : (count ?? enriched.length)) / pageSize)),
    },
  });
}

export async function POST(req: NextRequest) {
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

  const idempotencyKey =
    typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() || null : null;
  if (idempotencyKey) {
    const { data: existing } = await supabase
      .from("job_requisitions")
      .select(
        "id, job_number, title, status, workflow_template_id, workflow_assignment_error, public_job_token, job_role, profession, employment_type, placement_type"
      )
      .eq("tenant_id", tenantId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing?.id) {
      return NextResponse.json({ job: existing, deduplicated: true });
    }
  }

  const title = String(body.title ?? "").trim();
  let status = String(body.status ?? "Draft");
  if (status === "Open") status = "Published";

  const employmentType = parseEmploymentType(body.employmentType) ?? "W2";
  const placementType = parsePlacementType(body.placementType) ?? "Internal";
  const sourceType =
    parseSourceType(body.sourceType) ?? deriveSourceType(placementType, null);
  const profession =
    typeof body.profession === "string"
      ? body.profession.trim() || null
      : typeof body.jobRole === "string"
        ? body.jobRole.trim() || null
        : null;
  const specialty =
    typeof body.specialty === "string" ? body.specialty.trim() || null : null;
  const jobRole = profession;
  const locationType = parseLocationType(body.locationType);
  const forPublish = isPublishedJobStatus(status);

  const assignment = await assignWorkflowToJobRequisition(supabase, {
    tenantId,
    jobRole,
    profession,
    specialty,
    employmentType,
    placementType,
    sourceType,
    status: status as "Draft" | "Published",
    actorUserId: auth.userId,
    request: req,
  });

  const validation = validateJobRequisition({
    title,
    status,
    employmentType,
    placementType,
    sourceType,
    profession,
    specialty,
    locationType,
    addressLine1: typeof body.addressLine1 === "string" ? body.addressLine1 : null,
    city: typeof body.city === "string" ? body.city : null,
    mspId: typeof body.mspId === "string" ? body.mspId : null,
    mspName: typeof body.mspName === "string" ? body.mspName : null,
    externalReqId: typeof body.externalReqId === "string" ? body.externalReqId : null,
    sourceJobUrl: typeof body.sourceJobUrl === "string" ? body.sourceJobUrl : null,
    eorTenantId: typeof body.eorTenantId === "string" ? body.eorTenantId : null,
    positionsCount:
      body.positionsCount != null && body.positionsCount !== ""
        ? Number(body.positionsCount)
        : 1,
    payRate: body.payRate != null && body.payRate !== "" ? Number(body.payRate) : null,
    billRate: body.billRate != null && body.billRate !== "" ? Number(body.billRate) : null,
    rateUnit: parseRateUnit(body.rateUnit),
    workflowTemplateId: assignment.ok ? assignment.workflowTemplateId : null,
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

  // Duplicate MSP external req check
  if (
    sourceType === "MSP" &&
    typeof body.externalReqId === "string" &&
    body.externalReqId.trim() &&
    typeof body.mspId === "string" &&
    body.mspId
  ) {
    const { data: dup } = await supabase
      .from("job_requisitions")
      .select("id, job_number, title")
      .eq("tenant_id", tenantId)
      .eq("msp_id", body.mspId)
      .ilike("external_req_id", body.externalReqId.trim())
      .neq("status", "Cancelled")
      .limit(1)
      .maybeSingle();
    if (dup?.id) {
      return NextResponse.json(
        {
          error: `A job with source requisition ${body.externalReqId.trim()} already exists (${dup.job_number}: ${dup.title}).`,
          code: "DUPLICATE_SOURCE_REQUISITION",
          existingJobId: dup.id,
        },
        { status: 409 }
      );
    }
  }

  const workflowPatch = buildJobWorkflowPatch(
    assignment,
    null,
    status as "Draft" | "Published"
  );

  const conditional = sanitizeConditionalJobFields({
    sourceType,
    placementType,
    locationType,
    mspId: typeof body.mspId === "string" ? body.mspId : null,
    mspName: typeof body.mspName === "string" ? body.mspName : null,
    mspClientId: typeof body.mspClientId === "string" ? body.mspClientId : null,
    mspClientName: typeof body.mspClientName === "string" ? body.mspClientName : null,
    externalReqId: typeof body.externalReqId === "string" ? body.externalReqId : null,
    sourceJobTitle: typeof body.sourceJobTitle === "string" ? body.sourceJobTitle : null,
    sourceJobUrl: typeof body.sourceJobUrl === "string" ? body.sourceJobUrl : null,
    sourceJobDetails: typeof body.sourceJobDetails === "string" ? body.sourceJobDetails : null,
    eorTenantId: typeof body.eorTenantId === "string" ? body.eorTenantId : null,
    addressLine1: typeof body.addressLine1 === "string" ? body.addressLine1 : null,
    addressLine2: typeof body.addressLine2 === "string" ? body.addressLine2 : null,
    city: typeof body.city === "string" ? body.city : null,
    stateProvince: typeof body.stateProvince === "string" ? body.stateProvince : null,
    postalCode: typeof body.postalCode === "string" ? body.postalCode : null,
    country: typeof body.country === "string" ? body.country : null,
    latitude: body.latitude != null && body.latitude !== "" ? Number(body.latitude) : null,
    longitude: body.longitude != null && body.longitude !== "" ? Number(body.longitude) : null,
  });

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("job_requisitions")
    .insert({
      tenant_id: tenantId,
      title,
      description: typeof body.description === "string" ? body.description : null,
      internal_notes: typeof body.internalNotes === "string" ? body.internalNotes : null,
      department: typeof body.department === "string" ? body.department : null,
      location: typeof body.location === "string" ? body.location : null,
      location_type: locationType,
      facility_name: typeof body.facilityName === "string" ? body.facilityName : null,
      job_role: jobRole,
      profession,
      specialty,
      qualifications: typeof body.qualifications === "string" ? body.qualifications : null,
      special_requirements:
        typeof body.specialRequirements === "string" ? body.specialRequirements : null,
      employment_type: employmentType,
      placement_type: placementType,
      source_type: sourceType,
      pay_rate: body.payRate != null && body.payRate !== "" ? Number(body.payRate) : null,
      bill_rate: body.billRate != null && body.billRate !== "" ? Number(body.billRate) : null,
      rate_unit: parseRateUnit(body.rateUnit),
      currency: typeof body.currency === "string" && body.currency ? body.currency : "USD",
      benefits_summary: typeof body.benefitsSummary === "string" ? body.benefitsSummary : null,
      target_start_date:
        typeof body.targetStartDate === "string" && body.targetStartDate
          ? body.targetStartDate
          : null,
      job_duration: typeof body.jobDuration === "string" ? body.jobDuration : null,
      shift_type: typeof body.shiftType === "string" ? body.shiftType : null,
      shift_details: typeof body.shiftDetails === "string" ? body.shiftDetails : null,
      hours_per_week:
        body.hoursPerWeek != null && body.hoursPerWeek !== ""
          ? Number(body.hoursPerWeek)
          : null,
      years_experience_required:
        body.yearsExperienceRequired != null && body.yearsExperienceRequired !== ""
          ? Number(body.yearsExperienceRequired)
          : null,
      positions_count:
        body.positionsCount != null && body.positionsCount !== ""
          ? Math.max(1, Number(body.positionsCount))
          : 1,
      filled_positions: 0,
      pay_rate_public: body.payRatePublic === true,
      status,
      published_at: forPublish ? now : null,
      created_by: auth.userId,
      assigned_recruiter:
        typeof body.assignedRecruiter === "string" ? body.assignedRecruiter : auth.userId,
      idempotency_key: idempotencyKey,
      ...conditional,
      ...workflowPatch,
    })
    .select(
      "id, job_number, title, status, workflow_template_id, workflow_assignment_error, public_job_token, job_role, profession, specialty, employment_type, placement_type, source_type, positions_count, filled_positions, eor_tenant_id, msp_id, external_req_id"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  void writeActivityLog({
    actorUserId: auth.userId,
    action: "job_requisition_created",
    entityType: "job_requisitions",
    entityId: data.id,
    tenantId,
    metadata: {
      job_number: data.job_number,
      status: data.status,
      placement_type: data.placement_type,
      source_type: data.source_type,
    },
    request: req,
  });

  return NextResponse.json({ job: data });
}
