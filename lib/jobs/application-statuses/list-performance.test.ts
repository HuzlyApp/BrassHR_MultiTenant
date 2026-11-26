import { describe, expect, it, vi } from "vitest";
import { listApplicationStatuses } from "./service";

function database(responses: Array<Record<string, unknown>>) {
  const filters: unknown[][] = [];
  const select = vi.fn();
  const rpc = vi.fn(async () => ({ error: null }));
  const from = vi.fn(() => ({ select: (columns: string, options?: unknown) => {
    select(columns, options);
    const response = responses.shift();
    if (!response) throw new Error("Unexpected extra database read");
    const query = {
      eq: (...args: unknown[]) => { filters.push(args); return query; },
      order: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve),
    };
    return query;
  } }));
  return { client: { from, rpc } as never, select, rpc, filters };
}
const row = { id: "status-a", tenant_id: "tenant-a", name: "Intake", is_active: true };

describe("status catalog read performance", () => {
  it("loads an existing catalog in one read without a count or seed RPC", async () => {
    const db = database([{ data: [row], error: null }]);
    expect(await listApplicationStatuses(db.client, "tenant-a")).toMatchObject([{ id: "status-a" }]);
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(db.rpc).not.toHaveBeenCalled();
    expect(db.filters).toContainEqual(["tenant_id", "tenant-a"]);
  });
  it("still initializes a genuinely empty tenant and reads the new statuses", async () => {
    const db = database([{ data: [], error: null }, { count: 0, error: null }, { data: [row], error: null }]);
    expect(await listApplicationStatuses(db.client, "tenant-a")).toHaveLength(1);
    expect(db.rpc).toHaveBeenCalledWith("ensure_default_application_statuses", { p_tenant_id: "tenant-a" });
    expect(db.filters.filter(([key]) => key === "tenant_id")).toHaveLength(3);
  });
  it("does not recreate deleted statuses when only inactive statuses remain", async () => {
    const db = database([{ data: [], error: null }, { count: 2, error: null }, { data: [], error: null }]);
    expect(await listApplicationStatuses(db.client, "tenant-a", { activeOnly: true })).toEqual([]);
    expect(db.rpc).not.toHaveBeenCalled();
    expect(db.filters.filter(([key]) => key === "is_active")).toHaveLength(2);
  });
  it("preserves the schema-lag fallback without seeding an existing catalog", async () => {
    const db = database([{ data: null, error: { message: "application_status_groups schema cache" } }, { data: [row], error: null }]);
    expect(await listApplicationStatuses(db.client, "tenant-a")).toHaveLength(1);
    expect(db.rpc).not.toHaveBeenCalled();
    expect(db.select).toHaveBeenCalledTimes(2);
  });
  it("propagates read errors without attempting a mutation", async () => {
    const error = { message: "Connection unavailable" };
    const db = database([{ data: null, error }]);
    await expect(listApplicationStatuses(db.client, "tenant-a")).rejects.toEqual(error);
    expect(db.rpc).not.toHaveBeenCalled();
  });
});
