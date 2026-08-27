import { describe, expect, it } from "vitest";
import {
  buildClaimSummary,
  isApplicationClaimEligible,
  isWorkerClaimEligible,
  normalizeUuidList,
} from "@/lib/candidates/claim";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("normalizeUuidList", () => {
  it("dedupes and keeps only valid uuids", () => {
    expect(normalizeUuidList([UUID_A, UUID_A, "not-a-uuid", UUID_B, 12])).toEqual([
      UUID_A,
      UUID_B,
    ]);
  });

  it("respects max bulk limit", () => {
    const ids = Array.from({ length: 5 }, (_, i) =>
      `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`
    );
    expect(normalizeUuidList(ids, 3)).toHaveLength(3);
  });
});

describe("claim eligibility", () => {
  it("allows unclaimed workers", () => {
    expect(
      isWorkerClaimEligible({
        assignedRecruiterUserId: null,
        status: "new",
        currentUserId: USER,
      }).eligible
    ).toBe(true);
  });

  it("blocks workers claimed by another recruiter", () => {
    const result = isWorkerClaimEligible({
      assignedRecruiterUserId: OTHER,
      status: "new",
      currentUserId: USER,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/another recruiter/i);
  });

  it("blocks already-claimed-by-self workers from reselection", () => {
    const result = isWorkerClaimEligible({
      assignedRecruiterUserId: USER,
      status: "new",
      currentUserId: USER,
    });
    expect(result.eligible).toBe(false);
  });

  it("blocks inactive workers", () => {
    expect(
      isWorkerClaimEligible({
        assignedRecruiterUserId: null,
        status: "inactive",
        currentUserId: USER,
      }).eligible
    ).toBe(false);
  });

  it("blocks archived applications", () => {
    expect(
      isApplicationClaimEligible({
        assignedRecruiterUserId: null,
        status: "archived",
        currentUserId: USER,
      }).eligible
    ).toBe(false);
  });
});

describe("buildClaimSummary", () => {
  it("describes partial success", () => {
    expect(
      buildClaimSummary({
        claimed: 10,
        already_claimed: 2,
        not_found: 0,
        unauthorized: 0,
        ineligible: 0,
        failed: 0,
      })
    ).toMatch(/10 candidates claimed successfully/i);
  });

  it("handles complete failure", () => {
    expect(
      buildClaimSummary({
        claimed: 0,
        already_claimed: 0,
        not_found: 0,
        unauthorized: 0,
        ineligible: 0,
        failed: 3,
      })
    ).toMatch(/3 failed/i);
  });
});
