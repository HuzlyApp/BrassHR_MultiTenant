import { describe, expect, it, vi } from "vitest";
import { loadWorkerCallLogs } from "./worker-call-logs";
describe("tenant-scoped call logs", () => {
  it("scopes an empty call-log result by both candidate and tenant", async () => {
    const query = { select: () => query, eq: vi.fn(() => query), order: async () => ({ data: [], error: null }) };
    expect(await loadWorkerCallLogs({ from: () => query } as never, "candidate-a", "tenant-a")).toEqual([]);
    expect(query.eq).toHaveBeenCalledWith("tenant_id", "tenant-a");
    expect(query.eq).toHaveBeenCalledWith("worker_id", "candidate-a");
  });
});
