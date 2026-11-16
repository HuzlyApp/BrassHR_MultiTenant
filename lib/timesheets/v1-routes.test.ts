import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  get: vi.fn(),
  transition: vi.fn(),
  clock: vi.fn(),
}));
vi.mock("./api-context", () => ({
  requireTimeContext: mocks.context,
  timeApiError: () => NextResponse.json({ error: "Denied" }, { status: 403 }),
}));
vi.mock("./v1-service", () => ({
  getPeriodTimesheet: mocks.get,
  transitionPeriodTimesheet: mocks.transition,
  recordEmployeeClockEvent: mocks.clock,
}));
import { POST as clock } from "@/app/api/v1/clock-events/route";
import { POST as submit } from "@/app/api/v1/timesheets/[id]/submit/route";
import { POST as approve } from "@/app/api/v1/timesheets/[id]/approve/route";
import { POST as reject } from "@/app/api/v1/timesheets/[id]/reject/route";
const id = "10000000-0000-4000-8000-000000000001",
  route = { params: Promise.resolve({ id }) };
const req = (body?: string) =>
  new Request("https://example.test/api/v1/timesheets/id/approve", {
    method: "POST",
    body,
  });
describe("time route authorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.context.mockResolvedValue({
      supabase: {},
      tenantId: "tenant",
      auth: { userId: "actor" },
      ownEmployeeIds: [id],
    });
  });
  it("preserves authentication denial before a clock mutation", async () => {
    mocks.context.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    expect((await clock(req("{}"))).status).toBe(401);
    expect(mocks.clock).not.toHaveBeenCalled();
  });
  it("requires staff authorization for review and checks sheet scope before transition", async () => {
    mocks.get.mockResolvedValue({ id });
    mocks.transition.mockResolvedValue({ status: "approved" });
    const request = req();
    expect((await approve(request, route)).status).toBe(200);
    expect(mocks.context).toHaveBeenCalledWith(request, true);
    expect(mocks.get).toHaveBeenCalledWith({}, "tenant", [id], id);
  });
  it("rejects blank rejection notes and reviewer injection", async () => {
    expect((await reject(req("{}"), route)).status).toBe(422);
    expect((await approve(req('{"reviewed_by":"forged"}'), route)).status).toBe(
      422,
    );
    expect(mocks.transition).not.toHaveBeenCalled();
  });
  it("lets workers submit but uses the server actor and owned scope", async () => {
    mocks.get.mockResolvedValue({ id });
    mocks.transition.mockResolvedValue({ status: "submitted" });
    const request = req();
    expect((await submit(request, route)).status).toBe(200);
    expect(mocks.context).toHaveBeenCalledWith(request, false);
    expect(mocks.transition).toHaveBeenCalledWith(
      {},
      "tenant",
      "actor",
      id,
      "submit",
      undefined,
    );
  });
  it("does not transition a sheet if its ownership lookup fails", async () => {
    mocks.get.mockRejectedValue(new Error("No access"));
    expect((await submit(req(), route)).status).toBe(403);
    expect(mocks.transition).not.toHaveBeenCalled();
  });
});
