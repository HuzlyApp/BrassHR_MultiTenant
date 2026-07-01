import { describe, expect, it, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  clearTenantSlugCookieOnRootHost,
  ensureApplicationTenantQuery,
} from "@/lib/tenant/ensure-application-tenant-query";
import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";

function requestFor(url: string, cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", `${ONBOARDING_TENANT_SLUG_COOKIE}=${cookie}`);
  return new NextRequest(url, { headers });
}

describe("ensureApplicationTenantQuery", () => {
  beforeEach(() => {
    process.env.ROOT_DOMAIN = "brasshr.com";
  });
  it("does not propagate stale cookie on root domain without ?tenant=", () => {
    const req = requestFor("https://brasshr.com/application/add-resume", "zipstaff");
    const res = NextResponse.next();
    const out = ensureApplicationTenantQuery(req, res, null);
    expect(out.cookies.get(ONBOARDING_TENANT_SLUG_COOKIE)).toBeUndefined();
  });

  it("redirects mismatched ?tenant= to hostname cookie on vanity hosts", () => {
    const req = requestFor(
      "https://zipstaff.brasshr.com/application/add-resume?tenant=remotecompany",
      "zipstaff"
    );
    const res = NextResponse.next();
    const out = ensureApplicationTenantQuery(req, res, "zipstaff");
    expect(out.status).toBe(307);
    expect(out.headers.get("location")).toContain("tenant=zipstaff");
  });

  it("persists explicit ?tenant= on apex application paths", () => {
    const req = requestFor("https://brasshr.com/application/add-resume?tenant=zipstaff");
    const res = NextResponse.next();
    const out = ensureApplicationTenantQuery(req, res, null);
    expect(out.cookies.get(ONBOARDING_TENANT_SLUG_COOKIE)?.value).toBe("zipstaff");
  });
});

describe("clearTenantSlugCookieOnRootHost", () => {
  beforeEach(() => {
    process.env.ROOT_DOMAIN = "brasshr.com";
  });
  it("clears tenant cookie on marketing root paths", () => {
    const req = requestFor("https://brasshr.com/", "zipstaff");
    const res = NextResponse.next();
    const out = clearTenantSlugCookieOnRootHost(req, res);
    expect(out.cookies.get(ONBOARDING_TENANT_SLUG_COOKIE)).toBeUndefined();
  });

  it("does not clear cookie when root URL has explicit ?tenant=", () => {
    const req = requestFor("https://brasshr.com/login?tenant=zipstaff", "zipstaff");
    const res = NextResponse.next();
    const out = clearTenantSlugCookieOnRootHost(req, res);
    expect(out).toBe(res);
    expect(out.cookies.get(ONBOARDING_TENANT_SLUG_COOKIE)).toBeUndefined();
  });
});
