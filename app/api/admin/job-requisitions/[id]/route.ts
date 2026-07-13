import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import {
  assignWorkflowToJobRequisition,
  buildJobWorkflowPatch,
} from "@/lib/job-requisitions/assign-job-workflow";
import type {
  EmploymentType,
  JobRequisitionStatus,
  PlacementType,
} from "@/lib/job-requisitions/types";
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
        .select("id, first_name, last_name, email, status")
        .in("id", workerIds)
    : { data: [] as Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null; status: string }> };

  const workerById = new Map((workers ?? []).map((w) => [String(w.id), w]));

  return NextResponse.json({
    job: {
      ...job,
      workflow_name: flow?.name ?? null,
      workflow_status: flow?.status ?? null,
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
    .select(
      "id, tenant_id, status, job_role, employment_type, placement_type, public_job_token, workflow_template_id"
    )
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (loadErr) throw loadErr;
  if (!existing?.id) {
    return NextResponse.json({ error: "Job requisition not found" }, { status: 404 });
  }

  const nextStatus = (body.status ? String(body.status) : existing.status) as JobRequisitionStatus;
  const jobRole =
    body.jobRole !== undefined
      ? typeof body.jobRole === "string"
        ? body.jobRole.trim() || null
        : null
      : existing.job_role;
  const employmentType = (
    body.employmentType ? String(body.employmentType) : existing.employment_type
  ) as EmploymentType;
  const placementType = (
    body.placementType ? String(body.placementType) : existing.placement_type
  ) as PlacementType;

  const assignment = await assignWorkflowToJobRequisition(supabase, {
    tenantId,
    jobRole,
    employmentType,
    placementType,
    status: nextStatus,
    actorUserId: auth.userId,
    request: req,
  });

  if (nextStatus === "Open" && !assignment.ok) {
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
    nextStatus
  );

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    ...workflowPatch,
  };

  if (body.title !== undefined) patch.title = String(body.title).trim();
  if (body.description !== undefined) patch.description = body.description;
  if (body.department !== undefined) patch.department = body.department;
  if (body.location !== undefined) patch.location = body.location;
  if (body.facilityName !== undefined) patch.facility_name = body.facilityName;
  if (body.qualifications !== undefined) patch.qualifications = body.qualifications;
  if (body.status !== undefined) {
    patch.status = nextStatus;
    if (nextStatus === "Closed" || nextStatus === "Filled") {
      patch.closed_at = new Date().toISOString();
    }
  }
  if (body.jobRole !== undefined) patch.job_role = jobRole;
  if (body.employmentType !== undefined) patch.employment_type = employmentType;
  if (body.placementType !== undefined) {
    patch.placement_type = placementType;
    patch.source_type = placementType === "Internal" ? "Internal" : "MSP";
  }
  if (body.payRate !== undefined) {
    patch.pay_rate = body.payRate != null && body.payRate !== "" ? Number(body.payRate) : null;
  }
  if (body.billRate !== undefined) {
    patch.bill_rate = body.billRate != null && body.billRate !== "" ? Number(body.billRate) : null;
  }
  if (body.targetStartDate !== undefined) {
    patch.target_start_date = body.targetStartDate || null;
  }

  const { data, error } = await supabase
    .from("job_requisitions")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select(
      "id, title, status, workflow_template_id, workflow_assignment_error, public_job_token, job_role, employment_type, placement_type, location, department"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    job: data,
    assignment: assignment.ok
      ? { matchLevel: assignment.match.matchLevel, mappingId: assignment.match.mappingId }
      : { error: assignment.error },
  });
}
