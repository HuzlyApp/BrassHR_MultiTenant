export type WorkerFigmaProfileTabId =
  | "profile"
  | "work_history"
  | "files"
  | "skill_assessment"
  | "licenses"
  | "hire"
  | "activity";

export const WORKER_FIGMA_PROFILE_TABS: Array<{
  id: WorkerFigmaProfileTabId;
  label: string;
}> = [
  { id: "profile", label: "Profile" },
  { id: "work_history", label: "Work History" },
  { id: "files", label: "Files" },
  { id: "skill_assessment", label: "Skill Assessment" },
  { id: "licenses", label: "License/Certifications" },
  { id: "hire", label: "Post/Pre Hire" },
  { id: "activity", label: "Activity" },
];

export function isWorkerFigmaProfileTabId(value: string): value is WorkerFigmaProfileTabId {
  return WORKER_FIGMA_PROFILE_TABS.some((tab) => tab.id === value);
}

/** In-page tabs stay on workers profile; Activity deep-links to existing admin flow. */
export function workerFigmaProfileTabHref(workerId: string, tab: WorkerFigmaProfileTabId): string {
  const id = encodeURIComponent(workerId);
  switch (tab) {
    case "profile":
      return `/admin_recruiter/workers/${id}/profile`;
    case "work_history":
      return `/admin_recruiter/workers/${id}/profile?tab=work_history`;
    case "files":
      return `/admin_recruiter/workers/${id}/profile?tab=files`;
    case "skill_assessment":
      return `/admin_recruiter/workers/${id}/profile?tab=skill_assessment`;
    case "licenses":
      return `/admin_recruiter/workers/${id}/profile?tab=licenses`;
    case "hire":
      return `/admin_recruiter/workers/${id}/profile?tab=hire`;
    case "activity":
      return `/admin_recruiter/new/activities/${id}`;
  }
}

export function workerProfileHasSkillAssessmentStep(args: {
  skillAssessmentTotal?: number | null;
  onboardingSteps?: Array<{ id?: string; label?: string; step_key?: string; step_type?: string }>;
}): boolean {
  if ((args.skillAssessmentTotal ?? 0) > 0) return true;
  return (args.onboardingSteps ?? []).some((step) => {
    const key = `${step.id ?? ""} ${step.label ?? ""} ${step.step_key ?? ""} ${step.step_type ?? ""}`.toLowerCase();
    return key.includes("skill_assessment") || key.includes("skill assessment");
  });
}
