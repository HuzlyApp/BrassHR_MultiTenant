import { describe, expect, it } from "vitest";

/** Mirrors CandidateDetailChrome progressSteps filtering (BUG-169). */
function progressStepsForTab(
  steps: Array<{ state: string; phase?: "pre_hire" | "post_hire" }>,
  activeTab: string
) {
  if (activeTab === "Post-Hire") {
    return steps.filter((step) => step.phase === "post_hire");
  }
  return steps.filter((step) => (step.phase ?? "pre_hire") !== "post_hire");
}

describe("candidate header progress steps (BUG-169)", () => {
  const steps = [
    ...Array.from({ length: 25 }, () => ({ state: "pending" as const, phase: "pre_hire" as const })),
    ...Array.from({ length: 19 }, () => ({ state: "pending" as const, phase: "post_hire" as const })),
  ];

  it("Profile counts pre-hire upcoming only (not pre+post)", () => {
    const profile = progressStepsForTab(steps, "Profile");
    expect(profile.filter((s) => s.state === "pending")).toHaveLength(25);
  });

  it("Pre-Hire matches Profile upcoming count", () => {
    const pre = progressStepsForTab(steps, "Pre-Hire");
    const profile = progressStepsForTab(steps, "Profile");
    expect(pre.filter((s) => s.state === "pending")).toHaveLength(25);
    expect(pre).toHaveLength(profile.length);
  });

  it("Post-Hire counts post-hire only", () => {
    expect(progressStepsForTab(steps, "Post-Hire")).toHaveLength(19);
  });
});
