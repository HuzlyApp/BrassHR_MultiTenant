import { describe, expect, it } from "vitest";
import { applyWorkflowNodeDataPatch } from "@/lib/onboarding/apply-workflow-node-patch";
import { configFromWorkflowDraft } from "@/lib/onboarding/config-from-builder-draft";
import { DEFAULT_STEP_SETTINGS, type WorkflowNodeData } from "@/app/components/workflow-builder/types";
import {
  dayFromDatePriority,
  normalizeWorkflowNodeSettings,
} from "@/lib/onboarding/normalize-workflow-settings";
import { workflowStateToStepDrafts } from "@/lib/onboarding/workflow-to-drafts";
import {
  isWorkerPerformableStep,
  isWorkerVisibleStep,
} from "@/lib/onboarding/workflow-settings";
import type { SerializableWorkflowState } from "@/lib/onboarding/workflow-builder-serialization";
import type { TenantOnboardingConfig, TenantOnboardingStep } from "@/lib/onboarding/types";

function baseNodeData(overrides?: Partial<WorkflowNodeData>): WorkflowNodeData {
  return {
    stepId: "resume-upload",
    label: "Add Resume",
    description: "Upload PDF",
    icon: null,
    day: 1,
    required: true,
    settings: { ...DEFAULT_STEP_SETTINGS },
    ...overrides,
  };
}

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

describe("normalizeWorkflowNodeSettings", () => {
  it("syncs day from date priority and clears checker when partner is off", () => {
    const settings = normalizeWorkflowNodeSettings(
      { useBraasPartner: false, provider: "Checker (connected)", datePriority: "Day 5" },
      { required: false }
    );
    expect(settings.datePriority).toBe("Day 5");
    expect(dayFromDatePriority(settings.datePriority)).toBe(5);
    expect(settings.provider).toBe("Manual");
    expect(settings.required).toBe(false);
  });
});

describe("applyWorkflowNodeDataPatch", () => {
  it("keeps label, description, and settings aligned on patch", () => {
    const next = applyWorkflowNodeDataPatch(baseNodeData(), {
      label: "Updated title",
      description: "New body",
      settings: { clientPerforms: false, notifyHrOnFail: true, datePriority: "Day 3" },
    });
    expect(next.label).toBe("Updated title");
    expect(next.description).toBe("New body");
    expect(next.settings.clientPerforms).toBe(false);
    expect(next.settings.notifyHrOnFail).toBe(true);
    expect(next.day).toBe(3);
    expect(next.settings.datePriority).toBe("Day 3");
  });
});

describe("workflowStateToStepDrafts persistence", () => {
  it("persists workflow_settings and workflow_day from canvas nodes", () => {
    const state: SerializableWorkflowState = {
      nodes: [
        {
          id: "step-resume_upload",
          stepId: "resume-upload",
          label: "Resume (edited)",
          description: "PDF only",
          position: { x: 0, y: 0 },
          day: 7,
          required: false,
          settings: {
            ...DEFAULT_STEP_SETTINGS,
            clientPerforms: false,
            useBraasPartner: true,
            notifyHrOnFail: true,
            datePriority: "Day 7",
            provider: "Third-party API",
            required: false,
          },
        },
      ],
      edges: [],
    };

    const drafts = workflowStateToStepDrafts(state, []);
    expect(drafts[0].title).toBe("Resume (edited)");
    expect(drafts[0].description).toBe("PDF only");
    expect(drafts[0].is_required).toBe(false);
    expect(drafts[0].metadata?.workflow_day).toBe(7);
    expect(drafts[0].metadata?.workflow_settings).toMatchObject({
      clientPerforms: false,
      notifyHrOnFail: true,
      datePriority: "Day 7",
      provider: "Third-party API",
    });
  });
});

describe("configFromWorkflowDraft preview", () => {
  it("uses draft labels and settings in preview config", () => {
    const state: SerializableWorkflowState = {
      nodes: [
        {
          id: "step-resume_upload",
          stepId: "resume-upload",
          label: "Preview title",
          description: "Preview desc",
          position: { x: 0, y: 0 },
          day: 2,
          required: true,
          settings: {
            ...DEFAULT_STEP_SETTINGS,
            datePriority: "Day 2",
            notifyHrOnFail: false,
          },
        },
      ],
      edges: [],
    };

    const preview = configFromWorkflowDraft(publishedConfig, state);
    const step = preview?.steps[0];
    expect(step?.title).toBe("Preview title");
    expect(step?.description).toBe("Preview desc");
    expect(
      (step?.metadata?.workflow_settings as { notifyHrOnFail?: boolean })?.notifyHrOnFail
    ).toBe(false);
    expect(step?.metadata?.workflow_day).toBe(2);
  });
});

describe("runtime performer visibility", () => {
  const step = (settings: Record<string, unknown>): TenantOnboardingStep => ({
    id: "x",
    step_key: "custom",
    title: "Check",
    description: null,
    step_type: "custom_question",
    sort_order: 10,
    is_required: true,
    is_enabled: true,
    metadata: { workflow_settings: settings },
  });

  it("hides steps when client does not perform", () => {
    const hidden = step({ clientPerforms: false, required: true });
    expect(isWorkerPerformableStep(hidden)).toBe(false);
    expect(isWorkerVisibleStep(hidden)).toBe(false);
  });

  it("shows steps when client performs", () => {
    const visible = step({ clientPerforms: true, required: true });
    expect(isWorkerPerformableStep(visible)).toBe(true);
    expect(isWorkerVisibleStep(visible)).toBe(true);
  });
});
