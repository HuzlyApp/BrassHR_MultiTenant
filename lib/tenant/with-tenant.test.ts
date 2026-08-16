import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { withTenant } from "@/lib/tenant/with-tenant";

describe("withTenant job_token preservation", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    const store: Record<string, string> = {
      applicationJobToken: "job-token-abc",
    };
    vi.stubGlobal("window", {
      location: { search: "?tenant=remote&job_token=job-token-abc" },
      localStorage: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
          store[key] = value;
        },
      },
    });
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      // @ts-expect-error cleanup jsdom stub
      delete globalThis.window;
    } else {
      vi.stubGlobal("window", originalWindow);
    }
    vi.unstubAllGlobals();
  });

  it("appends job_token when navigating application paths", () => {
    expect(withTenant("/application/profile-information", "remote")).toBe(
      "/application/profile-information?tenant=remote&job_token=job-token-abc"
    );
  });
});
