import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FirmaError } from "@/lib/firma/errors";

const createFirmaWorkspace = vi.fn();
const firmaWorkspaceExistsInCompany = vi.fn();

vi.mock("@/lib/firma/client", () => ({
  createFirmaWorkspace: (...args: unknown[]) => createFirmaWorkspace(...args),
  isFirmaConfigured: vi.fn(() => true),
  firmaWorkspaceExistsInCompany: (...args: unknown[]) => firmaWorkspaceExistsInCompany(...args),
}));

vi.mock("@/lib/firma/sync-workspace-branding", () => ({
  syncTenantBrandingToFirmaWorkspace: vi.fn(async () => undefined),
}));

describe("provisionFirmaWorkspaceForTenant", () => {
  const originalMode = process.env.FIRMA_WORKSPACE_PROVISIONING_MODE;
  const originalApiKey = process.env.FIRMA_API_KEY;

  beforeEach(() => {
    process.env.FIRMA_API_KEY = "firma_test_key";
    process.env.FIRMA_WORKSPACE_PROVISIONING_MODE = "api";
    createFirmaWorkspace.mockReset();
    firmaWorkspaceExistsInCompany.mockReset();
    firmaWorkspaceExistsInCompany.mockResolvedValue(true);
  });

  afterEach(() => {
    process.env.FIRMA_WORKSPACE_PROVISIONING_MODE = originalMode;
    process.env.FIRMA_API_KEY = originalApiKey;
    vi.clearAllMocks();
  });

  function mockSupabase(tenant: Record<string, unknown>) {
    const updates: Record<string, unknown>[] = [];
    return {
      updates,
      client: {
        from: vi.fn((table: string) => {
          if (table !== "tenants") throw new Error(`Unexpected table ${table}`);
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: tenant, error: null }),
              }),
            }),
            update: (patch: Record<string, unknown>) => ({
              eq: async () => {
                updates.push(patch);
                return { error: null };
              },
            }),
          };
        }),
      },
    };
  }

  it("returns already_configured when tenant has a workspace", async () => {
    const { provisionFirmaWorkspaceForTenant } = await import(
      "@/lib/firma/provision-tenant-workspace"
    );
    const { client } = mockSupabase({
      firma_workspace_id: "workspace_existing",
      name: "Acme",
      subdomain: "acme",
      slug: "acme",
    });

    const result = await provisionFirmaWorkspaceForTenant({
      supabase: client as never,
      tenantId: "tenant-1",
      tenantName: "Acme",
      tenantSlug: "acme",
    });

    expect(result).toEqual({
      status: "already_configured",
      workspaceId: "workspace_existing",
    });
    expect(createFirmaWorkspace).not.toHaveBeenCalled();
  });

  it("recreates a workspace when the stored id is missing from Firma", async () => {
    firmaWorkspaceExistsInCompany
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    createFirmaWorkspace.mockResolvedValue({
      id: "workspace_repaired",
      name: "BrassHR - Acme (acme)",
    });

    const { provisionFirmaWorkspaceForTenant } = await import(
      "@/lib/firma/provision-tenant-workspace"
    );
    const { client, updates } = mockSupabase({
      firma_workspace_id: "workspace_stale",
      name: "Acme",
      subdomain: "acme",
      slug: "acme",
    });

    const result = await provisionFirmaWorkspaceForTenant({
      supabase: client as never,
      tenantId: "tenant-1",
      tenantName: "Acme",
      tenantSlug: "acme",
    });

    expect(result).toEqual({
      status: "created",
      workspaceId: "workspace_repaired",
    });
    expect(createFirmaWorkspace).toHaveBeenCalledTimes(1);
    expect(updates[0]).toMatchObject({
      firma_workspace_id: "workspace_repaired",
      firma_workspace_provisioning_status: "created",
    });
  });

  it("does not create a duplicate when provisioning is retried", async () => {
    const { provisionFirmaWorkspaceForTenant } = await import(
      "@/lib/firma/provision-tenant-workspace"
    );
    const { client } = mockSupabase({
      firma_workspace_id: "workspace_existing",
      name: "Acme",
      subdomain: "acme",
      slug: "acme",
    });

    const first = await provisionFirmaWorkspaceForTenant({
      supabase: client as never,
      tenantId: "tenant-1",
      tenantName: "Acme",
      tenantSlug: "acme",
    });
    const second = await provisionFirmaWorkspaceForTenant({
      supabase: client as never,
      tenantId: "tenant-1",
      tenantName: "Acme",
      tenantSlug: "acme",
    });

    expect(first.status).toBe("already_configured");
    expect(second.status).toBe("already_configured");
    expect(first.workspaceId).toBe("workspace_existing");
    expect(second.workspaceId).toBe("workspace_existing");
    expect(createFirmaWorkspace).not.toHaveBeenCalled();
  });

  it("creates separate workspaces for tenant A and tenant B", async () => {
    createFirmaWorkspace
      .mockResolvedValueOnce({ id: "workspace_a", name: "BrassHR - A (a)" })
      .mockResolvedValueOnce({ id: "workspace_b", name: "BrassHR - B (b)" });

    const { provisionFirmaWorkspaceForTenant } = await import(
      "@/lib/firma/provision-tenant-workspace"
    );

    const tenantA = mockSupabase({
      firma_workspace_id: null,
      name: "A",
      subdomain: "a",
      slug: "a",
    });
    const tenantB = mockSupabase({
      firma_workspace_id: null,
      name: "B",
      subdomain: "b",
      slug: "b",
    });

    const resultA = await provisionFirmaWorkspaceForTenant({
      supabase: tenantA.client as never,
      tenantId: "tenant-a",
      tenantName: "A",
      tenantSlug: "a",
    });
    const resultB = await provisionFirmaWorkspaceForTenant({
      supabase: tenantB.client as never,
      tenantId: "tenant-b",
      tenantName: "B",
      tenantSlug: "b",
    });

    expect(resultA.workspaceId).toBe("workspace_a");
    expect(resultB.workspaceId).toBe("workspace_b");
    expect(resultA.workspaceId).not.toBe(resultB.workspaceId);
    expect(tenantA.updates[0]).toMatchObject({ firma_workspace_id: "workspace_a" });
    expect(tenantB.updates[0]).toMatchObject({ firma_workspace_id: "workspace_b" });
  });

  it("creates distinct workspaces for Alpha, Beta, and Gamma", async () => {
    createFirmaWorkspace
      .mockResolvedValueOnce({ id: "workspace_alpha", name: "BrassHR - Alpha (verify-alpha)" })
      .mockResolvedValueOnce({ id: "workspace_beta", name: "BrassHR - Beta (verify-beta)" })
      .mockResolvedValueOnce({ id: "workspace_gamma", name: "BrassHR - Gamma (verify-gamma)" });

    const { provisionFirmaWorkspaceForTenant } = await import(
      "@/lib/firma/provision-tenant-workspace"
    );

    const results = [];
    for (const t of [
      { id: "tenant-alpha", name: "Alpha", slug: "verify-alpha" },
      { id: "tenant-beta", name: "Beta", slug: "verify-beta" },
      { id: "tenant-gamma", name: "Gamma", slug: "verify-gamma" },
    ]) {
      const mock = mockSupabase({
        firma_workspace_id: null,
        name: t.name,
        subdomain: t.slug,
        slug: t.slug,
      });
      results.push(
        await provisionFirmaWorkspaceForTenant({
          supabase: mock.client as never,
          tenantId: t.id,
          tenantName: t.name,
          tenantSlug: t.slug,
        })
      );
    }

    const ids = results.map((row) => row.workspaceId);
    expect(ids).toEqual(["workspace_alpha", "workspace_beta", "workspace_gamma"]);
    expect(new Set(ids).size).toBe(3);
  });

  it("creates workspace by default (api mode) and persists only workspace id", async () => {
    createFirmaWorkspace.mockResolvedValue({
      id: "3b9e2ce8-22f1-4a48-9564-80245d73a21b",
      name: "BrassHR - Testy (workspacetesty)",
    });

    const { provisionFirmaWorkspaceForTenant } = await import(
      "@/lib/firma/provision-tenant-workspace"
    );
    const { client, updates } = mockSupabase({
      firma_workspace_id: null,
      name: "Testy",
      subdomain: "workspacetesty",
      slug: "workspacetesty",
    });

    const result = await provisionFirmaWorkspaceForTenant({
      supabase: client as never,
      tenantId: "tenant-1",
      tenantName: "Testy",
      tenantSlug: "workspacetesty",
    });

    expect(result).toEqual({
      status: "created",
      workspaceId: "3b9e2ce8-22f1-4a48-9564-80245d73a21b",
    });
    expect(createFirmaWorkspace).toHaveBeenCalledWith({
      name: "BrassHR - Testy (workspacetesty)",
    });
    expect(updates[0]).toMatchObject({
      firma_workspace_id: "3b9e2ce8-22f1-4a48-9564-80245d73a21b",
      firma_workspace_provisioning_status: "created",
    });
    expect(updates[0]).not.toHaveProperty("api_key");
    expect(updates[0]).not.toHaveProperty("test_api_key");
  });

  it("does not store api keys from Firma response", async () => {
    createFirmaWorkspace.mockImplementation(async () => {
      void {
        id: "workspace-1",
        api_key: "secret_should_not_be_stored",
        test_api_key: "test_secret_should_not_be_stored",
      };
      return { id: "workspace-1", name: "BrassHR - Acme (acme)" };
    });

    const { provisionFirmaWorkspaceForTenant } = await import(
      "@/lib/firma/provision-tenant-workspace"
    );
    const { client, updates } = mockSupabase({
      firma_workspace_id: null,
      name: "Acme",
      subdomain: "acme",
      slug: "acme",
    });

    await provisionFirmaWorkspaceForTenant({
      supabase: client as never,
      tenantId: "tenant-1",
      tenantName: "Acme",
      tenantSlug: "acme",
    });

    expect(JSON.stringify(updates[0])).not.toMatch(/secret_should_not_be_stored/);
    expect(JSON.stringify(updates[0])).not.toMatch(/test_secret_should_not_be_stored/);
  });

  it("returns failed without throwing when Firma API rejects workspace creation", async () => {
    createFirmaWorkspace.mockRejectedValue(
      new FirmaError("AUTH_ERROR", "Invalid API key firma_test_secret", 401)
    );

    const { provisionFirmaWorkspaceForTenant } = await import(
      "@/lib/firma/provision-tenant-workspace"
    );
    const { client, updates } = mockSupabase({
      firma_workspace_id: null,
      name: "Acme",
      subdomain: "acme",
      slug: "acme",
    });

    const result = await provisionFirmaWorkspaceForTenant({
      supabase: client as never,
      tenantId: "tenant-1",
      tenantName: "Acme",
      tenantSlug: "acme",
    });

    expect(result.status).toBe("failed");
    expect(result.workspaceId).toBeNull();
    expect(result.message).toContain("retry in Account Settings");
    expect(updates[0]).toMatchObject({ firma_workspace_provisioning_status: "failed" });
    expect(updates[0]).not.toHaveProperty("firma_workspace_id");
  });

  it("skips Firma call in manual mode", async () => {
    process.env.FIRMA_WORKSPACE_PROVISIONING_MODE = "manual";
    const { provisionFirmaWorkspaceForTenant } = await import(
      "@/lib/firma/provision-tenant-workspace"
    );
    const { client } = mockSupabase({
      firma_workspace_id: null,
      name: "Acme",
      subdomain: "acme",
      slug: "acme",
    });

    const result = await provisionFirmaWorkspaceForTenant({
      supabase: client as never,
      tenantId: "tenant-1",
      tenantName: "Acme",
      tenantSlug: "acme",
    });

    expect(result.status).toBe("failed");
    expect(createFirmaWorkspace).not.toHaveBeenCalled();
  });
});

describe("buildFirmaWorkspaceNameForTenant", () => {
  it("formats workspace names for Firma", async () => {
    const { buildFirmaWorkspaceNameForTenant } = await import(
      "@/lib/firma/provision-tenant-workspace"
    );
    expect(buildFirmaWorkspaceNameForTenant("Acme Corp", "acme")).toBe(
      "BrassHR - Acme Corp (acme)"
    );
    expect(buildFirmaWorkspaceNameForTenant("Acme Corp", null)).toBe("BrassHR - Acme Corp");
  });
});

describe("getFirmaWorkspaceProvisioningMode", () => {
  it("defaults to api mode", async () => {
    delete process.env.FIRMA_WORKSPACE_PROVISIONING_MODE;
    const { getFirmaWorkspaceProvisioningMode } = await import(
      "@/lib/firma/provision-tenant-workspace"
    );
    expect(getFirmaWorkspaceProvisioningMode()).toBe("api");
  });
});
