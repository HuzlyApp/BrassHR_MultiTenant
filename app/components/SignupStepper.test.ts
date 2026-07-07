import { describe, expect, it } from "vitest";
import {
  getSignupStepIconVariant,
  getStepperConfig,
  resolveSignupStepperPhase,
  SIGNUP_STEPPER_ITEMS,
} from "@/app/components/SignupStepper";

function signUpStepVariant(phase: Parameters<typeof getStepperConfig>[0]) {
  const { completedStepIndex, activeStepIndex } = getStepperConfig(phase);
  return getSignupStepIconVariant(0, completedStepIndex, activeStepIndex);
}

describe("SignupStepper", () => {
  it("keeps step 0 active without marking it completed on initial signup load", () => {
    const { completedStepIndex, activeStepIndex } = getStepperConfig("details");
    expect(activeStepIndex).toBe(0);
    expect(completedStepIndex).toBe(-1);
    expect(signUpStepVariant("details")).toBe("active");
    expect(getSignupStepIconVariant(1, completedStepIndex, activeStepIndex)).toBe("pending");
  });

  it("keeps step 0 active on the password creation page", () => {
    const { completedStepIndex, activeStepIndex } = getStepperConfig("password");
    expect(activeStepIndex).toBe(0);
    expect(completedStepIndex).toBe(-1);
    expect(signUpStepVariant("password")).toBe("active");
    expect(getSignupStepIconVariant(1, completedStepIndex, activeStepIndex)).toBe("pending");
    expect(getSignupStepIconVariant(2, completedStepIndex, activeStepIndex)).toBe("pending");
  });

  it("does not treat validation or internal form screens as completed while still on step 0", () => {
    for (const phase of ["details", "password"] as const) {
      const { completedStepIndex, activeStepIndex } = getStepperConfig(phase);
      for (let index = 0; index < SIGNUP_STEPPER_ITEMS.length; index += 1) {
        const variant = getSignupStepIconVariant(index, completedStepIndex, activeStepIndex);
        if (index === 0) {
          expect(variant).toBe("active");
          expect(variant).not.toBe("completed");
        }
      }
    }
  });

  it("keeps the stepper on Sign Up while submitting until redirecting after success", () => {
    expect(resolveSignupStepperPhase({ formStep: "password", redirecting: false })).toBe("password");
    expect(signUpStepVariant("password")).toBe("active");

    expect(resolveSignupStepperPhase({ formStep: "details", redirecting: false })).toBe("details");
    expect(resolveSignupStepperPhase({ formStep: "password", redirecting: true })).toBe("preparing");
  });

  it("does not advance to preparing your trial until signup redirect begins", () => {
    const passwordPhase = getStepperConfig("password");
    expect(passwordPhase.activeStepIndex).toBe(0);
    expect(passwordPhase.completedStepIndex).toBe(-1);

    const preparingPhase = getStepperConfig("preparing");
    expect(preparingPhase.completedStepIndex).toBe(0);
    expect(preparingPhase.activeStepIndex).toBe(1);
    expect(signUpStepVariant("preparing")).toBe("completed");
    expect(
      getSignupStepIconVariant(1, preparingPhase.completedStepIndex, preparingPhase.activeStepIndex)
    ).toBe("active");
  });

  it("shows all steps completed on the ready phase", () => {
    const { completedStepIndex, activeStepIndex } = getStepperConfig("ready");
    expect(completedStepIndex).toBe(2);
    expect(activeStepIndex).toBe(3);
    expect(getSignupStepIconVariant(0, completedStepIndex, activeStepIndex)).toBe("completed");
    expect(getSignupStepIconVariant(1, completedStepIndex, activeStepIndex)).toBe("completed");
    expect(getSignupStepIconVariant(2, completedStepIndex, activeStepIndex)).toBe("completed");
  });
});
