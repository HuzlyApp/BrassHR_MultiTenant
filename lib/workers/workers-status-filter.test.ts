import { describe, expect, it } from "vitest";
import { parseWorkersListParams, statusOrFilter } from "@/lib/workers/workers-status-filter";

describe("workers-status-filter", () => {
  it("builds or filter for new status including null", () => {
    expect(statusOrFilter("status", "new")).toBe(
      "status.in.(new,New,NEW),status.is.null"
    );
  });

  it("builds in filter for non-new statuses", () => {
    expect(statusOrFilter("status", "approved")).toBe("status.in.(approved,Approved,APPROVED)");
  });

  it("defaults limit to 50 and caps at 500", () => {
    expect(parseWorkersListParams(new URLSearchParams()).limit).toBe(50);
    expect(parseWorkersListParams(new URLSearchParams("limit=9999")).limit).toBe(500);
  });

  it("computes range end for Supabase .range()", () => {
    const params = parseWorkersListParams(new URLSearchParams("offset=100&limit=50"));
    expect(params.offset).toBe(100);
    expect(params.rangeEnd).toBe(149);
  });
});
