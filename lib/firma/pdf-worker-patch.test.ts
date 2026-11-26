import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("Firma embed download", () => {
  it("shares an in-flight download and its source between editor and worker callers", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("editor and worker source"));
    vi.stubGlobal("fetch", fetch);
    const { loadFirmaEmbedScript } = await import("./pdf-worker-patch");
    const url = "https://api.firma.dev/template-editor.js";
    const first = loadFirmaEmbedScript(url);
    expect(loadFirmaEmbedScript(url)).toBe(first);
    await expect(first).resolves.toBe("editor and worker source");
    await expect(loadFirmaEmbedScript(url)).resolves.toBe("editor and worker source");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("allows retry after a network failure instead of caching the rejection", async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response("source"));
    vi.stubGlobal("fetch", fetch);
    const { loadFirmaEmbedScript } = await import("./pdf-worker-patch");
    await expect(loadFirmaEmbedScript("https://api.firma.dev/editor.js")).rejects.toThrow("Failed to fetch");
    await expect(loadFirmaEmbedScript("https://api.firma.dev/editor.js")).resolves.toBe("source");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
