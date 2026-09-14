import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobRequisitionInput } from "@/lib/jobs/types";
import { SERVICE_AREA_COPY } from "@/lib/service-area/copy";

vi.mock("@/lib/service-area/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/service-area/db")>();
  return {
    ...actual,
    evaluateServiceAreaWithDb: vi.fn(),
    assertTenantCanOperate: vi.fn(),
  };
});

import { evaluateServiceAreaWithDb } from "@/lib/service-area/db";
import {
  evaluateJobServiceArea,
  jobInputToServiceAreaLocation,
} from "@/lib/service-area/jobs";

const evaluateMock = vi.mocked(evaluateServiceAreaWithDb);

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

  it("rejects draft create for a platform-hold worksite", async () => {
    evaluateMock.mockResolvedValue(holdDecision);
    await expect(
      evaluateJobServiceArea({} as never, "tenant-1", job(), {
        publish: false,
        actorUserId: "user-1",
      })
    ).rejects.toMatchObject({
      code: "platform_hold",
      fieldErrors: { location: SERVICE_AREA_COPY.location_not_enabled },
    });
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
