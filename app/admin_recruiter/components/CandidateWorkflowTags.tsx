"use client";

import type { CandidateWorkflowTag } from "@/lib/onboarding/candidate-workflow-phase-view";
import { lifecyclePhaseLabel } from "@/lib/onboarding/workflow-phase-groups";

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function tagLabel(tag: CandidateWorkflowTag): string {
  const type = tag.workflowType?.trim();
  if (type && !tag.workflowName.toLowerCase().includes(type.toLowerCase())) {
    return `${tag.workflowName} ${type.toUpperCase()}`;
  }
  return tag.workflowName;
}

export default function CandidateWorkflowTags({ tags }: { tags: CandidateWorkflowTag[] }) {
  if (!tags.length) {
    return (
      <p className="mb-3 text-xs text-slate-500">No workflow assignments are stored for this candidate.</p>
    );
  }

  return (
    <div className="mb-4 flex flex-wrap gap-1.5" aria-label="Assigned workflows">
      {tags.map((tag) => {
        const phaseText =
          tag.phase === "both"
            ? "Pre-Hire + Post-Hire"
            : lifecyclePhaseLabel(tag.phase);
        const assigned = formatDate(tag.assignedAt);
        const title = [
          tag.workflowName,
          tag.workflowType ? `Type: ${tag.workflowType}` : null,
          `Phase: ${phaseText}`,
          tag.version ? `Version ${tag.version}` : null,
          assigned ? `Assigned ${assigned}` : null,
          tag.assignmentState,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <span
            key={tag.id}
            title={title}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
              tag.active
                ? "border-[color:var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)] text-[#111827]"
                : "border-slate-200 bg-slate-50 text-slate-500"
            }`}
          >
            {tagLabel(tag)}
            <span className="font-medium text-slate-500">
              {tag.phase === "both" ? "Pre/Post" : lifecyclePhaseLabel(tag.phase)}
            </span>
            {tag.version ? <span className="font-normal text-slate-400">v{tag.version}</span> : null}
            {tag.active ? null : (
              <span className="font-normal capitalize text-slate-400">{tag.assignmentState}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
