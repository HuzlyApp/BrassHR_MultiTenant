import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ base: vi.fn() }));
vi.mock("@/lib/workers/requests-context", () => ({
  requireWorkerRequestContext: mocks.base,
}));
vi.mock("@/lib/scheduling/api-context", () => ({ schedulingError: vi.fn() }));
import { requireTimeContext } from "./api-context";
describe("time context", () => {
  beforeEach(() => vi.resetAllMocks());
  it("checks the timesheets feature before an employee lookup", async () => {
    mocks.base.mockResolvedValue({
      features: { timesheets: false },
      supabase: {},
      ownWorkerIds: ["candidate"],
    });
    await expect(
      requireTimeContext(new Request("https://example.test/api/v1/timesheets")),
    ).rejects.toMatchObject({ status: 403, code: "FEATURE_DISABLED" });
  });
  it("maps only owned candidate profiles to hired employee IDs in the same tenant", async () => {
    const eq = vi.fn().mockReturnThis(),
      inside = vi
        .fn()
        .mockResolvedValue({ data: [{ id: "employee" }], error: null });
    const chain = { select: vi.fn().mockReturnThis(), eq, in: inside };
    eq.mockImplementation(() => chain);
    mocks.base.mockResolvedValue({
      features: { timesheets: true },
      tenantId: "tenant",
      ownWorkerIds: ["candidate"],
      supabase: { from: () => chain },
    });
    const result = await requireTimeContext(
      new Request("https://example.test/api/v1/timesheets"),
    );
    expect(result).toMatchObject({ ownEmployeeIds: ["employee"] });
    expect(eq).toHaveBeenCalledWith("tenant_id", "tenant");
    expect(inside).toHaveBeenCalledWith("candidate_id", ["candidate"]);
  });
  it("keeps staff scope and requests the staff-only guard for review", async () => {
    mocks.base.mockResolvedValue({
      features: { timesheets: true },
      tenantId: "tenant",
      ownWorkerIds: null,
      supabase: {},
    });
    const req = new Request(
      "https://example.test/api/v1/timesheets/id/approve",
    );
    expect(await requireTimeContext(req, true)).toMatchObject({
      ownEmployeeIds: null,
    });
    expect(mocks.base).toHaveBeenCalledWith(req, true, false);
  });
});
