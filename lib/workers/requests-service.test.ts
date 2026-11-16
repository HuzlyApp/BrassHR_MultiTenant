import { describe, expect, it } from "vitest";
import { requestCreateSchema, requestListSchema, requestReviewSchema } from "./requests-contract";
import { createWorkerRequest, listWorkerRequests, reviewWorkerRequest } from "./requests-service";

const tenant = "10000000-0000-4000-8000-000000000001";
const worker = "10000000-0000-4000-8000-000000000002";
const actor = "10000000-0000-4000-8000-000000000003";
const input = requestCreateSchema.parse({ request_type: "time_off", start_date: "2026-11-20", end_date: "2026-11-21", reason: "Vacation" });
function db(results: Record<string, unknown> = {}) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const supabase = {
    from: (table: string) => {
      const chain = new Proxy({}, { get: (_, method: string) => method === "then"
        ? (resolve: (v: unknown) => unknown) => Promise.resolve(results[table] ?? { data: [], error: null, count: 0 }).then(resolve)
        : (...args: unknown[]) => { calls.push({ table, method, args }); return chain; } });
      return chain;
    },
    rpc: (name: string, params: unknown) => { calls.push({ table: name, method: "rpc", args: [params] }); return Promise.resolve({ data: { status: "approved" }, error: null }); },
  };
  return { supabase: supabase as never, calls };
}

describe("worker request contracts", () => {
  it("validates actual dates, ordering, request types and pagination", () => {
    expect(requestCreateSchema.safeParse({ ...input, start_date: "2026-02-30" }).success).toBe(false);
    expect(requestCreateSchema.safeParse({ ...input, end_date: "2026-11-01" }).success).toBe(false);
    expect(requestCreateSchema.safeParse({ ...input, request_type: "schedule_change", off_type: "Vacation" }).success).toBe(false);
    expect(requestListSchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(requestListSchema.safeParse({ date_from: "2026-11-30", date_to: "2026-11-01" }).success).toBe(false);
  });
  it("rejects mass assignment of tenant, status, creator and reviewer", () => {
    for (const field of ["tenant_id", "status", "created_by", "reviewed_by", "reviewed_at"]) {
      expect(requestCreateSchema.safeParse({ ...input, [field]: actor }).success).toBe(false);
    }
    expect(requestReviewSchema.safeParse({ notes: "OK", reviewed_by: actor }).success).toBe(false);
    expect(requestReviewSchema.parse({})).toEqual({});
  });
});

describe("worker request service isolation", () => {
  it("scopes worker lists to tenant and owned profiles with overlap and filters", async () => {
    const { supabase, calls } = db();
    await listWorkerRequests(supabase, tenant, [worker], requestListSchema.parse({
      type: "time_off", status: "pending", date_from: "2026-11-01", date_to: "2026-11-30", page: 2,
    }));
    expect(calls).toContainEqual({ table: "worker_requests", method: "eq", args: ["tenant_id", tenant] });
    expect(calls).toContainEqual({ table: "worker_requests", method: "in", args: ["worker_id", [worker]] });
    expect(calls).toContainEqual({ table: "worker_requests", method: "gte", args: ["end_date", "2026-11-01"] });
    expect(calls).toContainEqual({ table: "worker_requests", method: "range", args: [25,49] });
  });
  it("blocks self-service worker impersonation before querying", async () => {
    const { supabase, calls } = db();
    await expect(createWorkerRequest(supabase, tenant, actor, [worker], { ...input, worker_id: actor }))
      .rejects.toMatchObject({ status: 403 });
    expect(calls).toHaveLength(0);
  });
  it("requires staff to choose a worker and rejects foreign workers", async () => {
    const { supabase, calls } = db({ worker: { data: null, error: null } });
    await expect(createWorkerRequest(supabase, tenant, actor, null, input)).rejects.toMatchObject({ status: 422 });
    await expect(createWorkerRequest(supabase, tenant, actor, null, { ...input, worker_id: worker })).rejects.toMatchObject({ status: 404 });
    expect(calls).toContainEqual({ table: "worker", method: "eq", args: ["tenant_id", tenant] });
  });
  it("derives creator and department on insert without creating leave", async () => {
    const { supabase, calls } = db({ worker: { data: { id: worker, department_id: null }, error: null } });
    await createWorkerRequest(supabase, tenant, actor, [worker], input);
    expect(calls.find((c) => c.table === "worker_requests" && c.method === "insert")?.args[0])
      .toMatchObject({ tenant_id: tenant, worker_id: worker, created_by: actor, department_id: null, off_type: "Personal Leave" });
    expect(calls.some((c) => c.table === "worker_time_off")).toBe(false);
  });
  it("requires worker-related shifts to be assigned to the current worker", async () => {
    const { supabase, calls } = db({ worker: { data: { id: worker, department_id: null }, error: null }, worker_shift_assignments: { data: null, error: null } });
    await expect(createWorkerRequest(supabase, tenant, actor, [worker], { ...input, related_shift_id: tenant })).rejects.toMatchObject({ status: 403 });
    expect(calls).toContainEqual({ table: "worker_shift_assignments", method: "eq", args: ["tenant_id", tenant] });
    expect(calls.some((c) => c.method === "insert")).toBe(false);
  });
  it("passes only the server tenant and actor to atomic review", async () => {
    const { supabase, calls } = db();
    await reviewWorkerRequest(supabase, tenant, actor, worker, "approved", "Reviewed");
    expect(calls).toContainEqual({ table: "review_worker_request", method: "rpc", args: [{
      p_tenant_id: tenant, p_request_id: worker, p_actor_id: actor, p_decision: "approved", p_notes: "Reviewed",
    }] });
  });
});
