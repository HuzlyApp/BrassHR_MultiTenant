import { describe, expect, it } from "vitest";
import {
  assignmentSourceLabel,
  buildPhaseAssignment,
  mapAssignedStepRecords,
  mapProgressToDisplayStatus,
  matchTenantStepForAssignedRecord,
  resolveAssignmentSource,
  sanitizeTagsForClient,
} from "@/lib/onboarding/assigned-workflow-steps";
import type { TenantOnboardingStep } from "@/lib/onboarding/types";

function tenantStep(
  partial: Partial<TenantOnboardingStep> & Pick<TenantOnboardingStep, "id" | "step_key" | "title" | "step_type">
): TenantOnboardingStep {
  return {
    description: null,
    sort_order: 10,
    is_required: true,
    is_enabled: true,
    metadata: {},
    ...partial,
  };
}

describe("assigned workflow steps", () => {
  it("maps snapshot step-{key} onto the assigned tenant step, not by title", () => {
    const resume = tenantStep({
      id: "tenant-resume",
      step_key: "resume_upload",
      title: "Upload Resume",
      step_type: "resume_upload",
    });
    const other = tenantStep({
      id: "tenant-other",
      step_key: "professional_license",
      title: "Upload Resume",
      step_type: "professional_license",
    });
    const matched = matchTenantStepForAssignedRecord(
      {
        id: "rec-1",
        snapshot_step_id: "step-resume_upload",
        title: "Upload Resume",
        step_type: "resume-basic-profile",
        is_required: true,
        position: 1,
        phase: "pre_hire",
        settings: {},
      },
      [other, resume],
      new Set()
    );
    expect(matched?.id).toBe("tenant-resume");
  });

  it("does not guess a tenant step from a colliding title", () => {
    const first = tenantStep({
      id: "a",
      step_key: "custom_a",
      title: "Background Check",
      step_type: "custom_question",
      metadata: { workflow_step_id: "custom-step" },
    });
    const second = tenantStep({
      id: "b",
      step_key: "custom_b",
      title: "Background Check",
      step_type: "custom_question",
      metadata: { workflow_step_id: "custom-step" },
    });
    const matched = matchTenantStepForAssignedRecord(
      {
        id: "rec-2",
        snapshot_step_id: "w2-07",
        title: "Background Check",
        step_type: "background-check",
        is_required: true,
        position: 7,
        phase: "pre_hire",
        settings: {},
      },
      [first, second],
      new Set()
    );
    expect(matched).toBeNull();
  });

  it("uses workflow instance progress, not a similarly named document", () => {
    const resume = tenantStep({
      id: "tenant-resume",
      step_key: "resume_upload",
      title: "Upload Resume",
      step_type: "resume_upload",
    });
    const mapped = mapAssignedStepRecords({
      records: [
        {
          id: "rec-1",
          snapshot_step_id: "step-resume_upload",
          title: "Upload Resume",
          step_type: "resume-basic-profile",
          is_required: true,
          position: 1,
          phase: "pre_hire",
          status: "pending",
          settings: {},
        },
      ],
      tenantSteps: [resume],
      progressByStepId: new Map([["tenant-resume", { onboarding_step_id: "tenant-resume", status: "completed" }]]),
    });
    expect(mapped[0]?.status).toBe("completed");
    expect(mapped[0]?.displayStatus).toBe("completed");
    expect(mapped[0]?.tenantStepId).toBe("tenant-resume");
  });

  it("prefers job mapping over manual when the workflow id is mapped", () => {
    expect(resolveAssignmentSource({ workflowId: "flow-1", mappedWorkflowIds: ["flow-1"] })).toBe(
      "job_mapping"
    );
    expect(resolveAssignmentSource({ workflowId: "flow-2", mappedWorkflowIds: ["flow-1"] })).toBe("manual");
    expect(assignmentSourceLabel("job_mapping")).toBe("Job mapping");
  });

  it("strips Post-Hire tags before conversion", () => {
    const tags = sanitizeTagsForClient(
      [
        { id: "1", phase: "pre_hire" as const },
        { id: "2", phase: "both" as const },
        { id: "3", phase: "post_hire" as const },
      ],
      false
    );
    expect(tags.map((tag) => tag.phase)).toEqual(["pre_hire", "pre_hire"]);
  });

  it("builds assignment metadata from the assigned instance", () => {
    const assignment = buildPhaseAssignment({
      workflowName: "CNA Pre-Hire",
      version: "2026-08-01T00:00:00.000Z",
      assignedAt: "2026-08-02T00:00:00.000Z",
      assignmentSource: "job_mapping",
      phase: "pre_hire",
      steps: [
        { title: "Upload Resume", status: "completed" },
        { title: "Skill Assessment", status: "in_progress" },
      ],
    });
    expect(assignment.currentStepTitle).toBe("Skill Assessment");
    expect(assignment.completedCount).toBe(1);
    expect(assignment.totalCount).toBe(2);
  });

  it("maps document review onto display status without inventing completion", () => {
    expect(mapProgressToDisplayStatus("pending")).toBe("not_started");
    expect(mapProgressToDisplayStatus("completed", "rejected")).toBe("rejected");
    expect(mapProgressToDisplayStatus("completed", "approved")).toBe("approved");
  });
});
