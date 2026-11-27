import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/audit/activity-log", () => ({
  writeActivityLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/jobs/application-statuses/service", () => ({
  getStatusBySystemKey: vi.fn(),
  changeApplicationStatus: vi.fn(),
}));

import { writeActivityLog } from "@/lib/audit/activity-log";
import {
  changeApplicationStatus,
  getStatusBySystemKey,
} from "@/lib/jobs/application-statuses/service";
import {
  ACCEPTED_OTHER_OFFER_FREEZE_NOTE,
  freezeOtherApplicationsOnHire,
} from "./freeze-other-applications-on-hire";

describe("freezeOtherApplicationsOnHire", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("freezes non-terminal sibling applications and writes an activity log", async () => {
    const supabase = {
      from(table: string) {
        expect(table).toBe("job_applications");
        return {
          select() {
            return {
              eq() {
                return {
                  eq: async () => ({
                    data: [
                      { id: "accepted", status: "hired" },
                      { id: "open-a", status: "reviewing" },
                      { id: "open-b", status: "new" },
                      { id: "already-closed", status: "archived" },
                    ],
                    error: null,
                  }),
                };
              },
            };
          },
        };
      },
    };

    vi.mocked(getStatusBySystemKey).mockResolvedValue({
      id: "status-archived",
      isActive: true,
    } as never);
    vi.mocked(changeApplicationStatus).mockResolvedValue({ unchanged: false } as never);

    const result = await freezeOtherApplicationsOnHire(supabase as never, {
      tenantId: "tenant-1",
      workerId: "worker-1",
      acceptedApplicationId: "accepted",
      actorUserId: "staff-1",
    });

    expect(result.frozenApplicationIds).toEqual(["open-a", "open-b"]);
    expect(result.skippedApplicationIds).toEqual([]);
    expect(changeApplicationStatus).toHaveBeenCalledTimes(2);
    expect(changeApplicationStatus).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        applicationId: "open-a",
        statusId: "status-archived",
        note: ACCEPTED_OTHER_OFFER_FREEZE_NOTE,
        changeSource: "SYSTEM",
      })
    );
    expect(writeActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: "worker-1",
        metadata: expect.objectContaining({
          accepted_application_id: "accepted",
          frozen_application_ids: ["open-a", "open-b"],
        }),
      })
    );
  });

  it("no-ops when there is no accepted application id", async () => {
    const result = await freezeOtherApplicationsOnHire({} as never, {
      tenantId: "tenant-1",
      workerId: "worker-1",
      acceptedApplicationId: null,
    });
    expect(result).toEqual({
      frozenApplicationIds: [],
      skippedApplicationIds: [],
      errors: [],
    });
    expect(getStatusBySystemKey).not.toHaveBeenCalled();
  });
});
