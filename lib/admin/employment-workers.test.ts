import { describe, expect, it } from "vitest";
import { employmentWorkerClientName, employmentWorkerStatusLabel } from "./employment-workers";
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
});
