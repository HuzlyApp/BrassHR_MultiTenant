import { describe, expect, it } from "vitest";
import {
  resolveVerificationPipelineStatus,
  resolveWorkerApplicationStatusLabel,
} from "./worker-application-status";

describe("resolveWorkerApplicationStatusLabel", () => {
  it("shows Approved when worker is approved", () => {
    expect(
      resolveWorkerApplicationStatusLabel({
        applicationStatus: "new",
        submittedAt: "2026-08-12T10:00:00.000Z",
        workerStatus: "approved",
      })
    ).toBe("Approved");
  });

  it("shows Approved when all steps are complete and worker is approved", () => {
    expect(
      resolveWorkerApplicationStatusLabel({
        applicationStatus: "new",
        submittedAt: null,
        workerStatus: "approved",
        allStepsComplete: true,
      })
    ).toBe("Approved");
  });

  it("shows Pending when any step is incomplete even if submitted_at is set", () => {
    expect(
      resolveWorkerApplicationStatusLabel({
        applicationStatus: "new",
        submittedAt: "2026-08-12T10:00:00.000Z",
        workerStatus: "pending",
        allStepsComplete: false,
      })
    ).toBe("Pending");
  });

  it("shows Pending when steps are incomplete even if worker is approved", () => {
    expect(
      resolveWorkerApplicationStatusLabel({
        applicationStatus: "new",
        submittedAt: null,
        workerStatus: "approved",
        allStepsComplete: false,
      })
    ).toBe("Pending");
  });

  it("shows Pending when not submitted even if recruiting status is new", () => {
    expect(
      resolveWorkerApplicationStatusLabel({
        applicationStatus: "new",
        submittedAt: null,
        workerStatus: "pending",
      })
    ).toBe("Pending");
  });

  it("shows Submitted for submitted new applications when all steps are complete", () => {
    expect(
      resolveWorkerApplicationStatusLabel({
        applicationStatus: "new",
        submittedAt: "2026-08-12T10:00:00.000Z",
        workerStatus: "pending",
        allStepsComplete: true,
      })
    ).toBe("Submitted");
  });
});

describe("resolveVerificationPipelineStatus", () => {
  it("marks verification pending when any step is incomplete", () => {
    const result = resolveVerificationPipelineStatus({
      submittedAt: "2026-08-12T10:00:00.000Z",
      workerStatus: "pending",
      allStepsComplete: false,
    });
    expect(result.status).toBe("pending");
    expect(result.statusLabel).toBe("Pending");
  });

  it("marks verification approved when steps are complete and worker is approved", () => {
    const result = resolveVerificationPipelineStatus({
      submittedAt: null,
      workerStatus: "approved",
      allStepsComplete: true,
    });
    expect(result.status).toBe("completed");
    expect(result.statusLabel).toBe("Approved");
  });
});
