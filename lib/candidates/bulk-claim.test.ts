import { beforeEach, describe, expect, it, vi } from "vitest";

const writeActivityLog = vi.fn(async (..._args: unknown[]) => undefined);

vi.mock("@/lib/audit/activity-log", () => ({
  writeActivityLog: (...args: unknown[]) => writeActivityLog(...args),
}));

import { bulkClaimWorkers } from "@/lib/candidates/bulk-claim";

type FakeRow = {
  id: string;
  tenant_id: string;
  status: string;
  assigned_recruiter_user_id: string | null;
};

function createFakeSupabase(state: { workers: FakeRow[]; rpcAvailable: boolean }) {
  return {
    from(table: string) {
      if (table === "users") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: { id: "recruiter-1", first_name: "Pat", last_name: "Lee", email: "pat@example.com" },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }
      if (table === "recruiter_activity_logs") {
        return {
          insert: async () => ({ error: null }),
        };
      }
      if (table === "worker") {
        return {
          select() {
            return {
              eq() {
                return {
                  in: async (_col: string, ids: string[]) => ({
                    data: state.workers.filter((w) => ids.includes(w.id)),
                    error: null,
                  }),
                };
              },
            };
          },
          update(payload: { assigned_recruiter_user_id: string }) {
            return {
              eq(_col: string, value: string) {
                return {
                  eq(_col2: string, tenantId: string) {
                    return {
                      is(_col3: string, _nullVal: null) {
                        return {
                          select() {
                            return {
                              maybeSingle: async () => {
                                const row = state.workers.find(
                                  (w) =>
                                    w.id === value &&
                                    w.tenant_id === tenantId &&
                                    w.assigned_recruiter_user_id == null
                                );
                                if (!row) return { data: null, error: null };
                                row.assigned_recruiter_user_id = payload.assigned_recruiter_user_id;
                                return { data: { id: row.id }, error: null };
                              },
                            };
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: async (name: string, args: { p_candidate_ids: string[]; p_recruiter_user_id: string; p_tenant_id: string }) => {
      if (!state.rpcAvailable || name !== "claim_worker_candidates") {
        return { data: null, error: { message: "function not found" } };
      }
      const rows = args.p_candidate_ids.map((id) => {
        const worker = state.workers.find((w) => w.id === id && w.tenant_id === args.p_tenant_id);
        if (!worker) return { candidate_id: id, outcome: "not_found", previous_owner: null };
        if (worker.assigned_recruiter_user_id) {
          return {
            candidate_id: id,
            outcome: "already_claimed",
            previous_owner: worker.assigned_recruiter_user_id,
          };
        }
        worker.assigned_recruiter_user_id = args.p_recruiter_user_id;
        return { candidate_id: id, outcome: "claimed", previous_owner: null };
      });
      return { data: rows, error: null };
    },
  };
}

describe("bulkClaimWorkers", () => {
  beforeEach(() => {
    writeActivityLog.mockClear();
  });

  it("claims multiple unclaimed candidates via RPC", async () => {
    const state = {
      rpcAvailable: true,
      workers: [
        { id: "c1", tenant_id: "t1", status: "new", assigned_recruiter_user_id: null },
        { id: "c2", tenant_id: "t1", status: "new", assigned_recruiter_user_id: null },
      ] as FakeRow[],
    };
    const result = await bulkClaimWorkers({
      supabase: createFakeSupabase(state) as never,
      tenantId: "t1",
      recruiterUserId: "recruiter-1",
      actorUserId: "recruiter-1",
      candidateIds: ["c1", "c2"],
      operationId: "op-1",
    });
    expect(result.claimed).toEqual(["c1", "c2"]);
    expect(state.workers.every((w) => w.assigned_recruiter_user_id === "recruiter-1")).toBe(true);
    expect(writeActivityLog).toHaveBeenCalledTimes(2);
  });

  it("skips already claimed candidates and does not overwrite", async () => {
    const state = {
      rpcAvailable: true,
      workers: [
        { id: "c1", tenant_id: "t1", status: "new", assigned_recruiter_user_id: null },
        { id: "c2", tenant_id: "t1", status: "new", assigned_recruiter_user_id: "other" },
      ] as FakeRow[],
    };
    const result = await bulkClaimWorkers({
      supabase: createFakeSupabase(state) as never,
      tenantId: "t1",
      recruiterUserId: "recruiter-1",
      actorUserId: "recruiter-1",
      candidateIds: ["c1", "c2"],
      operationId: "op-2",
    });
    expect(result.claimed).toEqual(["c1"]);
    expect(result.already_claimed).toEqual(["c2"]);
    expect(state.workers.find((w) => w.id === "c2")?.assigned_recruiter_user_id).toBe("other");
    expect(writeActivityLog).toHaveBeenCalledTimes(1);
  });

  it("rejects cross-tenant ids as not_found", async () => {
    const state = {
      rpcAvailable: true,
      workers: [
        { id: "c1", tenant_id: "other-tenant", status: "new", assigned_recruiter_user_id: null },
      ] as FakeRow[],
    };
    const result = await bulkClaimWorkers({
      supabase: createFakeSupabase(state) as never,
      tenantId: "t1",
      recruiterUserId: "recruiter-1",
      actorUserId: "recruiter-1",
      candidateIds: ["c1"],
      operationId: "op-3",
    });
    expect(result.not_found).toEqual(["c1"]);
    expect(writeActivityLog).not.toHaveBeenCalled();
  });

  it("is idempotent for repeated claim of already-owned rows", async () => {
    const state = {
      rpcAvailable: true,
      workers: [
        { id: "c1", tenant_id: "t1", status: "new", assigned_recruiter_user_id: "recruiter-1" },
      ] as FakeRow[],
    };
    const result = await bulkClaimWorkers({
      supabase: createFakeSupabase(state) as never,
      tenantId: "t1",
      recruiterUserId: "recruiter-1",
      actorUserId: "recruiter-1",
      candidateIds: ["c1"],
      operationId: "op-4",
    });
    expect(result.already_claimed).toEqual(["c1"]);
    expect(result.claimed).toEqual([]);
    expect(writeActivityLog).not.toHaveBeenCalled();
  });

  it("uses fallback conditional update when RPC is missing", async () => {
    const state = {
      rpcAvailable: false,
      workers: [
        { id: "c1", tenant_id: "t1", status: "new", assigned_recruiter_user_id: null },
      ] as FakeRow[],
    };
    const result = await bulkClaimWorkers({
      supabase: createFakeSupabase(state) as never,
      tenantId: "t1",
      recruiterUserId: "recruiter-1",
      actorUserId: "recruiter-1",
      candidateIds: ["c1"],
      operationId: "op-5",
    });
    expect(result.claimed).toEqual(["c1"]);
    expect(state.workers[0].assigned_recruiter_user_id).toBe("recruiter-1");
  });
});
