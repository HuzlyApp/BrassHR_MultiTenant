import { describe, expect, it } from "vitest";
import {
  getApplicantWorkflowSteps,
  normalizeWorkflowSteps,
} from "@/lib/onboarding/applicant-workflow";
import { publishedWorkflow } from "@/lib/onboarding/applicant-workflow-fixtures";
import {
  stepRenderers,
  SkillAssessmentStep,
  DocumentUploadStep,
  BackgroundCheckStep,
  ReferenceVerificationStep,
} from "@/app/components/onboarding/DynamicStepRenderer";

describe("normalizeWorkflowSteps", () => {
  it("sorts workflow steps by order", () => {
    const workflow = {
      ...publishedWorkflow,
      steps: [
        publishedWorkflow.steps[2],
        publishedWorkflow.steps[0],
        publishedWorkflow.steps[1],
      ],
    };

    const result = normalizeWorkflowSteps(workflow.steps);

    expect(result.map((step) => step.id)).toEqual([
      "step_skill_assessment",
      "step_document_upload",
      "step_background_check",
    ]);
  });
});

describe("getApplicantWorkflowSteps", () => {
  it("does not return references step when reference_verification is not in the workflow", () => {
    const steps = getApplicantWorkflowSteps(publishedWorkflow);

    expect(steps.map((step) => step.type)).not.toContain("reference_verification");
    expect(steps.map((step) => step.title)).not.toContain("Add References");
  });

  it("returns Reference Verification only when configured in the published workflow", () => {
    const workflowWithReferences = {
      ...publishedWorkflow,
      steps: [
        ...publishedWorkflow.steps,
        {
          id: "step_reference_verification",
          type: "reference_verification",
          title: "Reference Verification",
          description: "Add professional references.",
          required: true,
          day: 4,
          order: 4,
          settings: {
            minReferences: 2,
            maxReferences: 3,
          },
        },
      ],
    };

    const steps = getApplicantWorkflowSteps(workflowWithReferences);

    expect(steps.map((step) => step.type)).toContain("reference_verification");
    expect(steps.map((step) => step.title)).toContain("Reference Verification");
  });
});

describe("stepRenderers", () => {
  it("returns the correct renderer for each supported step type", () => {
    expect(stepRenderers.skill_qualification_assessment).toBe(SkillAssessmentStep);
    expect(stepRenderers.document_upload).toBe(DocumentUploadStep);
    expect(stepRenderers.background_check).toBe(BackgroundCheckStep);
    expect(stepRenderers.reference_verification).toBe(ReferenceVerificationStep);
  });
});
