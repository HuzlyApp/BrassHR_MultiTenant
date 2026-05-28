import { describe, expect, it } from "vitest";
import { stepDraftsToSerializableWorkflow } from "@/lib/onboarding/step-drafts-to-workflow-state";
import { configFromWorkflowDraft } from "@/lib/onboarding/config-from-builder-draft";
import { isWorkerVisibleStep } from "@/lib/onboarding/workflow-settings";
import type { TenantOnboardingConfig, TenantOnboardingStep } from "@/lib/onboarding/types";
import type { OnboardingStepDraft } from "@/lib/onboarding/default-onboarding-steps";

const publishedConfig: TenantOnboardingConfig = {
  configId: "cfg-1",
  tenantId: "tenant-1",
  version: 1,
  steps: [
    {
      id: "step-1",
      step_key: "resume_upload",
      title: "Add Resume",
      description: null,
      step_type: "resume_upload",
      sort_order: 10,
      is_required: true,
      is_enabled: true,
      metadata: {},
    },
  ],
  requiredDocuments: [],
  skillAssessments: [],
};

describe("stepDraftsToSerializableWorkflow", () => {
  it("produces ordered nodes from step drafts", () => {
    const drafts: OnboardingStepDraft[] = [
      {
        step_key: "custom_question",
        title: "Background check",
        description: "Complete screening",
        step_type: "custom_question",
        sort_order: 20,
        is_required: true,
        is_enabled: true,
        metadata: { workflow_step_id: "background-check" },
      },
    ];

    const state = stepDraftsToSerializableWorkflow(drafts);
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].stepId).toBe("background-check");
    expect(state.nodes[0].label).toBe("Background check");
    expect(state.edges).toHaveLength(0);
  });
});

describe("configFromWorkflowDraft", () => {
  it("merges canvas labels into preview config steps", () => {
    const draft = stepDraftsToSerializableWorkflow([
      {
        step_key: "resume_upload",
        title: "Updated resume title",
        description: "New desc",
        step_type: "resume_upload",
        sort_order: 10,
        is_required: true,
        is_enabled: true,
        metadata: {},
      },
    ]);

    const preview = configFromWorkflowDraft(publishedConfig, draft);
    expect(preview?.steps[0].title).toBe("Updated resume title");
    expect(preview?.steps[0].description).toBe("New desc");
  });
});

describe("workflow visibility", () => {
  it("hides admin-only conditional steps from applicants", () => {
    const step: TenantOnboardingStep = {
      id: "x",
      step_key: "internal",
      title: "Internal",
      description: null,
      step_type: "custom_question",
      sort_order: 10,
      is_required: false,
      is_enabled: true,
      metadata: {
        workflow_settings: {
          conditionalLogic: "admin only — not shown to applicants",
          clientPerforms: true,
          required: false,
          useBraasPartner: false,
          notifyHrOnFail: false,
          datePriority: "",
          provider: "",
          triggerAfter: "",
          notify: "",
          timeline: "",
        },
      },
    };
    expect(isWorkerVisibleStep(step)).toBe(false);
  });
});
