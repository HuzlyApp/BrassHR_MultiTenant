import { describe, expect, it } from "vitest";
import { applicationCurrentStageMeta, applicationStatusLabel } from "@/lib/jobs/application-status";

describe("applicationCurrentStageMeta", () => {
  it("does not label the hired system key as an employment hire", () => {
    expect(applicationCurrentStageMeta("hired")).toEqual({
      label: "Selected by Client",
      subtitle: "Client selected",
      progress: 100,
      barColor: "#14B8A6",
    });
    expect(applicationStatusLabel("hired")).toBe("Selected by Client");
  });

  it("uses the tenant status name when Current Stage is shown", () => {
    const stage = applicationCurrentStageMeta("hired", "Candidate selected");
    expect(stage.label).toBe("Candidate selected");
    expect(stage.subtitle).toBe("");
    expect(stage.label).not.toBe("Hired");
    expect(stage.subtitle).not.toBe("Offer accepted");
  });
});
