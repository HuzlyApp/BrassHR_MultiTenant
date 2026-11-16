import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
const context = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("./api-context", async (importOriginal) => ({ ...await importOriginal<object>(), requireSchedulingContext: context.load }));
import { GET as schedules } from "@/app/api/v1/schedules/route";
import { GET as whoIsOff } from "@/app/api/v1/schedules/who-is-off/route";
import { POST as holiday } from "@/app/api/v1/tenant-holidays/route";
import { POST as assignments } from "@/app/api/v1/shifts/[id]/assignments/route";
import { requireSchedulingContext } from "./api-context";

describe("v1 scheduling route boundaries", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it("returns auth denials unchanged before loading schedule data", async () => {
    context.load.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    const req = new Request("https://example.test/api/v1/schedules?date_from=2026-11-16&date_to=2026-11-30");
    expect((await schedules(req)).status).toBe(403);
    expect((await whoIsOff(req)).status).toBe(403);
    expect(requireSchedulingContext).toHaveBeenCalledWith(req);
  });
  it("rejects malformed date filters before querying", async () => {
    context.load.mockResolvedValue({ supabase: {}, tenantId: "authorized", features: {} });
    expect((await schedules(new Request("https://example.test/api/v1/schedules?date_from=2026-02-30&date_to=2026-03-01"))).status).toBe(422);
  });
  it("rejects holiday tenant injection before inserting", async () => {
    context.load.mockResolvedValue({ supabase: {}, tenantId: "authorized", features: {} });
    const result = await holiday(new Request("https://example.test/api/v1/tenant-holidays", { method: "POST", body: JSON.stringify({
      name: "Holiday", holiday_date: "2026-11-26", is_paid: true, tenant_id: "foreign",
    }) }));
    expect(result.status).toBe(422);
  });
  it("denies bill-rate writes when the feature is off, before looking up the shift", async () => {
    context.load.mockResolvedValue({ supabase: {}, tenantId: "authorized", features: { bill_rates: false } });
    const result = await assignments(new Request("https://example.test/api/v1/shifts/id/assignments", { method: "POST", body: JSON.stringify({
      worker_ids: ["10000000-0000-4000-8000-000000000001"], bill_rate: 40,
    }) }), { params: Promise.resolve({ id: "10000000-0000-4000-8000-000000000002" }) });
    expect(result.status).toBe(403);
  });
});
