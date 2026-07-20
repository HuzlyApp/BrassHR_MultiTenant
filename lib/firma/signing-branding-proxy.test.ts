import { describe, expect, it } from "vitest";
import {
  buildFirmaSigningBrandingInjectScript,
  resolveFirmaSigningEmbedUrl,
  rewriteFirmaSigningAssetPath,
  rewriteFirmaSigningProxyHtml,
} from "@/lib/firma/signing-branding-proxy";

describe("resolveFirmaSigningEmbedUrl", () => {
  it("rewrites Firma signing URLs to same-origin /signing paths", () => {
    expect(resolveFirmaSigningEmbedUrl("https://app.firma.dev/signing/recipient-1")).toBe(
      "/signing/recipient-1"
    );
    expect(resolveFirmaSigningEmbedUrl("https://app.firma.dev/signing/recipient-1/complete")).toBe(
      "/signing/recipient-1/complete"
    );
  });

  it("passes through non-signing URLs unchanged", () => {
    expect(resolveFirmaSigningEmbedUrl("https://example.com/other")).toBe("https://example.com/other");
  });

  it("returns null for empty input", () => {
    expect(resolveFirmaSigningEmbedUrl(null)).toBeNull();
    expect(resolveFirmaSigningEmbedUrl("")).toBeNull();
  });
});

describe("rewriteFirmaSigningProxyHtml", () => {
  it("injects branding patch and rewrites asset URLs", () => {
    const html = '<html><head></head><body><script src="/assets/main.js"></script></body></html>';
    const out = rewriteFirmaSigningProxyHtml(html);

    expect(out).toContain("<head><script>");
    expect(out).toContain("get-signing-view-data");
    expect(out).toContain('src="/firma-signing-assets/main.js"');
    expect(out).not.toContain("crossorigin");
    expect(out).toContain("#bc8b41");
  });
});

describe("rewriteFirmaSigningAssetPath", () => {
  it("rewrites Firma /assets paths to the signing asset proxy prefix", () => {
    expect(rewriteFirmaSigningAssetPath("/assets/pdf.worker-9aISQa3R.mjs")).toBe(
      "/firma-signing-assets/pdf.worker-9aISQa3R.mjs"
    );
    expect(rewriteFirmaSigningAssetPath("/other/path")).toBe("/other/path");
  });
});

describe("buildFirmaSigningBrandingInjectScript", () => {
  it("patches get-signing-view-data responses and rewrites proxied asset URLs", () => {
    const script = buildFirmaSigningBrandingInjectScript();
    expect(script).toContain("get-signing-view-data");
    expect(script).toContain("#bc8b41");
    expect(script).toContain("window.Worker");
    expect(script).toContain('ASSET_PREFIX="/firma-signing-assets"');
  });
});
