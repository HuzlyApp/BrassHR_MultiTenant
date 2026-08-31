import type { WorkerStatusMetrics } from "@/lib/dashboard/worker-status-metrics";

export type WorkforceBuckets = {
  active: number;
  newHires: number;
  inactive: number;
  terminated: number;
  total: number;
  source: "employment" | "pipeline";
};

export function resolveWorkforceBuckets(metrics: WorkerStatusMetrics): WorkforceBuckets {
  if (metrics.employment_total > 0) {
    const active = metrics.active;
    const newHires = metrics.employment_new;
    const inactive = metrics.inactive;
    const terminated = metrics.terminated;
    return {
      active,
      newHires,
      inactive,
      terminated,
      total: metrics.employment_total || active + newHires + inactive + terminated,
      source: "employment",
    };
  }

  const active = metrics.pipeline_active;
  const newHires = metrics.pipeline_new;
  const inactive = metrics.pipeline_inactive;
  const terminated = metrics.pipeline_terminated;
  return {
    active,
    newHires,
    inactive,
    terminated,
    total: metrics.pipeline_total || active + newHires + inactive + terminated,
    source: "pipeline",
  };
}
