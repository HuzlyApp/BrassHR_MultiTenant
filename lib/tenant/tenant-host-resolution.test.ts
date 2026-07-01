import { describe, expect, it } from "vitest";
import {
  extractTenantSubdomainLabel,
  isRootDomainHost,
  normalizeHostHeader,
} from "@/lib/tenant/tenant-host-resolution";

const ROOT = "brasshr.com";

describe("tenant host resolution", () => {
  it("treats apex and www as root domain", () => {
    expect(isRootDomainHost("brasshr.com", ROOT)).toBe(true);
    expect(isRootDomainHost("www.brasshr.com", ROOT)).toBe(true);
    expect(extractTenantSubdomainLabel("brasshr.com", ROOT)).toBeNull();
    expect(extractTenantSubdomainLabel("www.brasshr.com", ROOT)).toBeNull();
  });

  it("extracts single-label tenant subdomains", () => {
    expect(extractTenantSubdomainLabel("zipstaff.brasshr.com", ROOT)).toBe("zipstaff");
    expect(extractTenantSubdomainLabel("remotecompany.brasshr.com", ROOT)).toBe(
      "remotecompany"
    );
  });

  it("rejects nested subdomains and foreign domains", () => {
    expect(extractTenantSubdomainLabel("a.b.brasshr.com", ROOT)).toBeNull();
    expect(extractTenantSubdomainLabel("example.com", ROOT)).toBeNull();
    expect(extractTenantSubdomainLabel("localhost", ROOT)).toBeNull();
  });

  it("normalizes host headers with ports", () => {
    expect(normalizeHostHeader("ZipStaff.BrassHR.com:443")).toBe("zipstaff.brasshr.com");
  });
});

describe("resolveTenantHostFromHostname", () => {
  it("classifies root vs tenant hosts", async () => {
    const { resolveTenantHostFromHostname } = await import("@/lib/tenant/resolve-tenant-context");
    expect(resolveTenantHostFromHostname("brasshr.com", ROOT)).toMatchObject({
      isRootDomain: true,
      subdomainLabel: null,
    });
    expect(resolveTenantHostFromHostname("zipstaff.brasshr.com", ROOT)).toMatchObject({
      isRootDomain: false,
      subdomainLabel: "zipstaff",
    });
  });
});

describe("buildTenantBrandingApiUrl", () => {
  it("uses subdomain param on vanity hosts", async () => {
    const { buildTenantBrandingApiUrl } = await import("@/lib/tenant/resolve-tenant-context");
    expect(
      buildTenantBrandingApiUrl({
        subdomainLabel: "zipstaff",
        slug: "zipstaff",
        isRootDomain: false,
      })
    ).toBe("/api/tenant-branding?subdomain=zipstaff");
  });

  it("uses platform default on root without slug", async () => {
    const { buildTenantBrandingApiUrl } = await import("@/lib/tenant/resolve-tenant-context");
    expect(
      buildTenantBrandingApiUrl({
        subdomainLabel: null,
        slug: null,
        isRootDomain: true,
      })
    ).toBe("/api/tenant-branding");
  });
});

describe("hostnameStorageKey", () => {
  it("scopes storage keys by hostname", async () => {
    const { hostnameStorageKey } = await import("@/lib/tenant/scoped-storage");
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { hostname: "zipstaff.brasshr.com" } },
    });
    expect(hostnameStorageKey("applicantId")).toBe(
      "brasshr:zipstaff.brasshr.com:applicantId"
    );
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  });
});
