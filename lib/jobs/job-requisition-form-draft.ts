import type { JobScreeningQuestionInput } from "@/lib/jobs/screening-questions";
import type { JobRequisitionInput, PlacementType } from "@/lib/jobs/types";
import type { JobFormStep, JobFormUiState } from "@/app/admin_recruiter/jobs/job-form-shared";

/** In-progress job requisition form so legal pages can return without losing data. */

export type JobRequisitionFormDraft = {
  jobId: string | null;
  step: JobFormStep;
  job: JobRequisitionInput;
  ui: JobFormUiState;
  mspSourcedByClient: boolean | null;
  mspPlacementType: PlacementType | null;
  referenceJobId: string | null;
  assignmentMode: "automatic" | "manual";
  overrideWorkflowId: string | null;
  termsAccepted: boolean;
  screeningQuestions: JobScreeningQuestionInput[];
  confirmRoutingChange: boolean;
};

const STORAGE_KEY = "braasJobRequisitionFormInProgress";

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export function readJobRequisitionFormDraft(
  jobId: string | null
): JobRequisitionFormDraft | null {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<JobRequisitionFormDraft>;
    if (!parsed || typeof parsed !== "object" || !parsed.job) return null;

    const draftJobId = parsed.jobId?.trim() || null;
    const currentJobId = jobId?.trim() || null;
    if (draftJobId !== currentJobId) return null;

    return {
      jobId: draftJobId,
      step: parsed.step ?? "setup",
      job: parsed.job as JobRequisitionInput,
      ui: (parsed.ui ?? {}) as JobFormUiState,
      mspSourcedByClient:
        typeof parsed.mspSourcedByClient === "boolean" ? parsed.mspSourcedByClient : null,
      mspPlacementType: parsed.mspPlacementType ?? null,
      referenceJobId: parsed.referenceJobId?.trim() || null,
      assignmentMode: parsed.assignmentMode === "manual" ? "manual" : "automatic",
      overrideWorkflowId: parsed.overrideWorkflowId?.trim() || null,
      termsAccepted: Boolean(parsed.termsAccepted),
      screeningQuestions: Array.isArray(parsed.screeningQuestions)
        ? (parsed.screeningQuestions as JobScreeningQuestionInput[])
        : [],
      confirmRoutingChange: Boolean(parsed.confirmRoutingChange),
    };
  } catch {
    return null;
  }
}

export function writeJobRequisitionFormDraft(draft: JobRequisitionFormDraft): void {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota / privacy errors */
  }
}

export function clearJobRequisitionFormDraft(): void {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
