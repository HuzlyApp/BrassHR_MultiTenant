import { beforeEach, describe, expect, it, vi } from "vitest";

const listFirmaWorkspaces = vi.fn();
const ensurePlatformTenantWithFirmaWorkspace = vi.fn();
const provisionFirmaWorkspaceForTenant = vi.fn();

vi.mock("@/lib/firma/client", () => ({
  listFirmaWorkspaces: (...args: unknown[]) => listFirmaWorkspaces(...args),
}));

vi.mock("@/lib/firma/platform-tenant", () => ({
  ensurePlatformTenantWithFirmaWorkspace: (...args: unknown[]) =>
    ensurePlatformTenantWithFirmaWorkspace(...args),
}));

vi.mock("@/lib/firma/provision-tenant-workspace", () => ({
  provisionFirmaWorkspaceForTenant: (...args: unknown[]) =>
    provisionFirmaWorkspaceForTenant(...args),
}));

describe("backfillFirmaWorkspacesForAllTenants", () => {
  beforeEach(() => {
    listFirmaWorkspaces.mockReset();
    ensurePlatformTenantWithFirmaWorkspace.mockReset();
    provisionFirmaWorkspaceForTenant.mockReset();
    listFirmaWorkspaces.mockResolvedValue([]);
    ensurePlatformTenantWithFirmaWorkspace.mockResolvedValue({
      tenantId: "tenant-platform",
      created: true,
      firmaProvisioning: { status: "created", workspaceId: "workspace_platform" },
    });
  });

  it("provisions every tenant including ones with stale workspace ids", async () => {
    const tenants = [
      { id: "tenant-platform", name: "Braas HR", slug: "braas-hr", subdomain: "braas-hr" },
      { id: "tenant-a", name: "A", slug: "a", subdomain: "a" },
      { id: "tenant-b", name: "B", slug: "b", subdomain: "b" },
    ];
    const client = {
      from: vi.fn(() => ({
        select: () => ({
          order: async () => ({ data: tenants, error: null }),
        }),
      })),
    };

    provisionFirmaWorkspaceForTenant.mockImplementation(async (input: { tenantId: string }) => {
      if (input.tenantId === "tenant-platform") {
        return { status: "already_configured", workspaceId: "workspace_platform" };
      }
      return { status: "created", workspaceId: `workspace_${input.tenantId}` };
    });

    const { backfillFirmaWorkspacesForAllTenants } = await import(
      "@/lib/firma/backfill-tenant-workspaces"
    );
    const result = await backfillFirmaWorkspacesForAllTenants(client as never);

    expect(result.platformTenantId).toBe("tenant-platform");
    expect(result.platformCreated).toBe(true);
    expect(result.results).toHaveLength(3);
    expect(provisionFirmaWorkspaceForTenant).toHaveBeenCalledTimes(3);
    expect(result.results.map((row) => row.workspaceId)).toEqual([
      "workspace_platform",
      "workspace_tenant-a",
      "workspace_tenant-b",
    ]);
  });

  it("is safe to run more than once", async () => {
    const tenants = [
      { id: "tenant-a", name: "A", slug: "a", subdomain: "a" },
    ];
    const client = {
      from: vi.fn(() => ({
        select: () => ({
          order: async () => ({ data: tenants, error: null }),
        }),
      })),
    };

    ensurePlatformTenantWithFirmaWorkspace.mockResolvedValue({
      tenantId: "tenant-platform",
      created: false,
      firmaProvisioning: { status: "already_configured", workspaceId: "workspace_platform" },
    });
    provisionFirmaWorkspaceForTenant.mockResolvedValue({
      status: "already_configured",
      workspaceId: "workspace_a",
    });

    const { backfillFirmaWorkspacesForAllTenants } = await import(
      "@/lib/firma/backfill-tenant-workspaces"
    );
    const first = await backfillFirmaWorkspacesForAllTenants(client as never);
    const second = await backfillFirmaWorkspacesForAllTenants(client as never);

    expect(first.results[0]?.status).toBe("already_configured");
    expect(second.results[0]?.status).toBe("already_configured");
    expect(first.results[0]?.workspaceId).toBe(second.results[0]?.workspaceId);
  });

  it("identifies tenants whose workspace is missing after listing live Firma ids", async () => {
    listFirmaWorkspaces.mockResolvedValue([{ id: "workspace_live" }]);
    ensurePlatformTenantWithFirmaWorkspace.mockResolvedValue({
      tenantId: "tenant-platform",
      created: false,
      firmaProvisioning: { status: "already_configured", workspaceId: "workspace_live" },
    });
    provisionFirmaWorkspaceForTenant.mockImplementation(async (input: { tenantId: string }) => {
      if (input.tenantId === "tenant-orphan") {
        return { status: "created", workspaceId: "workspace_orphan_repaired" };
      }
      return { status: "already_configured", workspaceId: "workspace_live" };
    });

    const tenants = [
      { id: "tenant-ok", name: "Ok", slug: "ok", subdomain: "ok" },
      { id: "tenant-orphan", name: "Orphan", slug: "orphan", subdomain: "orphan" },
    ];
    const client = {
      from: vi.fn(() => ({
        select: () => ({
          order: async () => ({ data: tenants, error: null }),
        }),
      })),
    };

    const { backfillFirmaWorkspacesForAllTenants } = await import(
      "@/lib/firma/backfill-tenant-workspaces"
    );
    const result = await backfillFirmaWorkspacesForAllTenants(client as never);
    const orphan = result.results.find((row) => row.tenantId === "tenant-orphan");
    expect(orphan?.status).toBe("created");
    expect(orphan?.workspaceId).toBe("workspace_orphan_repaired");
  });
});
