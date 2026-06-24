import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("firma client workspace propagation", () => {
  const originalEnv = process.env;
  const workspaceId = "workspace_tenant_a";

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, FIRMA_API_KEY: "firma_test_key" };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  function stubFetch(handler: (url: string, init?: RequestInit) => unknown) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const result = handler(url, init);
      if (result instanceof Response) return result;
      return new Response(JSON.stringify(result ?? {}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  function expectWorkspaceInUrl(fetchMock: ReturnType<typeof vi.fn>, pathFragment: string) {
    const call = fetchMock.mock.calls.find((args) => String(args[0]).includes(pathFragment));
    expect(call).toBeTruthy();
    expect(String(call?.[0])).toContain(`workspace_id=${workspaceId}`);
  }

  it("passes workspace_id on template CRUD and JWT operations", async () => {
    const fetchMock = stubFetch((url) => {
      if (url.includes("/templates") && !url.includes("/users") && !url.includes("/fields")) {
        return { id: "tpl_1", name: "Offer" };
      }
      if (url.includes("/users")) return [];
      if (url.includes("/fields")) return [];
      if (url.includes("/generate-template-token")) {
        return {
          token: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature",
          expires_at: "2026-06-16T02:00:00Z",
        };
      }
      return {};
    });

    const client = await import("@/lib/firma/client");

    await client.createFirmaTemplate({ name: "Offer", document: "base64" }, workspaceId);
    await client.getFirmaTemplate("tpl_1", workspaceId);
    await client.updateFirmaTemplate("tpl_1", { name: "Offer v2" }, workspaceId);
    await client.replaceFirmaTemplateDocument("tpl_1", "base64", workspaceId);
    await client.deleteFirmaTemplate("tpl_1", workspaceId);
    await client.listFirmaTemplateUsers("tpl_1", workspaceId);
    await client.listFirmaTemplateFields("tpl_1", workspaceId);
    await client.generateFirmaTemplateJwt("tpl_1", workspaceId);

    expectWorkspaceInUrl(fetchMock, "/templates");
    expectWorkspaceInUrl(fetchMock, "/templates/tpl_1");
    expectWorkspaceInUrl(fetchMock, "/templates/tpl_1/replace-document");
    expectWorkspaceInUrl(fetchMock, "/templates/tpl_1/users");
    expectWorkspaceInUrl(fetchMock, "/templates/tpl_1/fields");
    expectWorkspaceInUrl(fetchMock, "/generate-template-token");
  });

  it("passes workspace_id on signing request operations", async () => {
    const fetchMock = stubFetch((url) => {
      if (url.includes("/create-and-send")) {
        return {
          id: "sr_1",
          status: "sent",
          recipients: [{ id: "r_1", email: "a@example.com", signing_url: "https://app.firma.dev/signing/r_1" }],
        };
      }
      if (url.includes("/users")) return { items: [{ id: "r_1", email: "a@example.com" }] };
      if (url.includes("/signing-requests/sr_1")) return { id: "sr_1", status: "sent" };
      return {};
    });

    const client = await import("@/lib/firma/client");

    await client.createAndSendFirmaSigningRequest(
      { template_id: "tpl_1", recipients: [{ email: "a@example.com" }] },
      workspaceId
    );
    await client.getFirmaSigningRequest("sr_1", workspaceId);
    await client.getFirmaSigningRequestUsers("sr_1", workspaceId);

    expectWorkspaceInUrl(fetchMock, "/signing-requests/create-and-send");
    expectWorkspaceInUrl(fetchMock, "/signing-requests/sr_1");
    expectWorkspaceInUrl(fetchMock, "/signing-requests/sr_1/users");
  });

  it("does not silently fall back to env workspace when explicit workspaceId is passed", async () => {
    process.env.FIRMA_WORKSPACE_ID = "workspace_global";
    const fetchMock = stubFetch(() => ({ id: "tpl_1" }));
    const { getFirmaTemplate } = await import("@/lib/firma/client");

    await getFirmaTemplate("tpl_1", workspaceId);

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain(`workspace_id=${workspaceId}`);
    expect(url).not.toContain("workspace_id=workspace_global");
  });
});
