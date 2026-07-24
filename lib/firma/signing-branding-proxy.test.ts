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
  it("injects default BrassHR palette when none is provided", () => {
    const html = '<html><head></head><body><script src="/assets/main.js"></script></body></html>';
    const out = rewriteFirmaSigningProxyHtml(html);

    expect(out).toContain("<head><script>");
    expect(out).toContain("get-signing-view-data");
    expect(out).toContain('src="/firma-signing-assets/main.js"');
    expect(out).toContain("#bc8b41");
  });

  it("injects tenant palette when provided", () => {
    const html = '<html><head></head><body><script src="/assets/main.js"></script></body></html>';
    const out = rewriteFirmaSigningProxyHtml(html, {
      primary: "#2563eb",
      primary_fg: "#ffffff",
      background: "#1c1c21",
      foreground: "#ffffff",
      card: "#22222a",
      border: "#3b3b3b",
      accent: "#93c5fd",
      accent_fg: "#101828",
      canvas: "#0f1419",
      muted: "#22222a",
      muted_fg: "#1d4ed8",
    });

    expect(out).toContain("#2563eb");
    expect(out).not.toContain("#bc8b41");
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
