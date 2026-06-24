import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  FirmaWorkspaceConfigError,
  isStoredFirmaWorkspaceMismatch,
  resolveFirmaWorkspaceIdFromEnv,
  resolveTenantFirmaWorkspaceId,
} from "@/lib/firma/resolve-tenant-workspace";

describe("resolveTenantFirmaWorkspaceId", () => {
  const originalWorkspace = process.env.FIRMA_WORKSPACE_ID;

  afterEach(() => {
    process.env.FIRMA_WORKSPACE_ID = originalWorkspace;
  });

  it("uses tenant firma_workspace_id when configured", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { firma_workspace_id: "ws-tenant-a" },
              error: null,
            }),
          }),
        }),
      })),
    };

    const workspaceId = await resolveTenantFirmaWorkspaceId(supabase as never, "tenant-a");
    expect(workspaceId).toBe("ws-tenant-a");
  });

  it("falls back to FIRMA_WORKSPACE_ID when tenant value is null", async () => {
    process.env.FIRMA_WORKSPACE_ID = "ws-global";
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { firma_workspace_id: null },
              error: null,
            }),
          }),
        }),
      })),
    };

    const workspaceId = await resolveTenantFirmaWorkspaceId(supabase as never, "tenant-a");
    expect(workspaceId).toBe("ws-global");
  });

  it("trims whitespace from tenant firma_workspace_id", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { firma_workspace_id: "  workspace_customer_a  " },
              error: null,
            }),
          }),
        }),
      })),
    };

    const workspaceId = await resolveTenantFirmaWorkspaceId(supabase as never, "tenant-a");
    expect(workspaceId).toBe("workspace_customer_a");
  });

  it("falls back to env when tenant workspace is whitespace-only", async () => {
    process.env.FIRMA_WORKSPACE_ID = "workspace_global";
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { firma_workspace_id: "   " },
              error: null,
            }),
          }),
        }),
      })),
    };

    const workspaceId = await resolveTenantFirmaWorkspaceId(supabase as never, "tenant-a");
    expect(workspaceId).toBe("workspace_global");
  });

  it("prefers trimmed tenant workspace over env fallback", async () => {
    process.env.FIRMA_WORKSPACE_ID = "workspace_global";
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { firma_workspace_id: "workspace_customer_a" },
              error: null,
            }),
          }),
        }),
      })),
    };

    const workspaceId = await resolveTenantFirmaWorkspaceId(supabase as never, "tenant-a");
    expect(workspaceId).toBe("workspace_customer_a");
    expect(workspaceId).not.toBe("workspace_global");
  });

  it("throws a clear error when neither tenant nor env workspace is configured", async () => {
    delete process.env.FIRMA_WORKSPACE_ID;
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { firma_workspace_id: null },
              error: null,
            }),
          }),
        }),
      })),
    };

    await expect(resolveTenantFirmaWorkspaceId(supabase as never, "tenant-a")).rejects.toMatchObject({
      name: "FirmaWorkspaceConfigError",
      code: "FIRMA_WORKSPACE_NOT_CONFIGURED",
      status: 503,
    });
  });
});

describe("isStoredFirmaWorkspaceMismatch", () => {
  it("treats null stored workspace as legacy-compatible", () => {
    expect(isStoredFirmaWorkspaceMismatch(null, "ws-current")).toBe(false);
    expect(isStoredFirmaWorkspaceMismatch("", "ws-current")).toBe(false);
  });

  it("detects stored workspace differences", () => {
    expect(isStoredFirmaWorkspaceMismatch("ws-old", "ws-new")).toBe(true);
    expect(isStoredFirmaWorkspaceMismatch("ws-same", "ws-same")).toBe(false);
  });
});

describe("resolveFirmaWorkspaceIdFromEnv", () => {
  it("reads trimmed FIRMA_WORKSPACE_ID", () => {
    process.env.FIRMA_WORKSPACE_ID = "  ws-env  ";
    expect(resolveFirmaWorkspaceIdFromEnv()).toBe("ws-env");
  });
});
