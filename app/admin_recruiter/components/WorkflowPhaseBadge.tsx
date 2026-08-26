import { lifecyclePhaseLabel, type EmploymentLifecyclePhase } from "@/lib/onboarding/workflow-phase-groups";

export default function WorkflowPhaseBadge({
  phase,
  className = "",
}: {
  phase: EmploymentLifecyclePhase;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ${className}`}
    >
      {lifecyclePhaseLabel(phase)}
    </span>
  );
}
