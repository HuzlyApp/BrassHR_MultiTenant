import { describe, expect, it } from "vitest";
import {
  employmentWorkerClientName,
  employmentWorkerMissingOnboardingWorkflow,
  employmentWorkerStatusLabel,
} from "./employment-workers";
describe("worker directory presentation", () => {
  it("resolves known client names and leaves unknown clients empty", () => {
    expect(employmentWorkerClientName({ organization: "Client Organization", mspClient: "MSP client" })).toBe("Client Organization");
    expect(employmentWorkerClientName({ mspClient: "MSP client" })).toBe("MSP client");
    expect(employmentWorkerClientName({ snapshotClient: "Snapshot client" })).toBe("Snapshot client");
    expect(employmentWorkerClientName({})).toBe("—");
  });
  it("normalizes new workers to the onboarding filter label", () => {
    expect(employmentWorkerStatusLabel("new")).toBe("Onboarding");
    expect(employmentWorkerStatusLabel("Onboarding")).toBe("Onboarding");
    expect(employmentWorkerStatusLabel("active")).toBe("Active");
  });
  it("flags employment workers that have no source application for onboarding", () => {
    expect(employmentWorkerMissingOnboardingWorkflow({ source_job_application_id: null })).toBe(true);
    expect(employmentWorkerMissingOnboardingWorkflow({ source_job_application_id: "   " })).toBe(true);
    expect(
      employmentWorkerMissingOnboardingWorkflow({
        source_job_application_id: "770172ea-db0f-477a-9cf8-71f3d18da56d",
      })
    ).toBe(false);
  });
});
