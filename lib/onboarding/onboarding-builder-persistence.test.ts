import { describe, expect, it } from "vitest";
import { workflowStateToStepDrafts } from "@/lib/onboarding/workflow-to-drafts";
import type { SerializableWorkflowState } from "@/lib/onboarding/workflow-builder-serialization";
import { getApplicantWorkflowSteps } from "@/lib/onboarding/applicant-workflow";
import { tenantConfigToPublishedWorkflow } from "@/lib/onboarding/applicant-workflow";
import { getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation";

const builderWorkflow: SerializableWorkflowState = {
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

describe("workflowStateToStepDrafts", () => {
  it("normalizes builder canvas into persisted tenant steps without references", () => {
    const drafts = workflowStateToStepDrafts(builderWorkflow, []);

    const enabledTypes = drafts
      .filter((s) => s.is_enabled)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => s.metadata.workflow_step_id);

    expect(enabledTypes[0]).toBe("resume-basic-profile");
    expect(enabledTypes.slice(1, 4)).toEqual([
      "skill-qualification-assessment",
      "document-upload",
      "background-check",
    ]);

    expect(drafts.some((s) => s.step_type === "review_submit")).toBe(false);

    expect(drafts.map((s) => s.title)).not.toContain("Add References");

    const background = drafts.find((s) => s.metadata.workflow_step_id === "background-check");
    expect(background?.metadata.workflow_settings).toMatchObject({
      clientPerforms: true,
      useBraasPartner: true,
      provider: "Checker (connected)",
      notifyHrOnFail: true,
      triggerAfter: "Offer Acceptance",
      timeline: "5 business days",
    });
  });
});

describe("published applicant workflow projection", () => {
  it("loads applicant onboarding from published workflow instead of legacy Add References", () => {
    const drafts = workflowStateToStepDrafts(builderWorkflow, []).filter(
      (s) => s.step_type !== "review_submit"
    );

    const config = {
      configId: "cfg-test",
      tenantId: "subdomaintest",
      version: 3,
      steps: drafts.map((d, index) => ({
        id: `id-${d.step_key}`,
        step_key: d.step_key,
        title: d.title,
        description: d.description || null,
        step_type: d.step_type,
        sort_order: d.sort_order,
        is_required: d.is_required,
        is_enabled: d.is_enabled,
        metadata: d.metadata,
      })),
      requiredDocuments: [],
      skillAssessments: [],
    };

    const workflow = tenantConfigToPublishedWorkflow(config, "subdomaintest");
    const applicantSteps = getApplicantWorkflowSteps(workflow);

    expect(applicantSteps.map((step) => step.title)).toEqual([
      "Upload Resume",
      "Skill / Qualification Assessment",
      "Document Upload",
      "Background Check",
    ]);
    expect(applicantSteps.map((step) => step.title)).not.toContain("Add References");

    const enabled = getEnabledTenantSteps(config);
    expect(enabled.map((s) => s.title)).not.toContain("Add References");
  });
});
