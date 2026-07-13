import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import {
  assignWorkflowToJobRequisition,
  buildJobWorkflowPatch,
} from "@/lib/job-requisitions/assign-job-workflow";
import type { EmploymentType, PlacementType } from "@/lib/job-requisitions/types";
import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";

export const runtime = "nodejs";

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

  let query = supabase
    .from("job_requisitions")
    .select(
      "id, title, description, job_role, department, location, facility_name, employment_type, placement_type, status, workflow_template_id, workflow_assignment_error, public_job_token, pay_rate, bill_rate, qualifications, target_start_date, created_at, updated_at"
    )
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });

  if (status && status !== "All") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let jobs = data ?? [];
  if (q) {
    jobs = jobs.filter((job) => {
      const hay = [job.title, job.job_role, job.location, job.department]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
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

  const enriched = jobs.map((job) => {
    const flow = job.workflow_template_id
      ? flowById.get(String(job.workflow_template_id))
      : null;
    return {
      ...job,
      workflow_name: flow?.name ?? null,
      workflow_status: flow?.status ?? null,
      applicant_count: applicantCountByJob.get(String(job.id)) ?? 0,
    };
  });

  return NextResponse.json({ jobs: enriched });
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
  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const status = String(body.status ?? "Draft");
  const employmentType = String(body.employmentType ?? "W2") as EmploymentType;
  const placementType = String(body.placementType ?? "Internal") as PlacementType;
  const jobRole = typeof body.jobRole === "string" ? body.jobRole.trim() || null : null;

  const assignment = await assignWorkflowToJobRequisition(supabase, {
    tenantId,
    jobRole,
    employmentType,
    placementType,
    status: status as "Draft" | "Open" | "Paused" | "Closed" | "Filled",
    actorUserId: auth.userId,
    request: req,
  });

  if (status === "Open" && !assignment.ok) {
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
    null,
    status as "Draft" | "Open"
  );

  // Reject any client-supplied workflow override.
  if (body.workflowTemplateId || body.workflow_template_id) {
    return NextResponse.json(
      { error: "Workflow is assigned automatically and cannot be set manually.", code: "WORKFLOW_OVERRIDE_REJECTED" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("job_requisitions")
    .insert({
      tenant_id: tenantId,
      title,
      description: typeof body.description === "string" ? body.description : null,
      department: typeof body.department === "string" ? body.department : null,
      location: typeof body.location === "string" ? body.location : null,
      facility_name: typeof body.facilityName === "string" ? body.facilityName : null,
      job_role: jobRole,
      qualifications: typeof body.qualifications === "string" ? body.qualifications : null,
      employment_type: employmentType,
      placement_type: placementType,
      source_type: placementType === "Internal" ? "Internal" : "MSP",
      pay_rate: body.payRate != null && body.payRate !== "" ? Number(body.payRate) : null,
      bill_rate: body.billRate != null && body.billRate !== "" ? Number(body.billRate) : null,
      target_start_date:
        typeof body.targetStartDate === "string" && body.targetStartDate
          ? body.targetStartDate
          : null,
      status,
      created_by: auth.userId,
      ...workflowPatch,
    })
    .select(
      "id, title, status, workflow_template_id, workflow_assignment_error, public_job_token, job_role, employment_type, placement_type"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ job: data });
}
