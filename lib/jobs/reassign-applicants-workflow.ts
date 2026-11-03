import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getOnboardingFlowById } from "@/lib/onboarding/onboarding-flows";
import {
  buildStepRecordRow,
  snapshotNodes,
  type StepRecordRow,
} from "@/lib/onboarding/sync-workflow-instances";
import { JobValidationError } from "@/lib/jobs/types";

type DbClient = SupabaseClient;

type ExistingStepRecord = StepRecordRow & {
  id: string;
  status: string | null;
  completed_at: string | null;
  status_changed_at: string | null;
  status_changed_by: string | null;
  status_changed_by_name: string | null;
  completed_by: string | null;
  review_decision: string | null;
  review_note: string | null;
};

type PreservedStatusFields = Pick<
  ExistingStepRecord,
  | "status"
  | "completed_at"
  | "status_changed_at"
  | "status_changed_by"
  | "status_changed_by_name"
  | "completed_by"
  | "review_decision"
  | "review_note"
>;

const STEP_SELECT =
  "id, tenant_id, workflow_instance_id, snapshot_step_id, position, title, step_type, is_required, phase, settings, status, completed_at, status_changed_at, status_changed_by, status_changed_by_name, completed_by, review_decision, review_note";

const PARKED_POSITION_OFFSET = 100_000;
const BATCH_SIZE = 100;

function chunk<T>(items: T[], size = BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function norm(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function preservedStatus(record: ExistingStepRecord): PreservedStatusFields {
  return {
    status: record.status ?? "pending",
    completed_at: record.completed_at,
    status_changed_at: record.status_changed_at,
    status_changed_by: record.status_changed_by,
    status_changed_by_name: record.status_changed_by_name,
    completed_by: record.completed_by,
    review_decision: record.review_decision,
    review_note: record.review_note,
  };
}

/**
 * Match an old applicant step onto a new workflow node so completed / in-progress
 * status can be carried across when a job's assigned workflow changes (e.g. R&R → IT).
 */
export function matchExistingStepForWorkflowNode(
  fresh: StepRecordRow,
  oldRecords: ExistingStepRecord[],
  usedOldIds: Set<string>
): ExistingStepRecord | null {
  const available = oldRecords.filter((record) => !usedOldIds.has(record.id));
  if (!available.length) return null;

  const bySnapshot = available.find(
    (record) => record.snapshot_step_id === fresh.snapshot_step_id
  );
  if (bySnapshot) return bySnapshot;

  const byTypePhaseTitle = available.find(
    (record) =>
      norm(record.step_type) === norm(fresh.step_type) &&
      record.phase === fresh.phase &&
      norm(record.title) === norm(fresh.title)
  );
  if (byTypePhaseTitle) return byTypePhaseTitle;

  const byTypePhase = available.find(
    (record) =>
      norm(record.step_type) === norm(fresh.step_type) && record.phase === fresh.phase
  );
  if (byTypePhase) return byTypePhase;

  return (
    available.find((record) => norm(record.step_type) === norm(fresh.step_type)) ?? null
  );
}

export function planApplicantWorkflowReassignment(params: {
  tenantId: string;
  instanceId: string;
  nodes: ReturnType<typeof snapshotNodes>;
  oldRecords: ExistingStepRecord[];
}): {
  deleteIds: string[];
  updates: Array<StepRecordRow & { id: string } & PreservedStatusFields>;
  inserts: StepRecordRow[];
} {
  const usedOldIds = new Set<string>();
  const updates: Array<StepRecordRow & { id: string } & PreservedStatusFields> = [];
  const inserts: StepRecordRow[] = [];

  params.nodes.forEach((node, index) => {
    const fresh = buildStepRecordRow(params.tenantId, params.instanceId, node, index);
    const match = matchExistingStepForWorkflowNode(fresh, params.oldRecords, usedOldIds);
    if (match) {
      usedOldIds.add(match.id);
      updates.push({
        ...fresh,
        id: match.id,
        ...preservedStatus(match),
      });
      return;
    }
    inserts.push(fresh);
  });

  const deleteIds = params.oldRecords
    .filter((record) => !usedOldIds.has(record.id))
    .map((record) => record.id);

  return { deleteIds, updates, inserts };
}

type PublishedFlowForReassign = {
  nodes: ReturnType<typeof snapshotNodes>;
  workflowName: string;
  workflowVersion: string;
  snapshot: unknown;
};

async function loadPublishedFlowForReassign(
  supabase: DbClient,
  tenantId: string,
  workflowId: string
): Promise<PublishedFlowForReassign> {
  const flow = await getOnboardingFlowById(supabase, tenantId, workflowId);
  if (!flow) {
    throw new JobValidationError(
      "The selected workflow is unavailable.",
      {},
      "WORKFLOW_UNAVAILABLE"
    );
  }
  if (flow.status !== "published") {
    throw new JobValidationError(
      "Only published workflows can be assigned.",
      {},
      "WORKFLOW_UNAVAILABLE"
    );
  }
  if (!flow.builderDraft || !Array.isArray(flow.builderDraft.nodes) || !flow.builderDraft.nodes.length) {
    throw new JobValidationError(
      "The selected workflow has no applicant steps.",
      {},
      "WORKFLOW_UNAVAILABLE"
    );
  }
  return {
    nodes: snapshotNodes(flow.builderDraft),
    workflowName: String(flow.name ?? "Workflow"),
    workflowVersion: String(flow.updatedAt ?? new Date().toISOString()),
    snapshot: flow.builderDraft ?? { nodes: [], edges: [] },
  };
}

/**
 * Reassign one job application to a published workflow, preserving completed /
 * in-progress status on matching Pre-Hire and Post-Hire steps.
 */
export async function reassignApplicantApplicationToWorkflow(
  supabase: DbClient,
  params: {
    tenantId: string;
    applicationId: string;
    workflowId: string;
    jobRequisitionId?: string | null;
    workerId?: string | null;
    instanceId?: string | null;
    flow?: PublishedFlowForReassign;
  }
): Promise<{ stepsPreserved: number; workflowName: string }> {
  const flow =
    params.flow ??
    (await loadPublishedFlowForReassign(supabase, params.tenantId, params.workflowId));
  const { nodes, workflowName, workflowVersion, snapshot } = flow;

  let instanceId = params.instanceId?.trim() || null;

  const { error: appUpdateError } = await supabase
    .from("job_applications")
    .update({ workflow_id: params.workflowId })
    .eq("id", params.applicationId)
    .eq("tenant_id", params.tenantId);
  if (appUpdateError) throw appUpdateError;

  if (!instanceId) {
    let created: { id: string } | null = null;
    let createError: { message?: string } | null = null;
    const fullInsert = await supabase
      .from("applicant_workflow_instances")
      .insert({
        tenant_id: params.tenantId,
        application_id: params.applicationId,
        workflow_id: params.workflowId,
        worker_id: params.workerId ?? null,
        job_requisition_id: params.jobRequisitionId ?? null,
        onboarding_flow_id: params.workflowId,
        workflow_name: workflowName,
        workflow_snapshot: snapshot,
        workflow_version: workflowVersion,
        status: "in_progress",
        assignment_state: "active",
      })
      .select("id")
      .single();
    created = fullInsert.data;
    createError = fullInsert.error;
    if (
      createError &&
      /onboarding_flow_id|job_requisition_id|assignment_state|Could not find/i.test(
        String(createError.message ?? "")
      )
    ) {
      const retry = await supabase
        .from("applicant_workflow_instances")
        .insert({
          tenant_id: params.tenantId,
          application_id: params.applicationId,
          workflow_id: params.workflowId,
          workflow_name: workflowName,
          workflow_snapshot: snapshot,
          workflow_version: workflowVersion,
          status: "in_progress",
        })
        .select("id")
        .single();
      created = retry.data;
      createError = retry.error;
    }
    if (createError || !created?.id) {
      throw createError ?? new Error("Failed to create workflow instance");
    }
    instanceId = String(created.id);
    if (nodes.length) {
      const { error: insertError } = await supabase
        .from("applicant_workflow_step_records")
        .insert(
          nodes.map((node, index) =>
            buildStepRecordRow(params.tenantId, instanceId!, node, index)
          )
        );
      if (insertError) throw insertError;
    }
    await supabase
      .from("job_applications")
      .update({ applicant_workflow_instance_id: instanceId })
      .eq("id", params.applicationId)
      .eq("tenant_id", params.tenantId);
    return { stepsPreserved: 0, workflowName };
  }

  const { data: oldRecords, error: stepsError } = await supabase
    .from("applicant_workflow_step_records")
    .select(STEP_SELECT)
    .eq("tenant_id", params.tenantId)
    .eq("workflow_instance_id", instanceId)
    .order("position");
  if (stepsError) throw stepsError;

  const plan = planApplicantWorkflowReassignment({
    tenantId: params.tenantId,
    instanceId,
    nodes,
    oldRecords: (oldRecords ?? []) as ExistingStepRecord[],
  });
  const stepsPreserved = plan.updates.filter(
    (row) => row.status === "completed" || row.status === "in_progress"
  ).length;

  for (const batch of chunk(plan.deleteIds)) {
    const { error } = await supabase
      .from("applicant_workflow_step_records")
      .delete()
      .in("id", batch);
    if (error) throw error;
  }
  for (const batch of chunk(plan.updates)) {
    const { error } = await supabase
      .from("applicant_workflow_step_records")
      .upsert(
        batch.map((row) => ({ ...row, position: row.position + PARKED_POSITION_OFFSET })),
        { onConflict: "id" }
      );
    if (error) throw error;
  }
  for (const batch of chunk(plan.updates)) {
    const { error } = await supabase
      .from("applicant_workflow_step_records")
      .upsert(batch, { onConflict: "id" });
    if (error) throw error;
  }
  for (const batch of chunk(plan.inserts)) {
    const { error } = await supabase.from("applicant_workflow_step_records").insert(batch);
    if (error) throw error;
  }

  const instancePatch: Record<string, unknown> = {
    workflow_id: params.workflowId,
    onboarding_flow_id: params.workflowId,
    workflow_name: workflowName,
    workflow_snapshot: snapshot,
    workflow_version: workflowVersion,
  };
  if (params.jobRequisitionId) {
    instancePatch.job_requisition_id = params.jobRequisitionId;
  }
  let { error: instanceError } = await supabase
    .from("applicant_workflow_instances")
    .update(instancePatch)
    .eq("id", instanceId)
    .eq("tenant_id", params.tenantId);
  if (instanceError) {
    const message = String(instanceError.message ?? "");
    if (/onboarding_flow_id|job_requisition_id|Could not find/i.test(message)) {
      const retry = await supabase
        .from("applicant_workflow_instances")
        .update({
          workflow_id: params.workflowId,
          workflow_name: workflowName,
          workflow_snapshot: snapshot,
          workflow_version: workflowVersion,
        })
        .eq("id", instanceId)
        .eq("tenant_id", params.tenantId);
      instanceError = retry.error;
    }
  }
  if (instanceError) throw instanceError;

  return { stepsPreserved, workflowName };
}

/**
 * Point every active applicant on a job at a newly assigned published workflow,
 * preserving completed / in-progress status on matching Pre-Hire and Post-Hire steps.
 */
export async function reassignJobApplicantsToWorkflow(
  supabase: DbClient,
  params: {
    tenantId: string;
    jobId: string;
    workflowId: string;
  }
): Promise<{ applications: number; instances: number; stepsPreserved: number }> {
  const flow = await loadPublishedFlowForReassign(
    supabase,
    params.tenantId,
    params.workflowId
  );

  const { data: applications, error: appsError } = await supabase
    .from("job_applications")
    .select("id, applicant_workflow_instance_id, worker_id")
    .eq("tenant_id", params.tenantId)
    .eq("job_requisition_id", params.jobId)
    .neq("status", "withdrawn");
  if (appsError) throw appsError;
  if (!applications?.length) {
    return { applications: 0, instances: 0, stepsPreserved: 0 };
  }

  let stepsPreserved = 0;
  for (const application of applications) {
    const result = await reassignApplicantApplicationToWorkflow(supabase, {
      tenantId: params.tenantId,
      applicationId: String(application.id),
      workflowId: params.workflowId,
      jobRequisitionId: params.jobId,
      workerId: application.worker_id != null ? String(application.worker_id) : null,
      instanceId:
        application.applicant_workflow_instance_id != null
          ? String(application.applicant_workflow_instance_id)
          : null,
      flow,
    });
    stepsPreserved += result.stepsPreserved;
  }

  return {
    applications: applications.length,
    instances: applications.length,
    stepsPreserved,
  };
}
