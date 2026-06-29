export const CANDIDATE_PIPELINE_STEP_LABELS = [
  "Application Received",
  "Screening",
  "Assessment",
  "Interview",
  "Reference Check",
  "Final Approval",
] as const;

export type CandidatePipelineStepLabel = (typeof CANDIDATE_PIPELINE_STEP_LABELS)[number];

export type CandidatePipelineStep = {
  id: string;
  label: CandidatePipelineStepLabel;
  completed: boolean;
};

type ChecklistRow = {
  id: string;
  state?: string;
  checked?: boolean;
};

type ChecklistSection = {
  id: string;
  rows: ChecklistRow[];
};

type SkillAssessments = {
  completed?: number;
  total?: number;
};

type ProfileWorker = {
  id?: string;
  created_at?: string | null;
  status?: string | null;
};

export type CandidatePipelineProfilePayload = {
  worker?: ProfileWorker;
  skillAssessments?: SkillAssessments;
  references?: unknown[];
};

export type CandidatePipelineChecklistPayload = {
  worker?: { status?: string | null };
  sections?: ChecklistSection[];
};

function findChecklistRow(
  sections: ChecklistSection[] | undefined,
  id: string
): ChecklistRow | null {
  for (const section of sections ?? []) {
    const row = section.rows.find((item) => item.id === id);
    if (row) return row;
  }
  return null;
}

function rowIsPassed(row: ChecklistRow | null): boolean {
  if (!row) return false;
  return (
    row.checked === true ||
    row.state === "complete" ||
    row.state === "uploaded" ||
    row.state === "answered"
  );
}

function sectionRowsPassed(sections: ChecklistSection[] | undefined, sectionId: string): boolean {
  const section = (sections ?? []).find((item) => item.id === sectionId);
  if (!section || section.rows.length === 0) return false;
  return section.rows.every((row) => rowIsPassed(row));
}

export function buildCandidatePipelineSteps(
  profile: CandidatePipelineProfilePayload,
  checklist: CandidatePipelineChecklistPayload
): CandidatePipelineStep[] {
  const sections = checklist.sections ?? [];
  const worker = profile.worker ?? {};
  const statusNorm = (worker.status ?? checklist.worker?.status ?? "new")
    .toString()
    .trim()
    .toLowerCase();

  const skillTotal = profile.skillAssessments?.total ?? 0;
  const skillCompleted = profile.skillAssessments?.completed ?? 0;
  const assessmentDone = skillTotal > 0 && skillCompleted >= skillTotal;

  const referencesCount = Array.isArray(profile.references) ? profile.references.length : 0;

  const applicationReceived = Boolean(worker.id || worker.created_at);
  const screeningDone = rowIsPassed(findChecklistRow(sections, "call_1"));
  const interviewDone = rowIsPassed(findChecklistRow(sections, "call_2"));
  const referenceDone = referencesCount > 0;
  const finalDone =
    statusNorm === "approved" ||
    statusNorm === "converted" ||
    statusNorm === "disapproved" ||
    sectionRowsPassed(sections, "final");

  return [
    { id: "application_received", label: "Application Received", completed: applicationReceived },
    { id: "screening", label: "Screening", completed: screeningDone },
    { id: "assessment", label: "Assessment", completed: assessmentDone },
    { id: "interview", label: "Interview", completed: interviewDone },
    { id: "reference_check", label: "Reference Check", completed: referenceDone },
    { id: "final_approval", label: "Final Approval", completed: finalDone },
  ];
}

export function pipelineConnectorFillPercent(steps: CandidatePipelineStep[]): number {
  if (steps.length <= 1) return 0;
  let lastCompletedIndex = -1;
  steps.forEach((step, index) => {
    if (step.completed) lastCompletedIndex = index;
  });
  if (lastCompletedIndex < 0) return 0;
  if (lastCompletedIndex >= steps.length - 1) return 100;
  return (lastCompletedIndex / (steps.length - 1)) * 100;
}
