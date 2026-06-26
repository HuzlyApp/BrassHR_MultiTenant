import type { SupabaseClient } from "@supabase/supabase-js";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress";

type StepState = "complete" | "in_progress" | "pending";

export type DynamicProgressStep = {
  id: string;
  stepKey: string;
  label: string;
  state: StepState;
  detail?: string;
};

export type DynamicProgressResult = {
  steps: DynamicProgressStep[];
  configVersion: number;
  completedSteps: number;
  totalSteps: number;
  completionPercent: number;
};

export async function mapDynamicAdminOnboardingProgress(
  supabase: SupabaseClient,
  workerId: string,
  tenantId: string
): Promise<DynamicProgressResult> {
  const config = await loadTenantOnboardingConfig(supabase, tenantId, { workerFacing: true });
  if (!config) {
    return { steps: [], configVersion: 0, completedSteps: 0, totalSteps: 0, completionPercent: 0 };
  }

  const progress = await ensureWorkerOnboardingProgress(supabase, workerId, tenantId);
  const byStep = new Map(progress.steps.map((s) => [s.onboarding_step_id, s]));

  const steps: DynamicProgressStep[] = [];

  for (const step of config.steps.filter((s) => s.is_enabled)) {
    const prog = byStep.get(step.id);
    const status = prog?.status ?? "pending";
    let state: StepState = "pending";
    if (status === "completed" || status === "skipped") state = "complete";
    else if (status === "in_progress" || status === "failed") state = "in_progress";

    let detail: string | undefined;

    if (step.step_type === "resume_upload") {
      const { data: resume } = await supabase
        .from("worker_resumes")
        .select("parsing_status")
        .eq("worker_id", workerId)
        .maybeSingle();
      if (resume) {
        detail = `Parsing: ${resume.parsing_status ?? "pending"}`;
      }
    }

    if (step.step_type === "skill_assessment") {
      const assessments = config.skillAssessments.filter((a) => a.onboarding_step_id === step.id);
      let total = 0;
      let answered = 0;
      for (const a of assessments) {
        total += a.questions.filter((q) => q.is_required).length;
        const { count } = await supabase
          .from("worker_skill_assessment_answers")
          .select("id", { count: "exact", head: true })
          .eq("worker_id", workerId)
          .eq("assessment_id", a.id);
        answered += count ?? 0;
      }
      if (total > 0) detail = `${answered} of ${total} answered`;
    }

    if (step.step_type === "document_upload" || step.step_type === "authorizations") {
      const docs = config.requiredDocuments.filter((d) => d.onboarding_step_id === step.id);
      const required = docs.filter((d) => d.is_required);
      if (required.length) {
        const { data: uploads } = await supabase
          .from("worker_submitted_documents")
          .select("required_document_id, status")
          .eq("worker_id", workerId);
        const uploaded = required.filter((d) =>
          (uploads ?? []).some((u) => String(u.required_document_id) === d.id)
        ).length;
        detail = `${uploaded} of ${required.length} documents`;
      }
    }

    steps.push({
      id: step.id,
      stepKey: step.step_key,
      label: step.title,
      state,
      detail,
    });
  }

  const totalSteps = steps.length;
  const completedSteps = steps.filter((s) => s.state === "complete").length;
  const completionPercent =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return { steps, configVersion: config.version, completedSteps, totalSteps, completionPercent };
}
