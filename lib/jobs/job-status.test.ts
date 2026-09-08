import { describe, expect, it } from "vitest";
import {
  canTransitionJobStatus,
  isOpenJobRequisitionStatus,
  normalizeJobRequisitionStatus,
} from "@/lib/jobs/job-status";

describe("normalizeJobRequisitionStatus", () => {
  it("maps legacy open/published values to open", () => {
    expect(normalizeJobRequisitionStatus("Published")).toBe("open");
    expect(normalizeJobRequisitionStatus("Open")).toBe("open");
    expect(normalizeJobRequisitionStatus("published")).toBe("open");
  });

  it("keeps paused and filled as first-class statuses", () => {
    expect(normalizeJobRequisitionStatus("Paused")).toBe("paused");
    expect(normalizeJobRequisitionStatus("Filled")).toBe("filled");
  });

  it("maps legacy closed values to closed", () => {
    expect(normalizeJobRequisitionStatus("Closed")).toBe("closed");
    expect(normalizeJobRequisitionStatus("Cancelled")).toBe("closed");
  });

  it("preserves archived", () => {
    expect(normalizeJobRequisitionStatus("archived")).toBe("archived");
  });
});

describe("isOpenJobRequisitionStatus", () => {
  it("is true only for open/published", () => {
    expect(isOpenJobRequisitionStatus("open")).toBe(true);
    expect(isOpenJobRequisitionStatus("published")).toBe(true);
    expect(isOpenJobRequisitionStatus("paused")).toBe(false);
    expect(isOpenJobRequisitionStatus("filled")).toBe(false);
  });
});

describe("canTransitionJobStatus", () => {
  it("allows open → paused/filled and paused → open", () => {
    expect(canTransitionJobStatus("open", "paused")).toBe(true);
    expect(canTransitionJobStatus("open", "filled")).toBe(true);
    expect(canTransitionJobStatus("paused", "open")).toBe(true);
    expect(canTransitionJobStatus("draft", "paused")).toBe(false);
  });
});
