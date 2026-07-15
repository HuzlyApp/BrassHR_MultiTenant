import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("updateFirmaWorkspaceSettings workspace api key", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.FIRMA_API_KEY = "firma_company_key";
    process.env.FIRMA_API_BASE_URL = "https://api.firma.dev/functions/v1/signing-request-api";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("lists workspaces for the scoped api_key then PUTs settings with that key", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const authHeader = init?.headers;
      const auth =
        authHeader instanceof Headers
          ? authHeader.get("Authorization") ?? ""
          : String((authHeader as Record<string, string> | undefined)?.Authorization ?? "");

      if (url.endsWith("/workspaces") && (!init?.method || init.method === "GET")) {
        expect(auth).toBe("firma_company_key");
        return new Response(
          JSON.stringify({
            results: [
              { id: "ws-other", api_key: "key-other" },
              { id: "ws-jobs", api_key: "key-jobs", name: "jobs" },
            ],
            pagination: { current_page: 1, total_pages: 1 },
          }),
          { status: 200 }
        );
      }

      if (url.includes("/workspace/ws-jobs/settings") && init?.method === "PUT") {
        expect(auth).toBe("key-jobs");
        expect(JSON.parse(String(init.body))).toMatchObject({
          color_primary: "#0d9488",
          color_accent: "#0d9488",
        });
        return new Response(
          JSON.stringify({
            color_primary: "#0d9488",
            color_accent: "#0d9488",
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ error: `unexpected ${url}` }), { status: 500 });
    });

    global.fetch = fetchMock as typeof fetch;

    const { updateFirmaWorkspaceSettings } = await import("@/lib/firma/client");
    const result = await updateFirmaWorkspaceSettings("ws-jobs", {
      color_primary: "#0d9488",
      color_accent: "#0d9488",
    });

    expect(result.color_primary).toBe("#0d9488");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
