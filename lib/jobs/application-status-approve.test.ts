import { describe, expect, it } from "vitest";
import { resolveApproveStatusOption } from "@/lib/jobs/application-status";

describe("resolveApproveStatusOption", () => {
  it("prefers system_key approved", () => {
    expect(
      resolveApproveStatusOption([
        { id: "1", name: "Approved -Upload to Portal", systemKey: null },
        { id: "2", name: "Approved", systemKey: "approved" },
        { id: "3", name: "Candidate selected", systemKey: "hired" },
      ])?.id
    ).toBe("2");
  });

  it("falls back to recruiter Approved name and skips hired/MSP/Client", () => {
    expect(
      resolveApproveStatusOption([
        { id: "hired", name: "Candidate selected", systemKey: "hired" },
        { id: "msp", name: "Approved by MSP", systemKey: null },
        { id: "ok", name: "Approved -Upload to Portal", systemKey: null },
      ])?.id
    ).toBe("ok");
  });

  it("returns null when no approved status exists", () => {
    expect(
      resolveApproveStatusOption([
        { id: "hired", name: "Candidate selected", systemKey: "hired" },
        { id: "new", name: "New / Not Contacted", systemKey: "new" },
      ])
    ).toBeNull();
  });
});
