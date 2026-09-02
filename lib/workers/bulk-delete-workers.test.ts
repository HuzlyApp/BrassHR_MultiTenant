import { describe, expect, it, vi } from "vitest";
import { bulkDeleteWorkers } from "@/lib/workers/bulk-delete-workers";

describe("bulkDeleteWorkers", () => {
  it("returns no ids without calling the database when the list is empty", async () => {
    const rpc = vi.fn();
    const result = await bulkDeleteWorkers({ rpc } as never, "tenant-1", []);
    expect(result).toEqual({ deletedIds: [] });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("deletes workers through a single RPC instead of sequential table deletes", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ deleted_id: "w1" }, { deleted_id: "w2" }],
      error: null,
    }));
    const from = vi.fn();

    const result = await bulkDeleteWorkers({ rpc, from } as never, "tenant-1", ["w1", "w2"]);

    expect(from).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("bulk_delete_workers", {
      p_tenant_id: "tenant-1",
      p_worker_ids: ["w1", "w2"],
    });
    expect(result).toEqual({ deletedIds: ["w1", "w2"] });
  });

  it("throws when the atomic delete fails so callers do not treat a partial delete as success", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: "worker_requirements_worker_id_fkey" },
    }));

    await expect(
      bulkDeleteWorkers({ rpc } as never, "tenant-1", ["w1"])
    ).rejects.toMatchObject({ message: "worker_requirements_worker_id_fkey" });
  });
});
