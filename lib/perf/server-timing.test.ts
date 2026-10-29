import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import {
  enterHandlerServerTiming,
  formatServerTiming,
  installHandlerResponseTiming,
  logServerTiming,
  noteServerTimingCache,
  noteServerTimingTenant,
  recordServerTiming,
  runWithServerTiming,
  timeSpan,
} from "@/lib/perf/server-timing";

describe("server timing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats durations and strips unsafe description characters", () => {
    expect(
      formatServerTiming([
        { name: "db users", dur: 12.34, desc: 'GET /admin_recruiter/jobs "quoted"' },
        { name: "redis", dur: 0.4 },
      ]),
    ).toBe('dbusers;dur=12.3;desc="GET /admin_recruiter/jobs quoted", redis;dur=0.4');
  });

  it("puts middleware spans on the response and logs the staff request", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await runWithServerTiming(
      { scope: "middleware", route: "/admin_recruiter/jobs", method: "GET", tenantSlug: "acme" },
      async () => {
        await timeSpan("session", async () => undefined);
        noteServerTimingTenant("tenant-1");
        noteServerTimingCache(false, "miss");
        recordServerTiming("authz", 40);
        return NextResponse.next();
      },
    );

    const header = response.headers.get("Server-Timing") ?? "";
    expect(header).toContain("session;dur=");
    expect(header).toContain("authz;dur=40");
    expect(header).toContain("mw;dur=");
    expect(console.info).toHaveBeenCalledWith(
      "[server-timing]",
      expect.objectContaining({
        scope: "middleware",
        route: "/admin_recruiter/jobs",
        method: "GET",
        tenantSlug: "acme",
        tenantId: "tenant-1",
        cacheHit: false,
        cacheSource: "miss",
      }),
    );
  });

  it("does not log a public request that only measured middleware", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await runWithServerTiming({ scope: "middleware", route: "/login", method: "GET" }, async () => NextResponse.next());
    expect(console.info).not.toHaveBeenCalled();
  });

  it("adds handler spans when the route returns JSON", async () => {
    installHandlerResponseTiming();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    enterHandlerServerTiming({ route: "/api/admin/jobs", method: "GET", tenantSlug: "acme" });
    await timeSpan("db-permission-resources", async () => undefined);
    recordServerTiming("handler-auth", 25);
    const response = NextResponse.json({ ok: true });
    expect(response.headers.get("Server-Timing")).toContain("db-permission-resources;dur=");
    expect(response.headers.get("Server-Timing")).toContain("handler-auth;dur=25");
    logServerTiming();
    expect(console.info).toHaveBeenCalledWith(
      "[server-timing]",
      expect.objectContaining({ scope: "handler", route: "/api/admin/jobs", method: "GET" }),
    );
  });
});
