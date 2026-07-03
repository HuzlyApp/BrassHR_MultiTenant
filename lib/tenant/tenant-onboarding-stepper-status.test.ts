import { describe, expect, it } from "vitest";
import { deriveTenantOnboardingStepStates } from "@/lib/tenant/tenant-onboarding-stepper-status";

const noSkips = { goals: false, business: false, branding: false };

describe("tenant onboarding stepper status", () => {
  it("shows yellow skipped state only when goals were skipped", () => {
    const states = deriveTenantOnboardingStepStates({
      step: "business",
      skippedSteps: { goals: true, business: false, branding: false },
    });
    expect(states[0]).toBe("skipped");
    expect(states[1]).toBe("current");
  });

  it("shows gold completed check when goals were finished normally", () => {
    const states = deriveTenantOnboardingStepStates({
      step: "business",
      skippedSteps: noSkips,
    });
    expect(states[0]).toBe("completed");
    expect(states[1]).toBe("current");
  });

  it("shows yellow skipped state when business was skipped", () => {
    const states = deriveTenantOnboardingStepStates({
      step: "company_logo",
      skippedSteps: { goals: false, business: true, branding: false },
    });
    expect(states[1]).toBe("skipped");
    expect(states[2]).toBe("current");
  });

  it("shows yellow skipped state when branding was skipped", () => {
    const states = deriveTenantOnboardingStepStates({
      step: "domain",
      skippedSteps: { goals: false, business: false, branding: true },
    });
    expect(states[2]).toBe("skipped");
    expect(states[3]).toBe("current");
  });
});
