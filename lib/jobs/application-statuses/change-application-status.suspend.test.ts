import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/audit/activity-log", () => ({
  writeActivityLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/workers/candidate-kpi-cache", () => ({
  invalidateCandidateKpiCache: vi.fn(async () => undefined),
}));

vi.mock("@/lib/onboarding/activate-post-hire", () => ({
  activatePostHire: vi.fn(async () => ({
    activated: false,
    alreadyActive: true,
    phase: "post_hire",
    email: null,
  })),
  shouldActivatePostHireAfterStatusChange: (params: { status: string }) => params.status === "hired",
}));

import { writeActivityLog } from "@/lib/audit/activity-log";
import { changeApplicationStatus } from "@/lib/jobs/application-statuses/service";

const writeActivityLogMock = vi.mocked(writeActivityLog);

function supabaseForRevert(systemKey: string) {
  return {
    rpc: vi.fn(async () => ({
      data: {
        unchanged: false,
        application: {
          id: "app-1",
          statusId: "status-reviewing",
          status: "reviewing",
          statusName: "Screening Complete",
        },
        history: {
          id: "hist-1",
          fromStatusId: "status-hired",
          fromStatusName: "Selected by Client",
          toStatusId: "status-reviewing",
          toStatusName: "Screening Complete",
          note: null,
          changedByUserId: "user-1",
          changedAt: "2026-10-02T00:00:00Z",
        },
      },
      error: null,
    })),
    from: vi.fn(() => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: { system_key: systemKey }, error: null }),
      };
      return builder;
    }),
  };
}

describe("reverting Selected by Client", () => {
  beforeEach(() => {
    writeActivityLogMock.mockClear();
  });

  it("records post-hire suspension from the hired system key, not the display name", async () => {
    await changeApplicationStatus(supabaseForRevert("hired") as never, {
      tenantId: "tenant-1",
      applicationId: "app-1",
      statusId: "status-reviewing",
      changedByUserId: "user-1",
    });

    expect(writeActivityLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "post_hire.suspended",
        entityId: "app-1",
        tenantId: "tenant-1",
      })
    );
  });

  it("does not suspend when the previous system key is not hired", async () => {
    await changeApplicationStatus(supabaseForRevert("shortlisted") as never, {
      tenantId: "tenant-1",
      applicationId: "app-1",
      statusId: "status-reviewing",
      changedByUserId: "user-1",
    });

    const actions = writeActivityLogMock.mock.calls.map((call) => call[0]?.action);
    expect(actions).not.toContain("post_hire.suspended");
    expect(actions).toContain("application.status_changed");
  });
});
