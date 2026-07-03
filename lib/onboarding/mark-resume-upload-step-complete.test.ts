import { describe, expect, it, vi } from "vitest";
import {
  findResumeUploadStep,
  markResumeUploadStepComplete,
} from "@/lib/onboarding/mark-resume-upload-step-complete";
import type { TenantOnboardingConfig } from "@/lib/onboarding/types";

describe("findResumeUploadStep", () => {
  it("returns the enabled resume upload step", () => {
    const config = {
      steps: [
        {
          id: "step-1",
          step_key: "resume_upload",
          step_type: "resume_upload",
          title: "Upload Resume",
          is_enabled: true,
        },
        {
          id: "step-2",
          step_key: "professional_license",
          step_type: "professional_license",
          title: "License",
          is_enabled: true,
        },
      ],
    } as unknown as TenantOnboardingConfig;

    expect(findResumeUploadStep(config)?.id).toBe("step-1");
  });
});

describe("markResumeUploadStepComplete", () => {
  it("marks the resume upload step completed when a resume path exists", async () => {
    const updateStepStatus = vi.fn(async () => undefined);

    await markResumeUploadStepComplete({
      updateStepStatus,
      config: {
        steps: [
          {
            id: "step-1",
            step_key: "resume_upload",
            step_type: "resume_upload",
            title: "Upload Resume",
            is_enabled: true,
          },
        ],
      } as unknown as TenantOnboardingConfig,
      resumePath: "tenant/resume.pdf",
      currentStatus: "in_progress",
    });

    expect(updateStepStatus).toHaveBeenCalledWith(
      "resume_upload",
      "completed",
      { resume_path: "tenant/resume.pdf" }
    );
  });

  it("skips when the step is already completed", async () => {
    const updateStepStatus = vi.fn(async () => undefined);

    await markResumeUploadStepComplete({
      updateStepStatus,
      resumePath: "tenant/resume.pdf",
      currentStatus: "completed",
    });

    expect(updateStepStatus).not.toHaveBeenCalled();
  });
});
