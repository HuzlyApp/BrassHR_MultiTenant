import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  __resetRateLimitForTests,
  checkRateLimit,
  envRateLimit,
} from "@/lib/security/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    delete process.env.REDIS_URL;
    delete process.env.REDIS_TOKEN;
    __resetRateLimitForTests();
  });

  it("allows requests under the limit", async () => {
    await expect(
      checkRateLimit({ namespace: "test", key: "user-a", limit: 2, windowMs: 60_000 })
    ).resolves.toMatchObject({ allowed: true, remaining: 1, store: "memory" });
  });

  it("blocks requests over the limit", async () => {
    const options = { namespace: "test", key: "user-a", limit: 1, windowMs: 60_000 };
    await checkRateLimit(options);

    await expect(checkRateLimit(options)).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
      store: "memory",
    });
  });

  it("isolates namespaces", async () => {
    await checkRateLimit({ namespace: "a", key: "same", limit: 1, windowMs: 60_000 });

    await expect(
      checkRateLimit({ namespace: "b", key: "same", limit: 1, windowMs: 60_000 })
    ).resolves.toMatchObject({ allowed: true });
  });

  it("reports remaining window seconds instead of the full window", async () => {
    const options = { namespace: "retry-after", key: "user-a", limit: 1, windowMs: 60_000 };
    const first = await checkRateLimit(options);
    expect(first.retryAfterSec).toBeGreaterThan(0);
    expect(first.retryAfterSec).toBeLessThanOrEqual(60);

    const blocked = await checkRateLimit(options);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(60);
  });
});

describe("envRateLimit", () => {
  const ENV_NAME = "RATE_LIMIT_TEST_VALUE";

  afterEach(() => {
    delete process.env[ENV_NAME];
  });

  it("uses the fallback when unset, empty, or non-positive", () => {
    delete process.env[ENV_NAME];
    expect(envRateLimit(ENV_NAME, 80)).toBe(80);

    process.env[ENV_NAME] = "";
    expect(envRateLimit(ENV_NAME, 80)).toBe(80);

    process.env[ENV_NAME] = "0";
    expect(envRateLimit(ENV_NAME, 80)).toBe(80);

    process.env[ENV_NAME] = "-1";
    expect(envRateLimit(ENV_NAME, 80)).toBe(80);
  });

  it("reads a positive integer from env", () => {
    process.env[ENV_NAME] = "120";
    expect(envRateLimit(ENV_NAME, 80)).toBe(120);
  });
});
