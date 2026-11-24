import { beforeEach, describe, expect, it, vi } from "vitest";

const queryInChunks = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/chunked-in-query", () => ({
  queryInChunks: (...args: unknown[]) => queryInChunks(...args),
}));

import { getApplicationStatusSummariesForWorkers } from "./attach-worker-application-status";

describe("application appliedAt (BUG-172)", () => {
  beforeEach(() => {
    queryInChunks.mockReset();
  });

  it("prefers submitted_at over created_at for Application Date", async () => {
    queryInChunks.mockResolvedValue({
      data: [
        {
          id: "app-new",
          worker_id: "worker-1",
          status: "new",
          status_id: null,
          source: "match",
          job_requisition_id: "job-1",
          submitted_at: "2026-11-23T15:00:00.000Z",
          created_at: "2026-11-20T10:00:00.000Z",
          updated_at: "2026-11-23T15:00:00.000Z",
          application_statuses: null,
          job_requisitions: { public_title: "ICU RN", source_type: "Internal" },
        },
      ],
      error: null,
    });

    const map = await getApplicationStatusSummariesForWorkers({} as never, {
      workerIds: ["worker-1"],
    });
    expect(map.get("worker-1")?.appliedAt).toBe("2026-11-23T15:00:00.000Z");
    expect(map.get("worker-1")?.jobTitle).toBe("ICU RN");
  });
});
