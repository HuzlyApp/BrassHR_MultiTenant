import { describe, expect, it, beforeEach } from "vitest";
import { __resetRateLimitForTests, checkRateLimit } from "@/lib/security/rate-limit";

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
});
