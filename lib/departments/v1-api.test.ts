import { describe, expect, it } from "vitest";
import { departmentCreateSchema, departmentPatchSchema, departmentListSchema } from "./v1-api";
import { listDepartmentApiRecords, writeDepartmentApiRecord } from "./service";

function db(result: unknown = { data: [], count: 0, error: null }) {
  const calls: Array<[string, ...unknown[]]> = [];
  const chain = new Proxy({}, { get: (_, method: string) => method === "then"
    ? (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
    : (...args: unknown[]) => { calls.push([method, ...args]); return chain; } });
  return { supabase: { from: (...args: unknown[]) => { calls.push(["from", ...args]); return chain; } } as never, calls };
}

describe("v1 department contract and tenant isolation", () => {
  it("rejects tenant reassignment and empty patches", () => {
    expect(departmentCreateSchema.safeParse({ name: "Nursing", tenant_id: "foreign" }).success).toBe(false);
    expect(departmentPatchSchema.safeParse({}).success).toBe(false);
    expect(departmentPatchSchema.safeParse({ parent_department_id: "not-a-uuid" }).success).toBe(false);
  });
  it("validates pagination and explicit inactive filtering", () => {
    expect(departmentListSchema.parse({})).toEqual({ page: 1, limit: 25, include_inactive: "false" });
    expect(departmentListSchema.safeParse({ limit: "101" }).success).toBe(false);
    expect(departmentListSchema.safeParse({ include_inactive: "yes" }).success).toBe(false);
  });
  it("scopes paginated lists and filters active rows by default", async () => {
    const { supabase, calls } = db();
    await listDepartmentApiRecords(supabase, "tenant-a", false, 2, 25);
    expect(calls).toContainEqual(["eq", "tenant_id", "tenant-a"]);
    expect(calls).toContainEqual(["eq", "is_active", true]);
    expect(calls).toContainEqual(["range", 25, 49]);
  });
  it("scopes soft deletion to both tenant and record", async () => {
    const { supabase, calls } = db({ data: null, error: null });
    expect(await writeDepartmentApiRecord(supabase, "tenant-a", "foreign-department", { is_active: false })).toBeNull();
    expect(calls).toContainEqual(["eq", "tenant_id", "tenant-a"]);
    expect(calls).toContainEqual(["eq", "id", "foreign-department"]);
    expect(calls).toContainEqual(["update", { is_active: false }]);
    expect(calls.some(([method]) => method === "delete")).toBe(false);
  });
  it("rejects a parent outside the tenant before inserting", async () => {
    const { supabase, calls } = db({ data: null, error: null });
    await expect(writeDepartmentApiRecord(supabase, "tenant-a", null, { name: "Nursing", parent_department_id: "foreign" }))
      .rejects.toMatchObject({ code: "23503" });
    expect(calls).toContainEqual(["eq", "tenant_id", "tenant-a"]);
    expect(calls.some(([method]) => method === "insert")).toBe(false);
  });
  it("assigns the authorized tenant on insert", async () => {
    const { supabase, calls } = db({ data: { id: "new" }, error: null });
    await writeDepartmentApiRecord(supabase, "tenant-a", null, { name: " Nursing " });
    expect(calls).toContainEqual(["insert", { name: "Nursing", tenant_id: "tenant-a" }]);
  });
  it("preserves existing tenant-scoped job labels when renaming", async () => {
    const { supabase, calls } = db({ data: { id: "department-a" }, error: null });
    await writeDepartmentApiRecord(supabase, "tenant-a", "department-a", { name: "Nursing" });
    expect(calls).toContainEqual(["from", "job_requisitions"]);
    expect(calls).toContainEqual(["update", { department: "Nursing" }]);
    expect(calls).toContainEqual(["eq", "department_id", "department-a"]);
    expect(calls.filter(([method, key, value]) => method === "eq" && key === "tenant_id" && value === "tenant-a")).toHaveLength(2);
  });
});
