import { describe, expect, it, vi } from "vitest";
import { fetchWorkerStatusMetrics } from "@/lib/dashboard/worker-status-metrics";

describe("fetchWorkerStatusMetrics", () => {
  it("returns grouped counts from worker_status_metrics RPC", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        total: 10,
        active: 4,
        on_leave: 2,
        inactive: 1,
        terminated: 1,
        applications: 3,
        offer_extended: 2,
        hires: 4,
        pending_workers: 1,
      },
      error: null,
    }));
    const supabase = { rpc } as unknown as Parameters<typeof fetchWorkerStatusMetrics>[0];

    const metrics = await fetchWorkerStatusMetrics(supabase, "tenant-1");

    expect(rpc).toHaveBeenCalledWith("worker_status_metrics", { p_tenant_id: "tenant-1" });
    expect(metrics).toEqual({
      total: 10,
      active: 4,
      on_leave: 2,
      inactive: 1,
      terminated: 1,
      applications: 3,
      offer_extended: 2,
      hires: 4,
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
