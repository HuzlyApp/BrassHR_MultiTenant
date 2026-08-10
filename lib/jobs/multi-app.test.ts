import { describe, expect, it, vi } from "vitest";
import { resolveApplicationContextForWorker } from "./resolve-application-context";
import { markApplicationInterviewing } from "@/lib/interviews/mark-application-interviewing";

type QueryResult = { data: unknown; error: null | { message: string; code?: string } };

function makeAppsQuery(handlers: {
  selectResult?: QueryResult;
  updateResult?: QueryResult;
}) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder.select = vi.fn(self);
  builder.update = vi.fn(() => {
    builder.__mode = "update";
    return builder;
  });
  builder.eq = vi.fn(self);
  builder.not = vi.fn(self);
  builder.order = vi.fn(self);
  builder.limit = vi.fn(self);
  builder.is = vi.fn(self);
  builder.maybeSingle = vi.fn(async () => {
    if (builder.__mode === "update") {
      return handlers.updateResult ?? { data: null, error: null };
    }
    return handlers.selectResult ?? { data: null, error: null };
  });
  builder.then = (
    onFulfilled?: (value: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => {
    const result = handlers.selectResult ?? { data: [], error: null };
    return Promise.resolve(result).then(onFulfilled, onRejected);
  };
  return builder;
}

describe("resolveApplicationContextForWorker", () => {
  it("returns explicit application when it belongs to the worker", async () => {
    const apps = makeAppsQuery({
      selectResult: { data: { id: "app-1" }, error: null },
    });
    const supabase = { from: vi.fn(() => apps) };

    const result = await resolveApplicationContextForWorker({
      supabase: supabase as never,
      tenantId: "t1",
      workerId: "w1",
      applicationId: "app-1",
    });

    expect(result).toEqual({ applicationId: "app-1", ambiguous: false });
  });

  it("auto-picks when worker has exactly one active application", async () => {
    const apps = makeAppsQuery({
      selectResult: { data: [{ id: "app-only" }], error: null },
    });
    const supabase = { from: vi.fn(() => apps) };

    const result = await resolveApplicationContextForWorker({
      supabase: supabase as never,
      tenantId: "t1",
      workerId: "w1",
    });

    expect(result).toEqual({ applicationId: "app-only", ambiguous: false });
  });

  it("marks ambiguous when worker has multiple active applications", async () => {
    const apps = makeAppsQuery({
      selectResult: { data: [{ id: "app-1" }, { id: "app-2" }], error: null },
    });
    const supabase = { from: vi.fn(() => apps) };

    const result = await resolveApplicationContextForWorker({
      supabase: supabase as never,
      tenantId: "t1",
      workerId: "w1",
    });

    expect(result).toEqual({ applicationId: null, ambiguous: true });
  });
});

describe("markApplicationInterviewing", () => {
  function makeSupabaseForInterviewing(applicationId: string) {
    const interviewing = {
      id: "status-interviewing",
      tenant_id: "t1",
      name: "Interviewing",
      description: null,
      color: null,
      sort_order: 3,
      is_active: true,
      is_default: false,
      system_key: "interviewing",
      created_by: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const apps = makeAppsQuery({
      selectResult: { data: { id: applicationId }, error: null },
    });
    return {
      from: vi.fn((table: string) => {
        if (table === "application_statuses") {
          const builder: Record<string, unknown> = {};
          const self = () => builder;
          builder.select = vi.fn(self);
          builder.eq = vi.fn(self);
          builder.maybeSingle = vi.fn(async () => ({ data: interviewing, error: null }));
          return builder;
        }
        return apps;
      }),
      rpc: vi.fn(async (fn: string) => {
        if (fn === "ensure_default_application_statuses") {
          return { data: null, error: null };
        }
        return {
          data: {
            unchanged: false,
            application: {
              id: applicationId,
              statusId: interviewing.id,
              status: "interviewing",
              statusName: "Interviewing",
            },
            history: {
              id: "h1",
              fromStatusId: null,
              fromStatusName: null,
              toStatusId: interviewing.id,
              toStatusName: "Interviewing",
              note: null,
              changedByUserId: null,
              changedAt: "2026-08-10T12:00:00Z",
            },
          },
          error: null,
        };
      }),
    };
  }

  it("updates explicit application id", async () => {
    const supabase = makeSupabaseForInterviewing("app-1");

    const result = await markApplicationInterviewing({
      supabase: supabase as never,
      tenantId: "t1",
      workerId: "w1",
      applicationId: "app-1",
    });

    expect(result).toEqual({ updated: true, applicationId: "app-1" });
  });

  it("does not fall back to latest-by-worker without jobId", async () => {
    const supabase = { from: vi.fn(), rpc: vi.fn() };

    const result = await markApplicationInterviewing({
      supabase: supabase as never,
      tenantId: "t1",
      workerId: "w1",
    });

    expect(result).toEqual({ updated: false, applicationId: null });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("resolves by worker + job when applicationId omitted", async () => {
    const supabase = makeSupabaseForInterviewing("app-job");

    const result = await markApplicationInterviewing({
      supabase: supabase as never,
      tenantId: "t1",
      workerId: "w1",
      jobId: "job-1",
    });

    expect(result.applicationId).toBe("app-job");
    expect(result.updated).toBe(true);
  });
});

describe("multi-app duplicate status isolation (unit)", () => {
  it("keeps application statuses independent conceptually", () => {
    const apps = [
      { id: "a1", status: "interviewing" },
      { id: "a2", status: "new" },
    ];
    const updated = apps.map((app) =>
      app.id === "a1" ? { ...app, status: "hired" } : app
    );
    expect(updated.find((a) => a.id === "a2")?.status).toBe("new");
    expect(updated.find((a) => a.id === "a1")?.status).toBe("hired");
  });
});
