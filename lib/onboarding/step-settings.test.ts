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
  showsApplicantPartnerScreeningNotice,
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
          stepId: "resume-basic-profile",
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
    expect(drafts[0].is_required).toBe(true);
    expect(drafts[0].metadata?.workflow_day).toBe(7);
    expect(drafts[0].metadata?.workflow_settings).toMatchObject({
      clientPerforms: false,
      notifyHrOnFail: true,
      datePriority: "Day 7",
      provider: "Third-party API",
    });
  });

  it("does not duplicate Summary when canvas ends with a custom-step Summary node", () => {
    const state: SerializableWorkflowState = {
      nodes: [
        {
          id: "step-resume_upload",
          stepId: "resume-basic-profile",
          label: "Add Resume",
          description: "Upload and review your resume",
          position: { x: 120, y: 40 },
          day: 1,
          required: true,
          settings: { ...DEFAULT_STEP_SETTINGS },
        },
        {
          id: "step-custom_question",
          stepId: "custom-step",
          label: "Summary",
          description: "Review and submit application",
          position: { x: 120, y: 560 },
          day: 1,
          required: true,
          settings: { ...DEFAULT_STEP_SETTINGS },
        },
      ],
      edges: [{ id: "e1", source: "step-resume_upload", target: "step-custom_question" }],
    };

    const drafts = workflowStateToStepDrafts(state, []);
    expect(drafts).toHaveLength(2);
    expect(drafts[1].step_type).toBe("review_submit");
    expect(drafts[1].title).toBe("Summary");
    expect(drafts.filter((s) => s.title.toLowerCase() === "summary")).toHaveLength(1);
  });
});

describe("configFromWorkflowDraft preview", () => {
  it("uses draft labels and settings in preview config", () => {
    const state: SerializableWorkflowState = {
      nodes: [
        {
          id: "step-resume_upload",
          stepId: "resume-basic-profile",
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

  it("hides Pre-Hire Approval and other internal conversion gates from applicants", () => {
    const preHire = step({
      clientPerforms: true,
      phase: "transition",
      completionOwner: "authorized_internal",
    });
    expect(isWorkerPerformableStep(preHire)).toBe(false);
    expect(isWorkerVisibleStep(preHire)).toBe(false);

    const hrFinal = step({
      clientPerforms: true,
      phase: "pre_hire",
      completionOwner: "hr_admin",
    });
    expect(isWorkerVisibleStep(hrFinal)).toBe(false);
  });

  it("keeps applicant-owned pre-hire steps visible", () => {
    const offer = step({
      clientPerforms: true,
      phase: "pre_hire",
      completionOwner: "applicant",
    });
    expect(isWorkerVisibleStep(offer)).toBe(true);
  });
});

describe("applicant partner screening notice", () => {
  it("does not show Checker copy on Pre-Hire Approval even when defaults include Checker", () => {
    const preHire: TenantOnboardingStep = {
      id: "gate",
      step_key: "custom_question_2",
      title: "Pre-Hire Approval",
      description: "Approve conversion to 1099 contractor and unlock post-hire setup.",
      step_type: "custom_question",
      sort_order: 90,
      is_required: true,
      is_enabled: true,
      metadata: {
        workflow_step_id: "completion-milestone",
        workflow_settings: {
          phase: "transition",
          completionOwner: "authorized_internal",
        },
      },
    };
    expect(showsApplicantPartnerScreeningNotice(preHire)).toBe(false);
  });

  it("shows Checker copy only on screening library steps", () => {
    const background: TenantOnboardingStep = {
      id: "bg",
      step_key: "custom_question",
      title: "Background Check",
      description: null,
      step_type: "custom_question",
      sort_order: 70,
      is_required: true,
      is_enabled: true,
      metadata: {
        workflow_step_id: "background-check",
        workflow_settings: {
          useBraasPartner: true,
          provider: "Checker (connected)",
          timeline: "5 business days",
        },
      },
    };
    expect(showsApplicantPartnerScreeningNotice(background)).toBe(true);
  });
});
