import { describe, expect, it } from "vitest";
import { resolveCustomStepContinue } from "@/lib/onboarding/custom-step-continue";

describe("resolveCustomStepContinue", () => {
  it("completes partner/library steps like OIG without a form answer", () => {
    expect(
      resolveCustomStepContinue({
        formVisible: false,
        required: true,
        answer: "",
      })
    ).toEqual({ action: "complete", response: "" });
  });

  it("does not navigate by remaining on the same custom-step URL", () => {
    const result = resolveCustomStepContinue({
      formVisible: false,
      required: false,
      answer: "",
    });
    expect(result.action).toBe("complete");
  });

  it("requires an answer only when the custom form is actually shown", () => {
    expect(
      resolveCustomStepContinue({
        formVisible: true,
        required: true,
        answer: "   ",
      })
    ).toEqual({ action: "require-answer" });

    expect(
      resolveCustomStepContinue({
        formVisible: true,
        required: true,
        answer: "cleared",
      })
    ).toEqual({ action: "complete", response: "cleared" });
  });
});
