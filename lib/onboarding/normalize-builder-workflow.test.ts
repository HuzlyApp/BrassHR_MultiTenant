import { describe, expect, it } from "vitest";
import { enforceUploadResumeFirstInWorkflowState } from "@/lib/onboarding/normalize-builder-workflow";
import type { SerializableWorkflowState } from "@/lib/onboarding/workflow-builder-serialization";

const referencesNode = {
  id: "step-references",
  stepId: "references-collection",
  label: "Add References",
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
};

describe("enforceUploadResumeFirstInWorkflowState", () => {
  it("does not re-insert deleted nodes like Add References or Summary", () => {
    const state: SerializableWorkflowState = {
      nodes: [
        {
          id: "step-resume_upload",
          stepId: "resume-basic-profile",
          label: "Upload Resume",
          description: "",
          position: { x: 120, y: 40 },
          day: 1,
          required: true,
          settings: referencesNode.settings,
        },
        {
          id: "step-skill_assessment",
          stepId: "skill-qualification-assessment",
          label: "Skill Assessment",
          description: "",
          position: { x: 120, y: 170 },
          day: 2,
          required: true,
          settings: referencesNode.settings,
        },
      ],
      edges: [{ id: "e1", source: "step-resume_upload", target: "step-skill_assessment" }],
    };

    const next = enforceUploadResumeFirstInWorkflowState(state, [
      {
        step_key: "references",
        title: "Add References",
        description: "",
        step_type: "references",
        sort_order: 30,
        is_required: true,
        is_enabled: true,
        metadata: {},
        required_documents: [],
      },
      {
        step_key: "review_submit",
        title: "Summary",
        description: "",
        step_type: "review_submit",
        sort_order: 40,
        is_required: true,
        is_enabled: true,
        metadata: {},
        required_documents: [],
      },
    ]);

    expect(next.nodes.map((n) => n.label)).toEqual(["Upload Resume", "Skill Assessment"]);
    expect(next.nodes.some((n) => n.label === "Add References")).toBe(false);
    expect(next.nodes.some((n) => n.label === "Summary")).toBe(false);
  });

  it("inserts Upload Resume when missing but keeps other canvas nodes", () => {
    const state: SerializableWorkflowState = {
      nodes: [referencesNode],
      edges: [],
    };

    const next = enforceUploadResumeFirstInWorkflowState(state, []);
    expect(next.nodes[0].stepId).toBe("resume-basic-profile");
    expect(next.nodes[1]?.label).toBe("Add References");
  });
});
