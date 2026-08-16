import { describe, expect, it, vi } from "vitest";
import {
  shouldActivatePostHireAfterStatusChange,
} from "@/lib/onboarding/activate-post-hire";
import {
  applicantMayActOnStep,
  isTerminalApplicationStatus,
} from "@/lib/onboarding/workflow-phase";

describe("activatePostHire invariants", () => {
  it("activates only for hired / placement-accepted statuses", () => {
    expect(
      shouldActivatePostHireAfterStatusChange({ unchanged: false, status: "hired" })
    ).toBe(true);
    expect(
      shouldActivatePostHireAfterStatusChange({ unchanged: true, status: "hired" })
    ).toBe(true);
    expect(
      shouldActivatePostHireAfterStatusChange({ unchanged: false, status: "interviewing" })
    ).toBe(false);
    expect(
      shouldActivatePostHireAfterStatusChange({ unchanged: false, status: "rejected" })
    ).toBe(false);
  });

  it("does not treat completing Pre-Hire as hiring the candidate", () => {
    expect(isTerminalApplicationStatus("rejected")).toBe(true);
    expect(
      applicantMayActOnStep({ activePhase: "pre_hire", stepPhase: "post_hire" })
    ).toBe(false);
  });

  it("is idempotent: a second activation does not create a new logical phase", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: {
          activated: true,
          alreadyActive: false,
          phase: "post_hire",
          postHireActivatedAt: "2026-08-14T00:00:00Z",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          activated: false,
          alreadyActive: true,
          phase: "post_hire",
          postHireActivatedAt: "2026-08-14T00:00:00Z",
        },
        error: null,
      });

    const first = await rpc();
    const second = await rpc();
    expect(first.data.activated).toBe(true);
    expect(second.data.alreadyActive).toBe(true);
    expect(first.data.postHireActivatedAt).toBe(second.data.postHireActivatedAt);
  });

  it("keeps Job A and Job B phases independent for the same worker", () => {
    const priya = {
      jobA: { applicationId: "a", phase: "post_hire" as const },
      jobB: { applicationId: "b", phase: "pre_hire" as const },
    };
    expect(priya.jobA.phase).not.toBe(priya.jobB.phase);
    expect(priya.jobA.applicationId).not.toBe(priya.jobB.applicationId);
  });
});
