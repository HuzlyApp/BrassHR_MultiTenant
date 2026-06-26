import { describe, expect, it } from "vitest";
import { preparePublishedStepDrafts } from "@/lib/onboarding/prepare-published-step-drafts";
import type { SerializableWorkflowState } from "@/lib/onboarding/workflow-builder-serialization";
import type { TenantOnboardingConfig } from "@/lib/onboarding/types";

const canvasWithoutReferences: SerializableWorkflowState = {
  nodes: [
    {
      id: "step-resume",
      stepId: "resume-basic-profile",
      label: "Upload Resume",
      description: "",
      position: { x: 120, y: 40 },
      day: 1,
      required: true,
      settings: {
        required: true,
        clientPerforms: true,
        useBraasPartner: false,
        notifyHrOnFail: false,
        datePriority: "Day 1",
        provider: "",
        triggerAfter: "",
        notify: "",
        timeline: "",
        conditionalLogic: "",
      },
    },
    {
      id: "step-skill",
      stepId: "skill-qualification-assessment",
      label: "Skill / Qualification Assessment",
      description: "",
      position: { x: 120, y: 170 },
      day: 2,
      required: true,
      settings: {
        required: true,
        clientPerforms: true,
        useBraasPartner: false,
        notifyHrOnFail: false,
        datePriority: "Day 2",
        provider: "",
        triggerAfter: "",
        notify: "",
        timeline: "",
        conditionalLogic: "",
      },
    },
  ],
  edges: [{ id: "e1", source: "step-resume", target: "step-skill" }],
};

const publishedWithReferences: TenantOnboardingConfig = {
  configId: "cfg-1",
  tenantId: "tenant-1",
  version: 2,
  steps: [
    {
      id: "id-resume",
      step_key: "resume_upload",
      title: "Upload Resume",
      description: null,
      step_type: "resume_upload",
      sort_order: 10,
      is_required: true,
      is_enabled: true,
      metadata: { workflow_node_id: "step-resume", workflow_step_id: "resume-basic-profile" },
    },
    {
      id: "id-references",
      step_key: "references",
      title: "Add References",
      description: null,
      step_type: "references",
      sort_order: 20,
      is_required: true,
      is_enabled: true,
      metadata: { workflow_node_id: "step-references", workflow_step_id: "add-references" },
    },
    {
      id: "id-skill",
      step_key: "skill_assessment",
      title: "Skill Assessment",
      description: null,
      step_type: "skill_assessment",
      sort_order: 30,
      is_required: true,
      is_enabled: true,
      metadata: {
        workflow_node_id: "step-skill-old",
        workflow_step_id: "skill-qualification-assessment",
      },
    },
    {
      id: "id-removed",
      step_key: "background_check",
      title: "Background Check",
      description: null,
      step_type: "background_check",
      sort_order: 40,
      is_required: true,
      is_enabled: false,
      metadata: { workflow_step_id: "background-check" },
    },
  ],
  requiredDocuments: [],
  skillAssessments: [],
};

describe("preparePublishedStepDrafts", () => {
  it("publishes only canvas nodes and omits deleted references", () => {
    const { steps } = preparePublishedStepDrafts(canvasWithoutReferences, publishedWithReferences);
    const enabled = steps.filter((s) => s.is_enabled !== false);

    expect(enabled.map((s) => s.metadata?.workflow_step_id)).toEqual([
      "resume-basic-profile",
      "skill-qualification-assessment",
    ]);
    expect(enabled.map((s) => s.title)).not.toContain("Add References");
    expect(enabled[0].step_type).toBe("resume_upload");
    expect(enabled[0].is_required).toBe(true);
  });

  it("does not resurrect soft-deleted published steps from existing config", () => {
    const { steps } = preparePublishedStepDrafts(canvasWithoutReferences, publishedWithReferences);
    const enabled = steps.filter((s) => s.is_enabled !== false);

    expect(enabled.some((s) => s.step_key === "background_check")).toBe(false);
    expect(enabled.some((s) => s.metadata?.workflow_step_id === "background-check")).toBe(false);
  });

  it("inserts upload resume when missing from canvas", () => {
    const canvasNoResume: SerializableWorkflowState = {
      nodes: canvasWithoutReferences.nodes.filter((n) => n.stepId !== "resume-basic-profile"),
      edges: [],
    };

    const { normalizedDraft, steps } = preparePublishedStepDrafts(canvasNoResume, null);
    const enabled = steps.filter((s) => s.is_enabled !== false);

    expect(normalizedDraft.nodes[0]?.stepId).toBe("resume-basic-profile");
    expect(enabled[0].step_type).toBe("resume_upload");
    expect(enabled[0].is_required).toBe(true);
  });
});
