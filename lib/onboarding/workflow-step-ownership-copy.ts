/** Who acts on a workflow step, as shown in the staff step drawer. */
export type WorkflowStepOwnershipCopy = {
  /** Short badge / footer label. */
  badge: string;
  /** "Step for" value in the overview. */
  stepFor: string;
  /** One-line hint under the badge. */
  note: string;
};

export function workflowStepOwnershipCopy(params: {
  kind: string | null | undefined;
  staffCanAct: boolean;
}): WorkflowStepOwnershipCopy {
  if (params.staffCanAct) {
    return {
      badge: "Recruiter step",
      stepFor: "Recruiter step",
      note: "Complete it here to unlock the candidate's next step.",
    };
  }
  if (params.kind === "resume") {
    return {
      badge: "Candidate or recruiter step",
      stepFor: "Candidate or recruiter can upload resume",
      note: "Read-only. The resume can be uploaded by the candidate or by a recruiter.",
    };
  }
  return {
    badge: "Candidate step",
    stepFor: "Candidate step",
    note: "Read-only submission from the candidate.",
  };
}
