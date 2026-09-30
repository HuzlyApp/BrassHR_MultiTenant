import { describe, expect, it } from "vitest";
import { adminHeaderRefetchInterval, ADMIN_HEADER_POLL_MS } from "@/lib/admin/hooks/use-admin-header-data";

describe("adminHeaderRefetchInterval", () => {
  it("polls every 30s while the tab is visible", () => {
    expect(adminHeaderRefetchInterval("visible")).toBe(ADMIN_HEADER_POLL_MS);
  });

  it("does not poll while the tab is hidden", () => {
    expect(adminHeaderRefetchInterval("hidden")).toBe(false);
  });
});
