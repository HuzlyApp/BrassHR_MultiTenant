import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("updateFirmaCompanyAppearanceSettings", () => {
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

  it("PUTs BrassHR gold appearance to /company/settings with the company api key", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const authHeader = init?.headers;
      const auth =
        authHeader instanceof Headers
          ? authHeader.get("Authorization") ?? ""
          : String((authHeader as Record<string, string> | undefined)?.Authorization ?? "");

      if (url.includes("/company/settings") && init?.method === "PUT") {
        expect(auth).toBe("firma_company_key");
        expect(JSON.parse(String(init.body))).toMatchObject({
          color_primary: "#bc8b41",
          color_accent: "#bc8b41",
          color_primary_fg: "#ffffff",
        });
        return new Response(
          JSON.stringify({
            color_primary: "#bc8b41",
            color_accent: "#bc8b41",
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ error: `unexpected ${url}` }), { status: 500 });
    });

    global.fetch = fetchMock as typeof fetch;

    const { updateFirmaCompanyAppearanceSettings } = await import("@/lib/firma/client");
    const result = await updateFirmaCompanyAppearanceSettings({
      color_primary: "#bc8b41",
      color_accent: "#bc8b41",
      color_primary_fg: "#ffffff",
    });

    expect(result.color_primary).toBe("#bc8b41");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
