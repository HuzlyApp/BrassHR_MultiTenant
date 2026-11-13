import { NextRequest, NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import { reassignApplicantApplicationToWorkflow } from "@/lib/jobs/reassign-applicants-workflow";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { JobValidationError, jobValidationHttpStatus } from "@/lib/jobs/types";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseRequiredUuid } from "@/lib/validation/uuid";
import { listPublishedWorkflowOptions } from "@/lib/workflow-mappings/service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ workerId: string }> };

type ApplicationRow = {
  id: string;
  workflow_id: string | null;
  applicant_workflow_instance_id: string | null;
  worker_id: string | null;
  job_requisition_id: string | null;
  status: string | null;
};

async function loadPrimaryApplication(
  supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  tenantId: string,
  workerId: string
): Promise<ApplicationRow | null> {
  const { data, error } = await supabase
    .from("job_applications")
    .select(
      "id, workflow_id, applicant_workflow_instance_id, worker_id, job_requisition_id, status"
    )
    .eq("tenant_id", tenantId)
    .eq("worker_id", workerId)
    .neq("status", "withdrawn")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) return null;
  return data as ApplicationRow;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const { workerId: rawWorkerId } = await context.params;
    const idCheck = parseRequiredUuid(rawWorkerId?.trim() ?? "", "workerId");
    if (!idCheck.ok) {
      return NextResponse.json({ error: idCheck.error }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const tenantId = await resolveStaffTenantId(supabase, auth).catch(() => null);
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
    }

    const { data: worker, error: workerError } = await supabase
      .from("worker")
      .select("id, user_id")
      .eq("id", idCheck.value)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (workerError) throw workerError;
    if (!worker?.id) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }
    if (!(await canAccessWorkerRecord(auth, { id: String(worker.id), user_id: worker.user_id }))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [application, workflows] = await Promise.all([
      loadPrimaryApplication(supabase, tenantId, idCheck.value),
      listPublishedWorkflowOptions(supabase, tenantId),
    ]);

    let currentWorkflowName: string | null = null;
    const currentWorkflowId = application?.workflow_id ?? null;
    if (currentWorkflowId) {
      const match = workflows.find((row) => String(row.id) === currentWorkflowId);
      currentWorkflowName = match ? String(match.name ?? "") : null;
      if (!currentWorkflowName) {
        const { data: instance } = await supabase
          .from("applicant_workflow_instances")
          .select("workflow_name")
          .eq("tenant_id", tenantId)
          .eq("application_id", application?.id ?? "")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        currentWorkflowName = instance?.workflow_name ? String(instance.workflow_name) : null;
      }
    }

    return NextResponse.json({
      applicationId: application?.id ?? null,
      currentWorkflowId,
      currentWorkflowName,
      workflows: (workflows ?? []).map((row) => ({
        id: String(row.id),
        name: String(row.name ?? "Workflow"),
        employmentType: (row as { employment_type?: string | null }).employment_type ?? null,
      })),
    });
  } catch (err: unknown) {
    console.error("[admin/candidates/reassign-workflow GET]", err);
    const message = err instanceof Error ? err.message : "Failed to load workflow options";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
      workflowId?: string;
      applicationId?: string;
    };
    const workflowCheck = parseRequiredUuid(
      typeof body.workflowId === "string" ? body.workflowId.trim() : "",
      "workflowId"
    );
    if (!workflowCheck.ok) {
      return NextResponse.json({ error: workflowCheck.error }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const tenantId = await resolveStaffTenantId(supabase, auth).catch(() => null);
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
    }

    const { data: worker, error: workerError } = await supabase
      .from("worker")
      .select("id, user_id")
      .eq("id", idCheck.value)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (workerError) throw workerError;
    if (!worker?.id) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }
    if (!(await canAccessWorkerRecord(auth, { id: String(worker.id), user_id: worker.user_id }))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let application = await loadPrimaryApplication(supabase, tenantId, idCheck.value);
    if (
      typeof body.applicationId === "string" &&
      body.applicationId.trim() &&
      application &&
      body.applicationId.trim() !== application.id
    ) {
      const appCheck = parseRequiredUuid(body.applicationId.trim(), "applicationId");
      if (!appCheck.ok) {
        return NextResponse.json({ error: appCheck.error }, { status: 400 });
      }
      const { data: specific, error: specificError } = await supabase
        .from("job_applications")
        .select(
          "id, workflow_id, applicant_workflow_instance_id, worker_id, job_requisition_id, status"
        )
        .eq("tenant_id", tenantId)
        .eq("worker_id", idCheck.value)
        .eq("id", appCheck.value)
        .maybeSingle();
      if (specificError) throw specificError;
      if (!specific?.id) {
        return NextResponse.json({ error: "Application not found for this candidate" }, { status: 404 });
      }
      application = specific as ApplicationRow;
    }

    if (!application?.id) {
      return NextResponse.json(
        { error: "This candidate has no active job application to assign a workflow to." },
        { status: 400 }
      );
    }

    if (application.workflow_id === workflowCheck.value) {
      return NextResponse.json({
        ok: true,
        unchanged: true,
        applicationId: application.id,
        workflowId: workflowCheck.value,
        workflowName: null,
        stepsPreserved: 0,
        message: "Candidate is already on this workflow.",
      });
    }

    const result = await reassignApplicantApplicationToWorkflow(supabase, {
      tenantId,
      applicationId: application.id,
      workflowId: workflowCheck.value,
      jobRequisitionId: application.job_requisition_id,
      workerId: application.worker_id ?? idCheck.value,
      instanceId: application.applicant_workflow_instance_id,
    });

    void writeActivityLog({
      actorUserId: auth.devBypass ? null : auth.userId,
      action: "candidate_workflow_reassigned",
      entityType: "job_applications",
      entityId: application.id,
      tenantId,
      metadata: {
        worker_id: idCheck.value,
        previous_workflow_id: application.workflow_id,
        workflow_id: workflowCheck.value,
        workflow_name: result.workflowName,
        steps_preserved: result.stepsPreserved,
      },
      request: req,
    });

    return NextResponse.json({
      ok: true,
      unchanged: false,
      applicationId: application.id,
      workflowId: workflowCheck.value,
      workflowName: result.workflowName,
      stepsPreserved: result.stepsPreserved,
      message: "Assigned workflow updated. Matching completed and in-progress steps were kept.",
    });
  } catch (err: unknown) {
    console.error("[admin/candidates/reassign-workflow POST]", err);
    if (err instanceof JobValidationError) {
      return NextResponse.json(
        { error: err.message, code: err.code, fieldErrors: err.fieldErrors },
        { status: jobValidationHttpStatus(err) }
      );
    }
    const message = err instanceof Error ? err.message : "Failed to update assigned workflow";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
