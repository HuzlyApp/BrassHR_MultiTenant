import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), statuses: vi.fn(), groups: vi.fn(), counts: vi.fn() }));
vi.mock("@/lib/auth/api-session", () => ({ requireStaffApiSession: mocks.auth }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({}) }));
vi.mock("@/lib/jobs/tenant", () => ({ resolveStaffTenantId: async () => "tenant-a" }));
vi.mock("@/lib/jobs/application-statuses", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/jobs/application-statuses")>(),
  listApplicationStatuses: mocks.statuses, listApplicationStatusGroups: mocks.groups, countApplicationsByStatus: mocks.counts,
}));
import { GET } from "./route";
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ role: "admin", userId: "staff-a" }); });
describe("parallel status/group reads", () => {
  it("starts both reads together and avoids a group reload for an existing catalog", async () => {
    let finish!: (value: unknown) => void;
    mocks.statuses.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    mocks.groups.mockResolvedValue([{ id: "group-a" }]);
    const result = GET(new NextRequest("https://example.test/api/admin/application-statuses"));
    for (let i = 0; i < 5; i++) await Promise.resolve();
    const groupsStarted = mocks.groups.mock.calls.length;
    finish([{ id: "status-a", groupId: "group-a" }]);
    expect(await (await result).json()).toMatchObject({ statuses: [{ id: "status-a" }], groups: [{ id: "group-a" }] });
    expect(groupsStarted).toBe(1);
    expect(mocks.groups).toHaveBeenCalledTimes(1);
    expect(mocks.statuses).toHaveBeenCalledWith({}, "tenant-a", { activeOnly: false });
    expect(mocks.counts).not.toHaveBeenCalled();
  });
  it("reloads groups created by first-time status seeding", async () => {
    mocks.statuses.mockResolvedValue([{ id: "status-a", groupId: "new-group" }]);
    mocks.groups.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "new-group" }]);
    mocks.counts.mockResolvedValue({ "status-a": 2 });
    const response = await GET(new NextRequest("https://example.test/api/admin/application-statuses?includeCounts=1"));
    expect(response.status).toBe(200);
    expect((await response.json()).groups).toEqual([{ id: "new-group" }]);
    expect(mocks.groups).toHaveBeenCalledTimes(2);
  });
});
