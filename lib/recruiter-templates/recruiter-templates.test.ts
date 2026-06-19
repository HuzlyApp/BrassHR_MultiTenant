import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  canPublish,
  syncRecruiterTemplateSchema,
  validateFieldMappings,
  validatePublishReady,
  validateRoleOrders,
} from "@/lib/recruiter-templates/validation";

describe("validateRoleOrders", () => {
  it("flags duplicate signing orders", () => {
    const issues = validateRoleOrders([
      { role_key: "candidate", label: "Candidate", signing_order: 1 },
      { role_key: "recruiter", label: "Recruiter", signing_order: 1 },
    ]);
    expect(issues).toContain("Signing roles must have unique order values");
  });

  it("flags duplicate role keys", () => {
    const issues = validateRoleOrders([
      { role_key: "candidate", label: "Candidate", signing_order: 1 },
      { role_key: "candidate", label: "Candidate 2", signing_order: 2 },
    ]);
    expect(issues).toContain("Signing roles must have unique role keys");
  });
});

describe("validateFieldMappings", () => {
  it("flags unknown assigned roles", () => {
    const issues = validateFieldMappings(
      [
        {
          variable_name: "candidate_name",
          app_data_source: "candidate_name",
          assigned_role_key: "missing_role",
        },
      ],
      new Set(["candidate"])
    );
    expect(issues[0]).toMatch(/unknown role/);
  });
});

describe("validatePublishReady", () => {
  it("requires a document when no Firma template exists", () => {
    const result = validatePublishReady({
      name: "Offer Letter",
      category: "offer_letter",
      roles: [{ role_key: "candidate", label: "Candidate", signing_order: 1 }],
      fields: [],
      document_storage_path: null,
      firma_template_id: null,
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("Upload a document before publishing");
  });

  it("allows publish when Firma template already exists", () => {
    const result = validatePublishReady({
      name: "Offer Letter",
      category: "offer_letter",
      roles: [{ role_key: "candidate", label: "Candidate", signing_order: 1 }],
      fields: [],
      document_storage_path: null,
      firma_template_id: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(canPublish({
      name: "Offer Letter",
      category: "offer_letter",
      roles: [{ role_key: "candidate", label: "Candidate", signing_order: 1 }],
      fields: [],
      document_storage_path: null,
      firma_template_id: "123e4567-e89b-12d3-a456-426614174000",
    })).toBe(true);
    expect(result.ok).toBe(true);
  });
});

describe("syncRecruiterTemplateSchema", () => {
  it("accepts documented Firma editor events", () => {
    const parsed = syncRecruiterTemplateSchema.parse({
      event: "editor.published",
      firma_template_id: "123e4567-e89b-12d3-a456-426614174000",
      updated_at: "2026-06-16T01:00:00Z",
      draft: false,
    });

    expect(parsed.event).toBe("editor.published");
    expect(parsed.draft).toBe(false);
  });

  it("rejects undocumented event names", () => {
    expect(() =>
      syncRecruiterTemplateSchema.parse({
        event: "template.saved",
      })
    ).toThrow();
  });
});

describe("isFirmaDocumentUrlStale", () => {
  it("treats missing document URLs as stale", async () => {
    const { isFirmaDocumentUrlStale } = await import("@/lib/firma/document-access");
    expect(isFirmaDocumentUrlStale({ document_url: null, document_url_expires_at: null })).toBe(
      true
    );
  });

  it("treats expired signed URLs as stale", async () => {
    const { isFirmaDocumentUrlStale } = await import("@/lib/firma/document-access");
    expect(
      isFirmaDocumentUrlStale(
        {
          document_url: "https://example.com/doc.pdf",
          document_url_expires_at: "2020-01-01T00:00:00.000Z",
        },
        Date.parse("2026-06-20T00:00:00.000Z")
      )
    ).toBe(true);
  });

  it("treats fresh signed URLs as valid", async () => {
    const { isFirmaDocumentUrlStale } = await import("@/lib/firma/document-access");
    expect(
      isFirmaDocumentUrlStale(
        {
          document_url: "https://example.com/doc.pdf",
          document_url_expires_at: "2026-06-20T02:00:00.000Z",
        },
        Date.parse("2026-06-20T00:00:00.000Z")
      )
    ).toBe(false);
  });
});

describe("firma client helpers", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it("reports configured when FIRMA_API_KEY is set", async () => {
    process.env.FIRMA_API_KEY = "firma_test_key";
    const { isFirmaConfigured } = await import("@/lib/firma/client");
    expect(isFirmaConfigured()).toBe(true);
  });

  it("unwraps Firma proxy envelope responses", async () => {
    process.env.FIRMA_API_KEY = "firma_test_key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            statusCode: 201,
            headers: {},
            body: JSON.stringify({ id: "tpl_envelope", name: "Offer Letter" }),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    );

    const { createFirmaTemplate } = await import("@/lib/firma/client");
    const result = await createFirmaTemplate({
      name: "Offer Letter",
      document: "base64pdf",
    });

    expect(result.id).toBe("tpl_envelope");
  });

  it("maps auth errors from Firma API responses", async () => {
    process.env.FIRMA_API_KEY = "firma_test_key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "Unauthorized", message: "Invalid API key" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const { getFirmaTemplate } = await import("@/lib/firma/client");

    await expect(getFirmaTemplate("template-id")).rejects.toMatchObject({
      code: "AUTH_ERROR",
      status: 401,
    });
  });

  it("creates templates via POST /templates", async () => {
    process.env.FIRMA_API_KEY = "firma_test_key";
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "tpl_1", name: "Offer Letter" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { createFirmaTemplate } = await import("@/lib/firma/client");
    const result = await createFirmaTemplate({
      name: "Offer Letter",
      document: "base64pdf",
    });

    expect(result.id).toBe("tpl_1");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/templates"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("generates template JWTs with the documented payload", async () => {
    process.env.FIRMA_API_KEY = "firma_test_key";
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          statusCode: 201,
          headers: {},
          body: JSON.stringify({
            token: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature",
            expires_at: "2026-06-16T02:00:00Z",
            jwt_record_id: "123e4567-e89b-12d3-a456-426614174000",
          }),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { generateFirmaTemplateJwt } = await import("@/lib/firma/client");
    const result = await generateFirmaTemplateJwt("tmpl_123");

    expect(result.token).toBe(
      "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature"
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/generate-template-token"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ companies_workspaces_templates_id: "tmpl_123" }),
      })
    );
  });

  it("replaces template documents via POST /templates/{id}/replace-document", async () => {
    process.env.FIRMA_API_KEY = "firma_test_key";
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "tpl_1", name: "Offer Letter" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { replaceFirmaTemplateDocument } = await import("@/lib/firma/client");
    const result = await replaceFirmaTemplateDocument("tpl_1", "base64pdf");

    expect(result.id).toBe("tpl_1");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/templates/tpl_1/replace-document"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ document: "base64pdf" }),
      })
    );
  });

  it("rejects malformed template JWT responses", async () => {
    process.env.FIRMA_API_KEY = "firma_test_key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            statusCode: 201,
            headers: {},
            body: JSON.stringify({
              token: "not-a-jwt",
              expires_at: "2026-06-16T02:00:00Z",
            }),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    );

    const { generateFirmaTemplateJwt } = await import("@/lib/firma/client");

    await expect(generateFirmaTemplateJwt("tmpl_123")).rejects.toMatchObject({
      code: "API_ERROR",
      message: "Firma JWT response had an invalid token format",
    });
  });
});
