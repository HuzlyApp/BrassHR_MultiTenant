import { describe, expect, it } from "vitest";
import {
  canTransitionJobStatus,
  jobLifecycleForSave,
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

describe("saving job lifecycle", () => {
  it.each(["closed", "filled", "archived"])("preserves %s and historical dates during edits", (status) => {
    const existing = { status, published_at: "2026-01-01", closed_at: "2026-02-01", archived_at: null };
    expect(jobLifecycleForSave(existing, false, "2026-11-25")).toEqual(existing);
  });
  it("keeps the first posted date when saving an open job", () => {
    expect(jobLifecycleForSave({ status: "open", published_at: "2026-01-01" }, true, "2026-11-25").published_at).toBe("2026-01-01");
  });
  it("creates new jobs as draft until published", () => {
    expect(jobLifecycleForSave(null, false, "2026-11-25").status).toBe("draft");
    expect(jobLifecycleForSave(null, true, "2026-11-25").published_at).toBe("2026-11-25");
  });
});
