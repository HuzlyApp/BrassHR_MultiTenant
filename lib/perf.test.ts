import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPerfTimer, logPerf } from "@/lib/perf";

describe("perf logging", () => {
  beforeEach(() => {
    vi.stubEnv("PERF_LOG", "true");
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("logs structured perf events when PERF_LOG is enabled", () => {
    logPerf("GET /api/test", { totalMs: 42, cacheHit: true, tenantId: "t-1" });
    expect(console.info).toHaveBeenCalledWith(
      "[perf]",
      expect.objectContaining({ route: "GET /api/test", totalMs: 42, cacheHit: true }),
    );
  });

  it("measures elapsed time", () => {
    const timer = createPerfTimer();
    expect(timer.elapsedMs()).toBeGreaterThanOrEqual(0);
  });
});
