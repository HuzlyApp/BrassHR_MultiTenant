import { describe, expect, it, vi } from "vitest";
import { skipNonNavigableApplicantSteps } from "@/lib/onboarding/skip-non-navigable-applicant-steps";
import type { TenantOnboardingStep, WorkerOnboardingProgressPayload } from "@/lib/onboarding/types";

function step(
  partial: Partial<TenantOnboardingStep> & Pick<TenantOnboardingStep, "id" | "step_key" | "title">
): TenantOnboardingStep {
  return {
    description: null,
    step_type: "profile_information",
    sort_order: 1,
    is_required: true,
    is_enabled: true,
    metadata: {},
    ...partial,
  };
}

describe("skipNonNavigableApplicantSteps", () => {
  it("marks Parameterized Job Application as completed, not skipped", async () => {
    const enabledSteps = [
      step({
        id: "resume",
        step_key: "upload_resume",
        title: "Resume",
        step_type: "resume_upload",
        sort_order: 1,
      }),
      step({
        id: "job-app",
        step_key: "profile_information",
        title: "Parameterized Job Application",
        sort_order: 2,
        metadata: { workflow_step_id: "parameterized-job-application" },
      }),
      step({
        id: "refs",
        step_key: "references",
        title: "References Collection",
        step_type: "references",
        sort_order: 3,
      }),
    ];

    const progress: WorkerOnboardingProgressPayload = {
      progressId: "p1",
      status: "in_progress",
      farthestReachedStepIndex: 2,
      steps: [
        {
          onboarding_step_id: "resume",
          step_key: "upload_resume",
          status: "completed",
          completed_at: "2026-01-01T00:00:00.000Z",
          data: {},
        },
        {
          onboarding_step_id: "job-app",
          step_key: "profile_information",
          status: "pending",
          completed_at: null,
          data: {},
        },
        {
          onboarding_step_id: "refs",
          step_key: "references",
          status: "pending",
          completed_at: null,
          data: {},
        },
      ],
      submittedAt: null,
      submittedWithIncompleteSteps: false,
      incompleteStepKeys: [],
    };

    const updateStepStatus = vi.fn().mockResolvedValue(undefined);

    await skipNonNavigableApplicantSteps({
      enabledSteps,
      progress,
      updateStepStatus,
      afterIndex: 0,
      beforeIndex: 2,
    });

    expect(updateStepStatus).toHaveBeenCalledWith(
      "profile_information",
      "completed",
      expect.objectContaining({
        system_completed: true,
        reason: "non_navigable_placeholder",
      })
    );
    expect(updateStepStatus).not.toHaveBeenCalledWith(
      "profile_information",
      "skipped",
      expect.anything()
    );
  });
});
