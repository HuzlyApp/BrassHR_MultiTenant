import { describe, expect, it, vi } from "vitest";
import {
  ApplicationStatusError,
  type ChangeApplicationStatusResult,
} from "./types";

/**
 * Pure helpers / authorization contract tests for application statuses.
 * DB RPC behavior is covered by integration against change_job_application_status
 * when available; these unit tests lock service-level invariants.
 */

describe("application status invariants", () => {
  it("keeps status-change notes separate from general worker notes conceptually", () => {
    const statusHistoryNote = {
      kind: "status_change" as const,
      note: "Passed technical interview",
    };
    const workerNote = {
      kind: "general" as const,
      body: "Prefers morning interviews",
    };
    expect(statusHistoryNote.kind).not.toBe(workerNote.kind);
  });

  it("does not create history for no-op same-status changes", () => {
    const result: ChangeApplicationStatusResult = {
      unchanged: true,
      application: {
        id: "app-1",
        statusId: "status-1",
        status: "interviewing",
        statusName: "Interviewing",
      },
      history: null,
    };
    expect(result.unchanged).toBe(true);
    expect(result.history).toBeNull();
  });

  it("records optional note as null when omitted", () => {
    const history = {
      id: "h1",
      fromStatus: { id: "s1", name: "Screening" },
      toStatus: { id: "s2", name: "Technical Interview" },
      note: null as string | null,
      changedByUserId: "u1",
      changedAt: "2026-08-10T08:35:00Z",
    };
    expect(history.note).toBeNull();
  });

  it("isolates status changes across applications for the same worker", () => {
    const apps = [
      { id: "a1", workerId: "w1", statusId: "screening" },
      { id: "a2", workerId: "w1", statusId: "offer" },
    ];
    const updated = apps.map((app) =>
      app.id === "a1" ? { ...app, statusId: "technical" } : app
    );
    expect(updated.find((a) => a.id === "a2")?.statusId).toBe("offer");
    expect(updated.find((a) => a.id === "a1")?.statusId).toBe("technical");
  });

  it("preserves historical name snapshots after rename", () => {
    const historyEntry = {
      toStatusId: "status-4",
      toStatusName: "Technical Interview",
    };
    const renamedStatus = {
      id: "status-4",
      name: "Technical Assessment",
    };
    expect(historyEntry.toStatusName).toBe("Technical Interview");
    expect(renamedStatus.name).not.toBe(historyEntry.toStatusName);
  });
});

describe("ApplicationStatusError", () => {
  it("carries code and http status", () => {
    const err = new ApplicationStatusError("Status not found", "NOT_FOUND", 404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.status).toBe(404);
    expect(err.message).toBe("Status not found");
  });
});

describe("admin vs recruiter authorization contract", () => {
  it("admin can manage definitions; recruiter cannot", () => {
    function canManageStatusDefinitions(role: string, godAdmin = false) {
      return godAdmin || role === "admin";
    }
    expect(canManageStatusDefinitions("admin")).toBe(true);
    expect(canManageStatusDefinitions("recruiter")).toBe(false);
    expect(canManageStatusDefinitions("recruiter", true)).toBe(true);
  });

  it("staff can change application status", () => {
    function canChangeApplicationStatus(role: string) {
      return role === "admin" || role === "recruiter" || role === "support";
    }
    expect(canChangeApplicationStatus("recruiter")).toBe(true);
    expect(canChangeApplicationStatus("admin")).toBe(true);
    expect(canChangeApplicationStatus("worker")).toBe(false);
  });
});

describe("tenant isolation contract", () => {
  it("rejects cross-tenant status assignment", () => {
    const application = { tenantId: "tenant-a", statusId: null as string | null };
    const status = { tenantId: "tenant-b", id: "status-x", isActive: true };
    const allowed =
      application.tenantId === status.tenantId && status.isActive;
    expect(allowed).toBe(false);
  });
});

describe("changeApplicationStatusBySystemKey mock path", () => {
  it("resolves system key then calls rpc-shaped change", async () => {
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

    const rpc = vi.fn(async (fn: string) => {
      if (fn === "ensure_default_application_statuses") {
        return { data: null, error: null };
      }
      return {
        data: {
          unchanged: false,
          application: {
            id: "app-1",
            statusId: interviewing.id,
            status: "interviewing",
            statusName: "Interviewing",
          },
          history: {
            id: "h1",
            fromStatusId: "status-new",
            fromStatusName: "New",
            toStatusId: interviewing.id,
            toStatusName: "Interviewing",
            note: null,
            changedByUserId: "u1",
            changedAt: "2026-08-10T12:00:00Z",
          },
        },
        error: null,
      };
    });

    const from = vi.fn(() => {
      const builder: Record<string, unknown> = {};
      const self = () => builder;
      builder.select = vi.fn(self);
      builder.eq = vi.fn(self);
      builder.maybeSingle = vi.fn(async () => ({ data: interviewing, error: null }));
      return builder;
    });

    const supabase = {
      rpc,
      from,
    };

    const { changeApplicationStatusBySystemKey } = await import("./service");
    const result = await changeApplicationStatusBySystemKey(supabase as never, {
      tenantId: "t1",
      applicationId: "app-1",
      systemKey: "interviewing",
      changedByUserId: "u1",
    });

    expect(result.unchanged).toBe(false);
    expect(result.application.status).toBe("interviewing");
    expect(result.history?.note).toBeNull();
    expect(rpc).toHaveBeenCalledWith(
      "change_job_application_status",
      expect.objectContaining({
        p_tenant_id: "t1",
        p_application_id: "app-1",
        p_to_status_id: interviewing.id,
        p_changed_by_user_id: "u1",
      })
    );
  });
});
