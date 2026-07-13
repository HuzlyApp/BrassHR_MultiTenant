import type { SupabaseClient } from "@supabase/supabase-js";
import { getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation";
import type { WorkflowSnapshot } from "@/lib/job-requisitions/applicant-workflow-instance";
import { CONVERT_TO_WORKER_STEP_ID } from "@/lib/job-requisitions/types";

export type ConversionReadiness = {
  ready: boolean;
  reason?: string;
  conversionNodeId?: string | null;
};

export async function evaluateConversionReadiness(
  supabase: SupabaseClient,
  workerId: string
): Promise<ConversionReadiness> {
  const { data: worker, error } = await supabase
    .from("worker")
    .select("id, status, applicant_workflow_instance_id, conversion_status")
    .eq("id", workerId)
    .maybeSingle();

  if (error) throw error;
  if (!worker?.id) return { ready: false, reason: "Candidate not found" };
  if (worker.conversion_status === "completed" || worker.status === "converted") {
    return { ready: false, reason: "Candidate already converted" };
  }
  if (worker.status !== "approved") {
    return { ready: false, reason: "Only approved candidates can be converted" };
  }

  if (!worker.applicant_workflow_instance_id) {
    return { ready: true, conversionNodeId: null };
  }

  const { data: instance, error: instanceErr } = await supabase
    .from("applicant_workflow_instances")
    .select("workflow_snapshot, conversion_node_id, conversion_status")
    .eq("id", worker.applicant_workflow_instance_id)
    .maybeSingle();

  if (instanceErr) throw instanceErr;
  if (!instance) return { ready: true, conversionNodeId: null };

  const snapshot = instance.workflow_snapshot as WorkflowSnapshot | null;
  const conversionNodeId = instance.conversion_node_id;
  if (!conversionNodeId || !snapshot?.steps?.length) {
    return { ready: true, conversionNodeId };
  }

  const conversionStep = snapshot.steps.find(
    (step) =>
      step.metadata?.workflow_step_id === CONVERT_TO_WORKER_STEP_ID ||
      step.metadata?.workflow_node_id === conversionNodeId
  );
  const stepsBeforeConversion = getEnabledTenantSteps({
    tenantId: "",
    configId: snapshot.configId,
    version: 1,
    steps: snapshot.steps.filter((step) => {
      if (!conversionStep) return true;
      return step.sort_order < conversionStep.sort_order;
    }),
  });

  const { data: progress } = await supabase
    .from("worker_onboarding_progress")
    .select("id")
    .eq("worker_id", workerId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!progress?.id) {
    return { ready: false, reason: "Workflow progress not initialized" };
  }

  const requiredStepIds = stepsBeforeConversion
    .filter((step) => step.is_required)
    .map((step) => step.id);

  if (!requiredStepIds.length) {
    return { ready: true, conversionNodeId };
  }

  const { data: completedSteps, error: stepsErr } = await supabase
    .from("worker_onboarding_step_progress")
    .select("flow_step_id, onboarding_step_id, status")
    .eq("worker_onboarding_progress_id", progress.id);

  if (stepsErr) throw stepsErr;

  const completed = new Set(
    (completedSteps ?? [])
      .filter((row) => row.status === "completed")
      .map((row) => String(row.flow_step_id ?? row.onboarding_step_id))
  );

  const incomplete = requiredStepIds.filter((id) => !completed.has(id));
  if (incomplete.length) {
    return {
      ready: false,
      reason: "Required workflow tasks before conversion are not complete.",
      conversionNodeId,
    };
  }

  return { ready: true, conversionNodeId };
}
