import type { SupabaseClient } from "@supabase/supabase-js";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { preparePublishedStepDrafts } from "@/lib/onboarding/prepare-published-step-drafts";
import type { TenantOnboardingConfig, TenantOnboardingStep } from "@/lib/onboarding/types";
import {
  isSerializableWorkflowState,
  orderedNodeIds,
  type SerializableWorkflowState,
} from "@/lib/onboarding/workflow-builder-serialization";
import { CONVERT_TO_WORKER_STEP_ID } from "@/lib/job-requisitions/types";

export type WorkflowSnapshot = {
  configId: string;
  flowId: string;
  flowName: string;
  steps: TenantOnboardingStep[];
  conversionNodeId: string | null;
};

function findConversionNodeId(state: SerializableWorkflowState): string | null {
  const node = state.nodes.find((n) => n.stepId === CONVERT_TO_WORKER_STEP_ID);
  return node?.id ?? null;
}

/** Materialize onboarding steps from a flow builder draft for a single applicant instance. */
export async function buildWorkflowSnapshotFromFlow(
  supabase: SupabaseClient,
  tenantId: string,
  flowId: string
): Promise<WorkflowSnapshot | null> {
  const { data: flow, error } = await supabase
    .from("onboarding_flows")
    .select("id, name, builder_draft, status")
    .eq("id", flowId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw error;
  if (!flow?.id || !isSerializableWorkflowState(flow.builder_draft)) return null;

  const existingConfig = await loadTenantOnboardingConfig(supabase, tenantId, {
    workerFacing: false,
  });
  const { steps: drafts } = preparePublishedStepDrafts(flow.builder_draft, existingConfig);
  const orderedIds = orderedNodeIds(flow.builder_draft.nodes, flow.builder_draft.edges);
  const orderIndex = new Map(orderedIds.map((id, index) => [id, index]));

  const steps: TenantOnboardingStep[] = drafts
    .filter((d) => d.is_enabled !== false)
    .map((d, index) => {
      const nodeId =
        typeof d.metadata?.workflow_node_id === "string"
          ? d.metadata.workflow_node_id
          : null;
      const sortOrder =
        nodeId && orderIndex.has(nodeId) ? (orderIndex.get(nodeId) ?? index) + 1 : index + 1;

      return {
        id: `flow-${flowId}-${d.step_key}`,
        step_key: d.step_key,
        title: d.title,
        description: d.description,
        step_type: d.step_type,
        sort_order: sortOrder,
        is_required: d.is_required,
        is_enabled: true,
        metadata: {
          ...d.metadata,
          flow_id: flowId,
          workflow_node_id: nodeId,
        },
      };
    })
    .sort((a, b) => a.sort_order - b.sort_order);

  return {
    configId: `flow-instance-${flowId}`,
    flowId,
    flowName: String(flow.name),
    steps,
    conversionNodeId: findConversionNodeId(flow.builder_draft),
  };
}

export function snapshotToTenantConfig(
  tenantId: string,
  snapshot: WorkflowSnapshot
): TenantOnboardingConfig {
  return {
    tenantId,
    configId: snapshot.configId,
    version: 1,
    steps: snapshot.steps,
  };
}

export async function createApplicantWorkflowInstance(params: {
  supabase: SupabaseClient;
  tenantId: string;
  workerId: string;
  jobRequisitionId: string;
  onboardingFlowId: string;
  actorUserId?: string | null;
  request?: Request;
}): Promise<{ instanceId: string; snapshot: WorkflowSnapshot } | null> {
  const snapshot = await buildWorkflowSnapshotFromFlow(
    params.supabase,
    params.tenantId,
    params.onboardingFlowId
  );
  if (!snapshot) return null;

  const { data: instance, error } = await params.supabase
    .from("applicant_workflow_instances")
    .insert({
      tenant_id: params.tenantId,
      worker_id: params.workerId,
      job_requisition_id: params.jobRequisitionId,
      onboarding_flow_id: params.onboardingFlowId,
      workflow_snapshot: snapshot,
      conversion_node_id: snapshot.conversionNodeId,
      conversion_status: "not_started",
    })
    .select("id")
    .single();

  if (error) throw error;

  const instanceId = String(instance.id);

  await params.supabase
    .from("worker")
    .update({
      job_requisition_id: params.jobRequisitionId,
      applicant_workflow_instance_id: instanceId,
      onboarding_flow_id: params.onboardingFlowId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.workerId);

  await params.supabase.from("applicant_requisitions").upsert(
    {
      applicant_id: params.workerId,
      requisition_id: params.jobRequisitionId,
      pipeline_status: "applied",
    },
    { onConflict: "applicant_id,requisition_id" }
  );

  void writeActivityLog({
    actorUserId: params.actorUserId ?? null,
    action: "applicant_workflow_instance_created",
    entityType: "applicant_workflow_instances",
    entityId: instanceId,
    tenantId: params.tenantId,
    metadata: {
      worker_id: params.workerId,
      job_requisition_id: params.jobRequisitionId,
      onboarding_flow_id: params.onboardingFlowId,
    },
    request: params.request,
  });

  return { instanceId, snapshot };
}

export async function loadApplicantWorkflowConfig(
  supabase: SupabaseClient,
  workerId: string,
  tenantId: string
): Promise<TenantOnboardingConfig | null> {
  const { data: worker, error: workerErr } = await supabase
    .from("worker")
    .select("applicant_workflow_instance_id")
    .eq("id", workerId)
    .maybeSingle();

  if (workerErr) throw workerErr;
  const instanceId = worker?.applicant_workflow_instance_id;
  if (!instanceId) return null;

  const { data: instance, error } = await supabase
    .from("applicant_workflow_instances")
    .select("workflow_snapshot")
    .eq("id", instanceId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw error;
  const snapshot = instance?.workflow_snapshot as WorkflowSnapshot | null;
  if (!snapshot?.steps?.length) return null;
  return snapshotToTenantConfig(tenantId, snapshot);
}
