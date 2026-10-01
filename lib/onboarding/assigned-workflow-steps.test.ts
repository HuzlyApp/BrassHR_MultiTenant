import { describe, expect, it } from "vitest";
import {
  stepDecision,
  stepDisplayStatusLabel,
  assignmentSourceLabel,
  buildPhaseAssignment,
  enrichAssignedStepsDisplayFromEvidence,
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

describe("stepDisplayStatusLabel", () => {
  it("labels reference verification by staff decision and never shows Not Started", () => {
    const stepType = "reference-verification";
    expect(stepDisplayStatusLabel({ stepType, displayStatus: "not_started" })).toBe("Need to Verify");
    expect(stepDisplayStatusLabel({ stepType, displayStatus: "in_progress" })).toBe("Need to Review");
    expect(stepDisplayStatusLabel({ stepType, displayStatus: "completed" })).toBe("Verified");
    expect(stepDisplayStatusLabel({ stepType, displayStatus: "blocked" })).toBe("Rejected");
  });

  it("reports the staff decision so the Hire Journey row can show a status pill", () => {
    const stepType = "reference-verification";
    expect(stepDecision({ stepType, displayStatus: "not_started" })).toBeNull();
    expect(stepDecision({ stepType, displayStatus: "completed" })).toEqual({ action: "complete", label: "Verified" });
    expect(stepDecision({ stepType, displayStatus: "in_progress" })).toEqual({
      action: "needs_review",
      label: "Need to Review",
    });
    expect(stepDecision({ stepType, displayStatus: "blocked" })).toEqual({ action: "reject", label: "Rejected" });
    expect(stepDecision({ stepType: "screening", displayStatus: "completed" })).toBeNull();
  });

  it("labels Internal Select as Selected / On Hold / Not Selected and Pending Decision while undecided", () => {
    const stepType = "internal-select";
    expect(stepDisplayStatusLabel({ stepType, displayStatus: "not_started" })).toBe("Pending Decision");
    expect(stepDecision({ stepType, displayStatus: "completed" })?.label).toBe("Selected");
    expect(stepDecision({ stepType, displayStatus: "in_progress" })?.label).toBe("On Hold");
    expect(stepDecision({ stepType, displayStatus: "blocked" })?.label).toBe("Not Selected");
  });

  it("always maps Internal Select and Reference Verification as optional", () => {
    const records = ["internal-select", "reference-verification", "interview-qualification"].map((type, index) => ({
      id: `rec-${index}`,
      snapshot_step_id: `node-${index}`,
      title: type,
      step_type: type,
      is_required: true,
      position: index,
    }));
    const mapped = mapAssignedStepRecords({ records, tenantSteps: [], progressByStepId: new Map(), assignedAt: null });
    expect(mapped.map((step) => step.required)).toEqual([false, false, true]);
  });

  it("keeps generic labels for other steps, including candidate reference collection", () => {
    expect(stepDisplayStatusLabel({ stepType: "references-collection", displayStatus: "not_started" })).toBe(
      "Not Started"
    );
    expect(stepDisplayStatusLabel({ stepType: "screening", displayStatus: "completed" })).toBe("Completed");
  });
});

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

  it("links a record to a disabled tenant step by workflow node id and reads its progress", () => {
    const skill = tenantStep({
      id: "tenant-skill",
      step_key: "skill_assessment",
      title: "Skill / Qualification Assessment",
      step_type: "skill_assessment",
      is_enabled: false,
      metadata: { workflow_node_id: "w2-figma-07", workflow_step_id: "skill-qualification-assessment" },
    });
    const [mapped] = mapAssignedStepRecords({
      records: [
        {
          id: "rec-skill",
          snapshot_step_id: "w2-figma-07",
          title: "Skill / Qualification Assessment",
          step_type: "skill-qualification-assessment",
          is_required: true,
          position: 4,
          phase: "pre_hire",
          status: "pending",
          settings: {},
        },
      ],
      tenantSteps: [skill],
      progressByStepId: new Map([
        ["tenant-skill", { onboarding_step_id: "tenant-skill", status: "in_progress", data: {} }],
      ]),
    });
    expect(mapped?.tenantStepId).toBe("tenant-skill");
    expect(mapped?.status).toBe("in_progress");
    expect(mapped?.displayStatus).toBe("in_progress");
  });

  it("does not fall back to a disabled tenant step by library id", () => {
    const disabled = tenantStep({
      id: "tenant-old-bg",
      step_key: "custom_question_7",
      title: "Background Check",
      step_type: "custom_question",
      is_enabled: false,
      metadata: { workflow_step_id: "background-check" },
    });
    const matched = matchTenantStepForAssignedRecord(
      {
        id: "rec-bg",
        snapshot_step_id: "other-flow-13",
        title: "Background Check",
        step_type: "background-check",
        is_required: true,
        position: 10,
        phase: "pre_hire",
        settings: {},
      },
      [disabled],
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
    expect(mapProgressToDisplayStatus("pending", "uploaded")).toBe("submitted");
    expect(mapProgressToDisplayStatus("completed", "rejected")).toBe("rejected");
    expect(mapProgressToDisplayStatus("completed", "approved")).toBe("approved");
  });

  it("enriches resume steps to Submitted when a resume file exists but progress is pending", () => {
    const mapped = mapAssignedStepRecords({
      records: [
        {
          id: "rec-1",
          snapshot_step_id: "step-resume-basic-profile",
          title: "Resume & Basic Profile",
          step_type: "resume-basic-profile",
          is_required: true,
          position: 1,
          phase: "pre_hire",
          status: "pending",
          settings: {},
        },
      ],
      tenantSteps: [
        tenantStep({
          id: "tenant-resume",
          step_key: "resume_upload",
          title: "Resume & Basic Profile",
          step_type: "resume_upload",
        }),
      ],
      progressByStepId: new Map([
        ["tenant-resume", { onboarding_step_id: "tenant-resume", status: "pending" }],
      ]),
    });
    expect(mapped[0]?.displayStatus).toBe("not_started");

    const enriched = enrichAssignedStepsDisplayFromEvidence({
      steps: mapped,
      hasResumeUpload: true,
    });
    expect(enriched[0]?.displayStatus).toBe("submitted");
  });
});
