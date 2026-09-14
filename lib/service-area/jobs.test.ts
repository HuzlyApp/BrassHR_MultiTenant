import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobRequisitionInput } from "@/lib/jobs/types";
import { SERVICE_AREA_COPY } from "@/lib/service-area/copy";

vi.mock("@/lib/service-area/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/service-area/db")>();
  return {
    ...actual,
    evaluateServiceAreaWithDb: vi.fn(),
    assertTenantCanOperate: vi.fn(),
    loadJobWorksite: vi.fn(),
    recordWorkLocationConfirmation: vi.fn(),
  };
});

import { evaluateServiceAreaWithDb, loadJobWorksite, recordWorkLocationConfirmation } from "@/lib/service-area/db";
import {
  evaluateJobServiceArea,
  jobInputToServiceAreaLocation,
  requireApplyWorkLocation,
} from "@/lib/service-area/jobs";

const evaluateMock = vi.mocked(evaluateServiceAreaWithDb);
const loadJobWorksiteMock = vi.mocked(loadJobWorksite);
const recordConfirmationMock = vi.mocked(recordWorkLocationConfirmation);

const holdDecision = {
  allowed: false as const,
  reasonCode: "platform_hold" as const,
  messageKey: "location_not_enabled" as const,
  layer: "platform" as const,
  matchedPolicyId: "p-ca",
};

const okDecision = {
  allowed: true as const,
  reasonCode: "ok" as const,
  messageKey: "location_not_available" as const,
  layer: null,
  matchedPolicyId: null,
};

const incompleteDecision = {
  allowed: false as const,
  reasonCode: "incomplete_location" as const,
  messageKey: "location_not_enabled" as const,
  layer: null,
  matchedPolicyId: null,
};

function job(overrides: Partial<JobRequisitionInput> = {}): JobRequisitionInput {
  return {
    sourceType: "Internal",
    employmentType: "W2",
    location: "Los Angeles, California",
    jobLocationType: "On-site",
    ...overrides,
  };
}

describe("jobInputToServiceAreaLocation", () => {
  it("reads MSP facility when location is empty", () => {
    const location = jobInputToServiceAreaLocation(
      job({
        sourceType: "MSP",
        location: null,
        facility: "Chicago, Illinois",
      })
    );
    expect(location.city).toBe("Chicago");
    expect(location.state).toBe("IL");
  });
});

describe("evaluateJobServiceArea", () => {
  beforeEach(() => {
    evaluateMock.mockReset();
  });

  it("warns on draft create for a platform-hold worksite without throwing", async () => {
    evaluateMock.mockResolvedValue(holdDecision);
    const result = await evaluateJobServiceArea({} as never, "tenant-1", job(), {
      publish: false,
      actorUserId: "user-1",
    });
    expect(result.status).toBe("blocked");
    expect(result.warning).toBe(SERVICE_AREA_COPY.location_not_enabled);
  });

  it("rejects publish for a platform-hold worksite", async () => {
    evaluateMock.mockResolvedValue(holdDecision);
    await expect(
      evaluateJobServiceArea({} as never, "tenant-1", job(), {
        publish: true,
        actorUserId: "user-1",
      })
    ).rejects.toMatchObject({ code: "platform_hold" });
  });

  it("allows a complete allowed worksite", async () => {
    evaluateMock.mockResolvedValue(okDecision);
    const result = await evaluateJobServiceArea(
      {} as never,
      "tenant-1",
      job({ location: "Austin, TX" }),
      { publish: true, actorUserId: "user-1" }
    );
    expect(result.status).toBe("ok");
  });

  it("warns on incomplete draft location without throwing", async () => {
    evaluateMock.mockResolvedValue(incompleteDecision);
    const result = await evaluateJobServiceArea(
      {} as never,
      "tenant-1",
      job({ location: "California" }),
      { publish: false, actorUserId: "user-1" }
    );
    expect(result.status).toBe("blocked");
    expect(result.warning).toBe(SERVICE_AREA_COPY.location_not_enabled);
  });
});

describe("requireApplyWorkLocation", () => {
  beforeEach(() => {
    evaluateMock.mockReset();
    loadJobWorksiteMock.mockReset();
    recordConfirmationMock.mockReset();
    evaluateMock.mockResolvedValue(okDecision);
    recordConfirmationMock.mockResolvedValue(undefined);
  });

  it("requires a current work-location payload", async () => {
    await expect(
      requireApplyWorkLocation({} as never, {
        tenantId: "t1",
        jobId: "j1",
        location: null,
      })
    ).rejects.toMatchObject({ code: "incomplete_location" });
  });

  it("evaluates an onsite job worksite even if the applicant typed an allowed city", async () => {
    loadJobWorksiteMock.mockResolvedValue({
      city: "Los Angeles",
      state: "CA",
      postalCode: "90012",
      locationType: "onsite",
      remoteAllowedStates: [],
      isPublished: true,
    });
    evaluateMock.mockResolvedValue(holdDecision);
    await expect(
      requireApplyWorkLocation({} as never, {
        tenantId: "t1",
        jobId: "j1",
        location: { city: "Dallas", state: "TX", locationType: "onsite", relocateToJobSite: false },
      })
    ).rejects.toMatchObject({ code: "platform_hold" });
    expect(evaluateMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        location: expect.objectContaining({ city: "Los Angeles", state: "CA" }),
      }),
      expect.anything()
    );
  });

  it("does not use an old confirmation when location is omitted", async () => {
    const supabase = {
      from: vi.fn(() => {
        throw new Error("confirmation shortcut must not run");
      }),
    };
    await expect(
      requireApplyWorkLocation(supabase as never, {
        tenantId: "t1",
        jobId: "j1",
        applicantId: "a1",
        location: null,
      })
    ).rejects.toMatchObject({ code: "incomplete_location" });
  });
});
