import { describe, expect, it } from "vitest";
import { rethrowDynamicServerUsage } from "@/lib/auth/dynamic-server-usage";

describe("rethrowDynamicServerUsage", () => {
  it("rethrows Next static-render bailouts", () => {
    const error = Object.assign(new Error("Dynamic server usage: cookies"), {
      digest: "DYNAMIC_SERVER_USAGE",
    });
    expect(() => rethrowDynamicServerUsage(error)).toThrow(error);
  });

  it("leaves real auth failures in place", () => {
    expect(() => rethrowDynamicServerUsage(new Error("session lookup failed"))).not.toThrow();
  });
});
