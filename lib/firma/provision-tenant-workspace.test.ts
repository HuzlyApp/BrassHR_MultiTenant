import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FirmaError } from "@/lib/firma/errors";

const createFirmaWorkspace = vi.fn();

vi.mock("@/lib/firma/client", () => ({
  createFirmaWorkspace: (...args: unknown[]) => createFirmaWorkspace(...args),
  isFirmaConfigured: vi.fn(() => true),
}));

describe("provisionFirmaWorkspaceForTenant", () => {
  const originalMode = process.env.FIRMA_WORKSPACE_PROVISIONING_MODE;
  const originalApiKey = process.env.FIRMA_API_KEY;

  beforeEach(() => {
    process.env.FIRMA_API_KEY = "firma_test_key";
    process.env.FIRMA_WORKSPACE_PROVISIONING_MODE = "api";
    createFirmaWorkspace.mockReset();
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
