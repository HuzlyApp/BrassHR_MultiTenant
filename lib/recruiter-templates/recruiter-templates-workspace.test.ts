import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecruiterTemplateError } from "@/lib/recruiter-templates/errors";
import type { RecruiterTemplateDetail } from "@/lib/recruiter-templates/types";

function baseTemplate(overrides: Partial<RecruiterTemplateDetail> = {}): RecruiterTemplateDetail {
  return {
    id: "recruiter-template-1",
    tenant_id: "tenant-a",
    name: "Employee Agreement",
    description: null,
    category: "offer_letter",
    status: "active",
    firma_template_id: "firma-template-123",
    firma_workspace_id: null,
    document_storage_path: "tenant-a/doc.pdf",
    document_file_name: "doc.pdf",
    expiration_hours: 72,
    firma_settings: null,
    firma_builder_session_id: null,
    published_at: "2026-06-20T00:00:00.000Z",
    last_synced_at: null,
    created_at: "2026-06-20T00:00:00.000Z",
    updated_at: "2026-06-20T00:00:00.000Z",
    created_by: "user-1",
    updated_by: "user-1",
    roles: [{ id: "role-1", template_id: "recruiter-template-1", role_key: "candidate", label: "Candidate", signing_order: 1 }],
    fields: [],
    ...overrides,
  };
}

function mockSupabaseForTemplate(
  tenantId: string,
  template: RecruiterTemplateDetail,
  tenantWorkspaceId: string | null
) {
  return {
    from: vi.fn((table: string) => {
      if (table === "tenants") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { firma_workspace_id: tenantWorkspaceId },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "recruiter_templates") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: template, error: null }),
              single: async () => ({ data: template, error: null }),
            }),
          }),
        };
      }
      if (table === "recruiter_template_roles") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: template.roles, error: null }),
            }),
          }),
        };
      }
      if (table === "recruiter_template_fields") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: template.fields, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("recruiter template hybrid Firma workspace", () => {
  const originalKey = process.env.FIRMA_API_KEY;
  const originalWorkspace = process.env.FIRMA_WORKSPACE_ID;

  beforeEach(() => {
    process.env.FIRMA_API_KEY = "firma_test_key";
    process.env.FIRMA_WORKSPACE_ID = "workspace_global";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/templates/firma-template-123")) {
          return new Response(
            JSON.stringify({
              id: "firma-template-123",
              name: "Employee Agreement",
              document_url: "https://example.com/doc.pdf",
            }),
            { status: 200 }
          );
        }
        if (url.includes("/users")) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (url.includes("/fields")) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (url.includes("/generate-template-token")) {
          return new Response(
            JSON.stringify({
              token: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature",
              expires_at: "2026-06-20T02:00:00.000Z",
            }),
            { status: 200 }
          );
        }
        if (url.includes("/signing-requests/create-and-send")) {
          return new Response(
            JSON.stringify({ id: "signing-request-1", status: "sent" }),
            { status: 201 }
          );
        }
        return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
      })
    );
  });

  afterEach(() => {
    process.env.FIRMA_API_KEY = originalKey;
    process.env.FIRMA_WORKSPACE_ID = originalWorkspace;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses global fallback workspace for legacy tenants when building preview", async () => {
    const { buildRecruiterTemplatePreview } = await import("@/lib/recruiter-templates/service");
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const supabase = mockSupabaseForTemplate("tenant-a", baseTemplate(), null);

    await buildRecruiterTemplatePreview(supabase as never, "tenant-a", "recruiter-template-1");

    const templateCall = fetchMock.mock.calls.find((args) =>
      String(args[0]).includes("/templates/firma-template-123")
    );
    expect(String(templateCall?.[0])).toContain("workspace_id=workspace_global");
  });

  it("uses tenant-specific workspace when tenant override is configured", async () => {
    const { buildRecruiterTemplatePreview } = await import("@/lib/recruiter-templates/service");
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const supabase = mockSupabaseForTemplate(
      "tenant-a",
      baseTemplate({ firma_workspace_id: "workspace_a" }),
      "workspace_a"
    );

    await buildRecruiterTemplatePreview(supabase as never, "tenant-a", "recruiter-template-1");

    const templateCall = fetchMock.mock.calls.find((args) =>
      String(args[0]).includes("/templates/firma-template-123")
    );
    expect(String(templateCall?.[0])).toContain("workspace_id=workspace_a");
    expect(String(templateCall?.[0])).not.toContain("workspace_id=workspace_global");
  });

  it("isolates workspace between tenant A and tenant B signing requests", async () => {
    const { createRecruiterTemplateSigningRequest } = await import("@/lib/recruiter-templates/service");
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;

    const supabaseA = mockSupabaseForTemplate(
      "tenant-a",
      baseTemplate({ tenant_id: "tenant-a", id: "template-a" }),
      "workspace_a"
    );
    await createRecruiterTemplateSigningRequest(supabaseA as never, "tenant-a", "template-a", {
      recipients: [{ email: "a@example.com", order: 1 }],
    });

    const supabaseB = mockSupabaseForTemplate(
      "tenant-b",
      baseTemplate({ tenant_id: "tenant-b", id: "template-b" }),
      "workspace_b"
    );
    await createRecruiterTemplateSigningRequest(supabaseB as never, "tenant-b", "template-b", {
      recipients: [{ email: "b@example.com", order: 1 }],
    });

    const urls = fetchMock.mock.calls.map((args) => String(args[0]));
    expect(urls.some((url) => url.includes("workspace_id=workspace_a"))).toBe(true);
    expect(urls.some((url) => url.includes("workspace_id=workspace_b"))).toBe(true);
  });

  it("blocks preview/JWT when stored template workspace mismatches effective workspace", async () => {
    const { buildRecruiterTemplatePreview } = await import("@/lib/recruiter-templates/service");
    const supabase = mockSupabaseForTemplate(
      "tenant-a",
      baseTemplate({ firma_workspace_id: "workspace_old" }),
      "workspace_new"
    );

    await expect(
      buildRecruiterTemplatePreview(supabase as never, "tenant-a", "recruiter-template-1")
    ).rejects.toMatchObject({
      code: "FIRMA_WORKSPACE_MISMATCH",
      status: 409,
    } satisfies Partial<RecruiterTemplateError>);
  });

  it("allows legacy templates with null stored workspace", async () => {
    const { buildRecruiterTemplatePreview } = await import("@/lib/recruiter-templates/service");
    const supabase = mockSupabaseForTemplate(
      "tenant-a",
      baseTemplate({ firma_workspace_id: null }),
      null
    );

    const preview = await buildRecruiterTemplatePreview(
      supabase as never,
      "tenant-a",
      "recruiter-template-1"
    );
    expect(preview.editor.jwt).toBeTruthy();
  });

  it("blocks signing request creation when template workspace mismatches", async () => {
    const { createRecruiterTemplateSigningRequest } = await import("@/lib/recruiter-templates/service");
    const supabase = mockSupabaseForTemplate(
      "tenant-a",
      baseTemplate({ firma_workspace_id: "workspace_old" }),
      "workspace_new"
    );

    await expect(
      createRecruiterTemplateSigningRequest(supabase as never, "tenant-a", "recruiter-template-1", {
        recipients: [{ email: "a@example.com", order: 1 }],
      })
    ).rejects.toMatchObject({
      code: "FIRMA_WORKSPACE_MISMATCH",
      status: 409,
    });
  });

  it("throws a clear configuration error when no tenant workspace and no env fallback", async () => {
    delete process.env.FIRMA_WORKSPACE_ID;
    const { buildRecruiterTemplatePreview } = await import("@/lib/recruiter-templates/service");
    const supabase = mockSupabaseForTemplate("tenant-a", baseTemplate(), null);

    await expect(
      buildRecruiterTemplatePreview(supabase as never, "tenant-a", "recruiter-template-1")
    ).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
      status: 503,
    });
  });
});
