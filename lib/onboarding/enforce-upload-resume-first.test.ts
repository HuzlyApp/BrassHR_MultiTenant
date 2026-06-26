import { describe, expect, it } from "vitest";
import {
  UPLOAD_RESUME_STEP_KEY,
  UPLOAD_RESUME_TITLE,
  enforceUploadResumeFirstInDrafts,
  isUploadResumeStep,
} from "@/lib/onboarding/enforce-upload-resume-first";
import type { OnboardingStepDraft } from "@/lib/onboarding/default-onboarding-steps";
import { workflowStateToStepDrafts } from "@/lib/onboarding/workflow-to-drafts";
import type { SerializableWorkflowState } from "@/lib/onboarding/workflow-builder-serialization";

const otherStep = (overrides: Partial<OnboardingStepDraft> = {}): OnboardingStepDraft => ({
  step_key: "skill_assessment",
  title: "Skill Assessment",
  description: "",
  step_type: "skill_assessment",
  sort_order: 20,
  is_required: true,
  is_enabled: true,
  metadata: {},
  required_documents: [],
  ...overrides,
});

describe("enforceUploadResumeFirstInDrafts", () => {
  it("inserts Upload Resume when missing", () => {
    const { steps, changed } = enforceUploadResumeFirstInDrafts([otherStep()]);
    expect(changed).toBe(true);
    expect(steps[0].step_key).toBe(UPLOAD_RESUME_STEP_KEY);
    expect(steps[0].title).toBe(UPLOAD_RESUME_TITLE);
    expect(steps[0].is_required).toBe(true);
    expect(steps[1].step_key).toBe("skill_assessment");
  });

  it("moves existing resume step to first without duplicating", () => {
    const resumeLast = otherStep({
      step_key: UPLOAD_RESUME_STEP_KEY,
      step_type: "resume_upload",
      title: "Resume",
      sort_order: 30,
    });
    const { steps, changed } = enforceUploadResumeFirstInDrafts([
      otherStep({ sort_order: 10 }),
      resumeLast,
    ]);
    expect(changed).toBe(true);
    expect(steps.filter(isUploadResumeStep)).toHaveLength(1);
    expect(steps[0].step_key).toBe(UPLOAD_RESUME_STEP_KEY);
    expect(steps[0].sort_order).toBe(10);
  });

  it("disables duplicate resume steps", () => {
    const { steps } = enforceUploadResumeFirstInDrafts([
      otherStep({ step_key: "resume_upload_2", step_type: "resume_upload", sort_order: 20 }),
      otherStep({ step_key: UPLOAD_RESUME_STEP_KEY, step_type: "resume_upload", sort_order: 30 }),
    ]);
    const resumeSteps = steps.filter(isUploadResumeStep);
    expect(resumeSteps.filter((s) => s.is_enabled)).toHaveLength(1);
    expect(resumeSteps[0].step_key).toBe(UPLOAD_RESUME_STEP_KEY);
  });
});

describe("workflowStateToStepDrafts with upload resume enforcement", () => {
  const workflowWithoutResume: SerializableWorkflowState = {
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
    ],
    edges: [],
  };

  it("prepends Upload Resume when publishing a workflow that omitted it", () => {
    const drafts = workflowStateToStepDrafts(workflowWithoutResume, []);
    const enabled = drafts.filter((s) => s.is_enabled).sort((a, b) => a.sort_order - b.sort_order);
    expect(enabled[0].step_type).toBe("resume_upload");
    expect(enabled[0].step_key).toBe(UPLOAD_RESUME_STEP_KEY);
    expect(enabled[1].metadata.workflow_step_id).toBe("skill-qualification-assessment");
  });
});
