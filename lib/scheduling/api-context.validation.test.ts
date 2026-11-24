import { describe, expect, it } from "vitest";
import { z } from "zod";
import { invalidSchedule, invalidTimeInput } from "./api-context";

describe("scheduling/timesheet validation responses (BUG-203)", () => {
  it("documents required schedule query params when date range is missing", async () => {
    const schema = z.object({ date_from: z.iso.date(), date_to: z.iso.date() });
    const parsed = schema.safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const res = invalidSchedule(parsed.error, {
      required: ["date_from", "date_to"],
      optional: ["facility_id", "department_id", "view", "page", "limit"],
      example: "/api/v1/schedules?date_from=2026-11-16&date_to=2026-11-30",
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.required).toEqual(["date_from", "date_to"]);
    expect(body.example).toContain("date_from=");
    expect(String(body.error)).toMatch(/Required: date_from, date_to/i);
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues.length).toBeGreaterThan(0);
  });

  it("documents required timesheet period params when missing", async () => {
    const schema = z.object({
      period_start: z.iso.date(),
      period_end: z.iso.date(),
    });
    const parsed = schema.safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const res = invalidTimeInput(parsed.error, {
      required: ["period_start", "period_end"],
      example: "/api/v1/timesheets?period_start=2026-11-01&period_end=2026-11-30",
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.required).toEqual(["period_start", "period_end"]);
    expect(String(body.error)).toMatch(/Invalid timesheet input/i);
    expect(String(body.error)).toMatch(/period_start/i);
  });
});
