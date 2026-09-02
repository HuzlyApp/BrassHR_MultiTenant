import { describe, expect, it } from "vitest";
import { resolveWorkforceBuckets } from "@/lib/dashboard/workforce-analytics";
import { emptyWorkerStatusMetrics } from "@/lib/dashboard/worker-status-metrics";

describe("resolveWorkforceBuckets", () => {
  it("uses employment counts when employment records exist", () => {
    const buckets = resolveWorkforceBuckets({
      ...emptyWorkerStatusMetrics,
      employment_total: 5,
      active: 3,
      employment_new: 1,
      inactive: 1,
      terminated: 0,
      pipeline_total: 100,
      pipeline_active: 10,
      pipeline_new: 80,
      pipeline_inactive: 5,
      pipeline_terminated: 5,
    });

    expect(buckets).toEqual({
      active: 3,
      newHires: 1,
      inactive: 1,
      terminated: 0,
      total: 5,
      source: "employment",
    });
  });

  it("falls back to pipeline counts when no employment records exist", () => {
    const buckets = resolveWorkforceBuckets({
      ...emptyWorkerStatusMetrics,
      employment_total: 0,
      pipeline_total: 3264,
      pipeline_active: 12,
      pipeline_new: 3200,
      pipeline_inactive: 40,
      pipeline_terminated: 12,
    });

    expect(buckets).toEqual({
      active: 12,
      newHires: 3200,
      inactive: 40,
      terminated: 12,
      total: 3264,
      source: "pipeline",
    });
  });
});
