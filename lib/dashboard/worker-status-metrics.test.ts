import { describe, expect, it, vi } from "vitest";
import { fetchWorkerStatusMetrics } from "@/lib/dashboard/worker-status-metrics";

describe("fetchWorkerStatusMetrics", () => {
  it("returns grouped counts from worker_status_metrics RPC", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        total: 10,
        employment_total: 6,
        active: 4,
        employment_new: 1,
        on_leave: 0,
        inactive: 1,
        terminated: 1,
        pipeline_total: 10,
        pipeline_active: 2,
        pipeline_new: 5,
        pipeline_inactive: 2,
        pipeline_terminated: 1,
        applications: 3,
        offer_extended: 2,
        hires: 5,
        pending_workers: 1,
      },
      error: null,
    }));
    const supabase = { rpc } as unknown as Parameters<typeof fetchWorkerStatusMetrics>[0];

    const metrics = await fetchWorkerStatusMetrics(supabase, "tenant-1");

    expect(rpc).toHaveBeenCalledWith("worker_status_metrics", { p_tenant_id: "tenant-1" });
    expect(metrics).toEqual({
      total: 10,
      employment_total: 6,
      active: 4,
      employment_new: 1,
      on_leave: 0,
      inactive: 1,
      terminated: 1,
      pipeline_total: 10,
      pipeline_active: 2,
      pipeline_new: 5,
      pipeline_inactive: 2,
      pipeline_terminated: 1,
      applications: 3,
      offer_extended: 2,
      hires: 5,
      pending_workers: 1,
    });
  });

  it("throws when RPC fails", async () => {
    const supabase = {
      rpc: vi.fn(async () => ({ data: null, error: new Error("rpc failed") })),
    } as unknown as Parameters<typeof fetchWorkerStatusMetrics>[0];

    await expect(fetchWorkerStatusMetrics(supabase, "tenant-1")).rejects.toThrow("rpc failed");
  });
});
