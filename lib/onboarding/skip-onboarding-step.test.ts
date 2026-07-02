import { describe, expect, it, vi } from "vitest";
import { skipOnboardingStep } from "@/lib/onboarding/skip-onboarding-step";

describe("skipOnboardingStep", () => {
  it("marks the step as skipped and navigates forward", async () => {
    const updateStepStatus = vi.fn().mockResolvedValue(undefined);
    const onNavigate = vi.fn();

    await skipOnboardingStep({
      step: { step_key: "professional_license" },
      updateStepStatus,
      onNavigate,
    });

    expect(updateStepStatus).toHaveBeenCalledWith("professional_license", "skipped", undefined);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("does not call update when step key is missing but still navigates", async () => {
    const updateStepStatus = vi.fn();
    const onNavigate = vi.fn();

    await skipOnboardingStep({
      step: null,
      updateStepStatus,
      onNavigate,
    });

    expect(updateStepStatus).not.toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("navigates even when progress sync fails", async () => {
    const updateStepStatus = vi.fn().mockRejectedValue(new Error("network"));
    const onNavigate = vi.fn();

    await skipOnboardingStep({
      step: { step_key: "references" },
      updateStepStatus,
      onNavigate,
    });

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
