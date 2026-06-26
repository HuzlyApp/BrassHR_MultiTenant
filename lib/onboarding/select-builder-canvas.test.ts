import { describe, expect, it } from "vitest";
import { publishedWorkflowToTenantConfig } from "@/lib/onboarding/applicant-workflow";
import { publishedWorkflow } from "@/lib/onboarding/applicant-workflow-fixtures";
import {
  builderDraftHasCanvas,
  hydrateDraftCanvas,
  hydratePublishedCanvas,
  selectBuilderCanvas,
} from "@/lib/onboarding/select-builder-canvas";
import type { SerializableWorkflowState } from "@/lib/onboarding/workflow-builder-serialization";

const publishedConfig = publishedWorkflowToTenantConfig(publishedWorkflow);

const skillDocumentBackgroundDraft: SerializableWorkflowState = {
  nodes: [
    {
      id: "step-skill_assessment",
      stepId: "skill-qualification-assessment",
      label: "Skill / Qualification Assessment",
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
      id: "step-document_upload",
      stepId: "document-upload",
      label: "Document Upload",
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
    {
      id: "step-background_check",
      stepId: "background-check",
      label: "Background Check",
      description: "Track background check completion.",
      position: { x: 120, y: 300 },
      day: 3,
      required: true,
      settings: {
        required: true,
        clientPerforms: true,
        useBraasPartner: true,
        notifyHrOnFail: true,
        datePriority: "Day 3",
        provider: "Checker (connected)",
        triggerAfter: "Offer Acceptance",
        notify: "HR + Recruiter",
        timeline: "5 business days",
        conditionalLogic: "",
      },
    },
  ],
  edges: [
    { id: "e1", source: "step-skill_assessment", target: "step-document_upload" },
    { id: "e2", source: "step-document_upload", target: "step-background_check" },
  ],
};

const legacyReferencesDraft: SerializableWorkflowState = {
  nodes: [
    {
      id: "step-resume_upload",
      stepId: "resume-basic-profile",
      label: "Add Resume",
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
      id: "step-references",
      stepId: "references-collection",
      label: "Add References",
      description: "",
      position: { x: 120, y: 170 },
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
  ],
  edges: [{ id: "e1", source: "step-resume_upload", target: "step-references" }],
};

describe("selectBuilderCanvas", () => {
  it("loads saved draft canvas when a builder draft exists", () => {
    const result = selectBuilderCanvas(
      {
        config: publishedConfig,
        publishStatus: "draft",
        builderDraft: skillDocumentBackgroundDraft,
      },
      []
    );

    expect(result.source).toBe("draft");
    expect(result.nodes.map((n) => n.data.label)).toEqual([
      "Upload Resume",
      "Skill / Qualification Assessment",
      "Document Upload",
      "Background Check",
    ]);
  });

  it("prefers saved draft over published steps when both exist", () => {
    const legacyPublished = {
      ...publishedConfig,
      steps: publishedConfig.steps,
    };

    const result = selectBuilderCanvas(
      {
        config: legacyPublished,
        publishStatus: "published",
        builderDraft: legacyReferencesDraft,
      },
      []
    );

    expect(result.source).toBe("draft");
    expect(result.nodes.map((n) => n.data.label)).toEqual(["Add Resume", "Add References"]);
  });

  it("detects non-empty builder drafts", () => {
    expect(builderDraftHasCanvas(skillDocumentBackgroundDraft)).toBe(true);
    expect(builderDraftHasCanvas({ nodes: [], edges: [] })).toBe(false);
  });
});

describe("hydrateDraftCanvas", () => {
  it("does not include Add References when draft excludes references", () => {
    const { nodes } = hydrateDraftCanvas(
      {
        config: publishedConfig,
        publishStatus: "draft",
        builderDraft: skillDocumentBackgroundDraft,
      },
      []
    );

    expect(nodes.map((n) => n.data.label)).not.toContain("Add References");
    expect(nodes.map((n) => n.data.stepId)).toEqual([
      "resume-basic-profile",
      "skill-qualification-assessment",
      "document-upload",
      "background-check",
    ]);
  });
});
