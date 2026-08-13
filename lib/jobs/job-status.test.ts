import { describe, expect, it } from "vitest";
import { normalizeJobRequisitionStatus } from "@/lib/jobs/job-status";

describe("normalizeJobRequisitionStatus", () => {
  it("maps legacy open/published values to published", () => {
    expect(normalizeJobRequisitionStatus("Published")).toBe("published");
    expect(normalizeJobRequisitionStatus("Open")).toBe("published");
  });

  it("maps legacy closed values to closed", () => {
    expect(normalizeJobRequisitionStatus("Closed")).toBe("closed");
    expect(normalizeJobRequisitionStatus("Filled")).toBe("closed");
  });

  it("preserves archived", () => {
    expect(normalizeJobRequisitionStatus("archived")).toBe("archived");
  });
});
