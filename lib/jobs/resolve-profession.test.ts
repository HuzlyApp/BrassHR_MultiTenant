import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveProfessionIdForSave,
  resolveTenantProfessionForForm,
} from "@/lib/jobs/resolve-profession";

type QueryResult = { data: unknown; error: null };

function createQueryable(result: QueryResult, listResult?: QueryResult) {
  const state = { mode: "single" as "single" | "list" };
  const api: Record<string, unknown> = {};
  const self = () => api;
  api.select = vi.fn(self);
  api.eq = vi.fn(self);
  api.or = vi.fn(self);
  api.insert = vi.fn(self);
  api.maybeSingle = vi.fn(async () => {
    state.mode = "single";
    return result;
  });
  api.single = vi.fn(async () => result);
  // Supabase builder is thenable for list selects
  (api as { then: typeof Promise.prototype.then }).then = (
    onfulfilled: (value: QueryResult) => unknown,
    onrejected?: (reason: unknown) => unknown
  ) =>
    Promise.resolve(listResult ?? result).then(onfulfilled, onrejected);
  return api;
}

describe("resolveTenantProfessionForForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns tenant_professions row when id already matches", async () => {
    const from = vi.fn((table: string) => {
      if (table === "tenant_professions") {
        return createQueryable({
          data: { id: "tenant-prof-1", name: "IT Support" },
          error: null,
        });
      }
      return createQueryable({ data: null, error: null });
    });

    const result = await resolveTenantProfessionForForm({ from } as never, "tenant-1", {
      professionId: "tenant-prof-1",
      professionName: null,
    });

    expect(result).toEqual({ id: "tenant-prof-1", name: "IT Support" });
  });

  it("maps professions.id to tenant_professions by name", async () => {
    const from = vi.fn((table: string) => {
      if (table === "tenant_professions") {
        return createQueryable(
          { data: null, error: null },
          {
            data: [
              { id: "tenant-prof-1", name: "IT Support" },
              { id: "tenant-prof-2", name: "Accountant" },
            ],
            error: null,
          }
        );
      }
      if (table === "professions") {
        return createQueryable({ data: { name: "IT Support" }, error: null });
      }
      return createQueryable({ data: null, error: null });
    });

    const result = await resolveTenantProfessionForForm({ from } as never, "tenant-1", {
      professionId: "catalog-prof-9",
      professionName: null,
    });

    expect(result).toEqual({ id: "tenant-prof-1", name: "IT Support" });
  });

  it("maps using provided profession name when id is missing", async () => {
    const from = vi.fn((table: string) => {
      if (table === "tenant_professions") {
        return createQueryable(
          { data: null, error: null },
          {
            data: [{ id: "tenant-prof-2", name: "Accountant" }],
            error: null,
          }
        );
      }
      return createQueryable({ data: null, error: null });
    });

    const result = await resolveTenantProfessionForForm({ from } as never, "tenant-1", {
      professionId: null,
      professionName: "Accountant",
    });

    expect(result).toEqual({ id: "tenant-prof-2", name: "Accountant" });
  });
});

describe("resolveProfessionIdForSave", () => {
  it("maps tenant profession selection to professions.id by name", async () => {
    const from = vi.fn((table: string) => {
      if (table === "tenant_professions") {
        return createQueryable({ data: { name: "Accountant" }, error: null });
      }
      if (table === "professions") {
        return createQueryable(
          { data: null, error: null },
          {
            data: [{ id: "prof-catalog-1", name: "Accountant" }],
            error: null,
          }
        );
      }
      return createQueryable({ data: null, error: null });
    });

    const result = await resolveProfessionIdForSave({ from } as never, "tenant-1", {
      professionId: "tenant-prof-1",
      profession: "Accountant",
    });

    expect(result).toBe("prof-catalog-1");
  });
});
