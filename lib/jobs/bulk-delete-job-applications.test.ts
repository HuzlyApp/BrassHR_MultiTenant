import { beforeEach, describe, expect, it, vi } from "vitest";

const bulkDeleteWorkers = vi.hoisted(() => vi.fn());

vi.mock("@/lib/workers/bulk-delete-workers", () => ({
  bulkDeleteWorkers,
}));

import {
  bulkDeleteJobApplications,
  deleteOrphanWorkersAfterApplicationDelete,
} from "@/lib/jobs/service";

describe("bulkDeleteJobApplications orphan cleanup helpers", () => {
  beforeEach(() => {
    bulkDeleteWorkers.mockReset();
  });

  it("returns linked worker ids when deleting applications", async () => {
    const selectBuilder: Record<string, unknown> = {};
    selectBuilder.select = vi.fn(() => selectBuilder);
    selectBuilder.in = vi.fn(() => selectBuilder);
    selectBuilder.eq = vi.fn(async () => ({
      data: [
        { id: "app-1", worker_id: "w1" },
        { id: "app-2", worker_id: "w1" },
        { id: "app-3", worker_id: "w2" },
      ],
      error: null,
    }));

    const deleteBuilder: Record<string, unknown> = {};
    deleteBuilder.delete = vi.fn(() => deleteBuilder);
    deleteBuilder.in = vi.fn(() => deleteBuilder);
    deleteBuilder.eq = vi.fn(() => deleteBuilder);
    deleteBuilder.select = vi.fn(async () => ({
      data: [{ id: "app-1" }, { id: "app-2" }, { id: "app-3" }],
      error: null,
    }));

    const from = vi.fn((table: string) => {
      if (table === "job_applications") {
        // first call is select before delete; second is delete chain
        if (from.mock.calls.length === 1) return selectBuilder;
        return deleteBuilder;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await bulkDeleteJobApplications({ from } as never, "tenant-1", [
      "app-1",
      "app-2",
      "app-3",
    ]);

    expect(result.deletedIds).toEqual(["app-1", "app-2", "app-3"]);
    expect(result.workerIds.sort()).toEqual(["w1", "w2"]);
  });

  it("hard-deletes workers that have no remaining applications", async () => {
    const remainingBuilder: Record<string, unknown> = {};
    remainingBuilder.select = vi.fn(() => remainingBuilder);
    remainingBuilder.in = vi.fn(() => remainingBuilder);
    remainingBuilder.eq = vi.fn(async () => ({
      data: [{ worker_id: "w2" }],
      error: null,
    }));

    const from = vi.fn(() => remainingBuilder);
    bulkDeleteWorkers.mockResolvedValue({ deletedIds: ["w1"] });

    const result = await deleteOrphanWorkersAfterApplicationDelete(
      { from } as never,
      "tenant-1",
      ["w1", "w2"]
    );

    expect(bulkDeleteWorkers).toHaveBeenCalledWith(
      expect.anything(),
      "tenant-1",
      ["w1"]
    );
    expect(result).toEqual({ deletedWorkerIds: ["w1"] });
  });

  it("does not delete workers that still have applications", async () => {
    const remainingBuilder: Record<string, unknown> = {};
    remainingBuilder.select = vi.fn(() => remainingBuilder);
    remainingBuilder.in = vi.fn(() => remainingBuilder);
    remainingBuilder.eq = vi.fn(async () => ({
      data: [{ worker_id: "w1" }, { worker_id: "w2" }],
      error: null,
    }));

    const from = vi.fn(() => remainingBuilder);

    const result = await deleteOrphanWorkersAfterApplicationDelete(
      { from } as never,
      "tenant-1",
      ["w1", "w2"]
    );

    expect(bulkDeleteWorkers).not.toHaveBeenCalled();
    expect(result).toEqual({ deletedWorkerIds: [] });
  });
});
