import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const authState = vi.hoisted(() => ({
  userId: "user-1",
  role: "admin" as string,
  godAdmin: false,
  tenantId: "tenant-a",
}));

const tenantWorkspaces = vi.hoisted(() => new Map<string, string | null>([["tenant-a", null]]));

vi.mock("@/lib/auth/api-session", () => ({
  requireStaffApiSession: vi.fn(async () => ({
    userId: authState.userId,
    role: authState.role,
    godAdmin: authState.godAdmin,
    authUser: { id: authState.userId },
  })),
}));

vi.mock("@/lib/email-templates/resolve-effective-tenant", () => ({
  resolveEffectiveAdminTenantId: vi.fn(async () => authState.tenantId),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: (table: string) => {
      if (table !== "tenants") throw new Error(`Unexpected table ${table}`);
      return {
        select: () => ({
          eq: (_col: string, tenantId: string) => ({
            maybeSingle: async () => ({
              data: { firma_workspace_id: tenantWorkspaces.get(tenantId) ?? null },
              error: null,
            }),
          }),
        }),
        update: (patch: { firma_workspace_id: string | null }) => ({
          eq: (_col: string, tenantId: string) => {
            tenantWorkspaces.set(tenantId, patch.firma_workspace_id);
            return Promise.resolve({ error: null });
          },
        }),
      };
    },
  })),
}));

describe("tenant-firma-settings route", () => {
  const originalWorkspace = process.env.FIRMA_WORKSPACE_ID;

  beforeEach(() => {
    process.env.FIRMA_WORKSPACE_ID = "workspace_global";
    authState.role = "admin";
    authState.godAdmin = false;
    authState.tenantId = "tenant-a";
    tenantWorkspaces.clear();
    tenantWorkspaces.set("tenant-a", null);
    tenantWorkspaces.set("tenant-b", "workspace_b");
  });

  afterEach(() => {
    process.env.FIRMA_WORKSPACE_ID = originalWorkspace;
    vi.clearAllMocks();
  });

  it("GET returns tenant workspace and effective fallback", async () => {
    const { GET } = await import("@/app/api/admin/tenant-firma-settings/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.tenant_id).toBe("tenant-a");
    expect(body.firma_workspace_id).toBeNull();
    expect(body.effective_workspace_id).toBe("workspace_global");
    expect(body.source).toBe("env");
  });

  it("PATCH saves tenant-specific workspace ID", async () => {
    const { PATCH, GET } = await import("@/app/api/admin/tenant-firma-settings/route");
    const response = await PATCH(
      new NextRequest("http://localhost/api/admin/tenant-firma-settings", {
        method: "PATCH",
        body: JSON.stringify({ firma_workspace_id: "workspace_a" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.firma_workspace_id).toBe("workspace_a");
    expect(body.effective_workspace_id).toBe("workspace_a");
    expect(body.source).toBe("tenant");

    const getResponse = await GET();
    const getBody = await getResponse.json();
    expect(getBody.firma_workspace_id).toBe("workspace_a");
    expect(getBody.source).toBe("tenant");
  });

  it("PATCH clearing workspace returns to global fallback", async () => {
    tenantWorkspaces.set("tenant-a", "workspace_a");
    const { PATCH } = await import("@/app/api/admin/tenant-firma-settings/route");

    const response = await PATCH(
      new NextRequest("http://localhost/api/admin/tenant-firma-settings", {
        method: "PATCH",
        body: JSON.stringify({ firma_workspace_id: null }),
      })
    );
    const body = await response.json();

    expect(body.firma_workspace_id).toBeNull();
    expect(body.effective_workspace_id).toBe("workspace_global");
    expect(body.source).toBe("env");
  });

  it("rejects unauthorized users", async () => {
    authState.role = "recruiter";
    const { GET } = await import("@/app/api/admin/tenant-firma-settings/route");
    const response = await GET();
    expect(response.status).toBe(403);
  });

  it("preserves tenant scoping when switching effective tenant", async () => {
    const { GET } = await import("@/app/api/admin/tenant-firma-settings/route");

    authState.tenantId = "tenant-b";
    const tenantB = await GET();
    const tenantBBody = await tenantB.json();
    expect(tenantBBody.firma_workspace_id).toBe("workspace_b");
    expect(tenantBBody.effective_workspace_id).toBe("workspace_b");

    authState.tenantId = "tenant-a";
    const tenantA = await GET();
    const tenantABody = await tenantA.json();
    expect(tenantABody.firma_workspace_id).toBeNull();
    expect(tenantABody.effective_workspace_id).toBe("workspace_global");
  });

  it("rejects invalid firma_workspace_id payload types", async () => {
    const { PATCH } = await import("@/app/api/admin/tenant-firma-settings/route");
    const response = await PATCH(
      new NextRequest("http://localhost/api/admin/tenant-firma-settings", {
        method: "PATCH",
        body: JSON.stringify({ firma_workspace_id: 123 }),
      })
    );
    expect(response.status).toBe(400);
  });
});
