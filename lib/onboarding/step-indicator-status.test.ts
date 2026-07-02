import { describe, expect, it } from "vitest";
import {
  deriveStepIndicatorState,
  furthestProgressStepIndex,
  isStepIndicatorAccessible,
} from "@/lib/onboarding/step-indicator-status";

describe("deriveStepIndicatorState", () => {
  it("marks skipped optional steps as skipped, not completed", () => {
    expect(
      deriveStepIndicatorState({
        dbStatus: "skipped",
        stepNumber: 2,
        currentStepNumber: 4,
        isRequired: false,
      })
    ).toBe("skipped");
  });

  it("marks skipped required steps as required_missing", () => {
    expect(
      deriveStepIndicatorState({
        dbStatus: "skipped",
        stepNumber: 2,
        currentStepNumber: 4,
        isRequired: true,
      })
    ).toBe("required_missing");
  });

  it("does not treat skipped as completed", () => {
    const state = deriveStepIndicatorState({
      dbStatus: "skipped",
      stepNumber: 3,
      currentStepNumber: 5,
      isRequired: false,
    });
    expect(state).not.toBe("completed");
  });

  it("marks the active step as current", () => {
    expect(
      deriveStepIndicatorState({
        dbStatus: "in_progress",
        stepNumber: 3,
        currentStepNumber: 3,
        isRequired: true,
      })
    ).toBe("current");
  });

  it("marks completed steps as completed", () => {
    expect(
      deriveStepIndicatorState({
        dbStatus: "completed",
        stepNumber: 1,
        currentStepNumber: 3,
        isRequired: true,
      })
    ).toBe("completed");
  });
});

describe("isStepIndicatorAccessible", () => {
  it("allows navigation to skipped steps within max allowed", () => {
    expect(isStepIndicatorAccessible("skipped", 2, 5)).toBe(true);
  });

  it("blocks future steps beyond max allowed", () => {
    expect(isStepIndicatorAccessible("not_started", 6, 4)).toBe(false);
  });
});

describe("furthestProgressStepIndex", () => {
  it("includes skipped steps in progress width", () => {
    const states = ["completed", "skipped", "not_started", "current", "not_started"] as const;
    expect(furthestProgressStepIndex([...states], 4)).toBe(4);
  });
});
