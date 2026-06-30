import { describe, expect, it } from "vitest";
import { DEFAULT_STEP_SETTINGS } from "@/app/components/workflow-builder/types";
import { getFirmaRecruiterTemplateId } from "@/lib/onboarding/firma-step-settings";
import { workflowStateToStepDrafts } from "@/lib/onboarding/workflow-to-drafts";
import type { SerializableWorkflowState } from "@/lib/onboarding/workflow-builder-serialization";

describe("onboarding flow publish sync", () => {
  it("projects Firma template settings onto agreement_signature authorizations steps", () => {
    const state: SerializableWorkflowState = {
      nodes: [
        {
          id: "step-agreement_signature",
          stepId: "employee-agreement",
          label: "Agreement / Signature",
          description: "Review and sign required agreements",
          position: { x: 120, y: 560 },
          day: 1,
          required: true,
          settings: {
            ...DEFAULT_STEP_SETTINGS,
            firmaRecruiterTemplateId: "7032efde-bb05-4b92-8776-e62bfbb335df",
            firmaRecruiterTemplateName: "template example",
          },
        },
      ],
      edges: [],
    };

    const drafts = workflowStateToStepDrafts(state);
    const agreementStep = drafts.find((draft) =>
      Boolean(getFirmaRecruiterTemplateId(draft))
    );

    expect(agreementStep?.step_type).toBe("authorizations");
    expect(getFirmaRecruiterTemplateId(agreementStep!)).toBe(
      "7032efde-bb05-4b92-8776-e62bfbb335df"
    );
  });
});
