import { describe, expect, it } from "vitest";
import {
  getFirmaSigningSessionStaleReason,
  isFirmaSigningSessionStale,
  staleFirmaSigningSessionMessage,
} from "@/lib/firma/session-staleness";

const base = {
  effectiveWorkspaceId: "workspace_new",
  recruiterTemplateId: "recruiter-1",
  expectedRecruiterTemplateId: "recruiter-1",
  firmaTemplateId: "firma-1",
  expectedFirmaTemplateId: "firma-1",
};

describe("getFirmaSigningSessionStaleReason", () => {
  it("returns not_found when Firma request is missing", () => {
    expect(getFirmaSigningSessionStaleReason({ ...base, notFound: true })).toBe("not_found");
  });

  it("returns workspace_mismatch when stored workspace differs", () => {
    expect(
      getFirmaSigningSessionStaleReason({
        ...base,
        storedWorkspaceId: "workspace_old",
        firmaStatus: "sent",
      })
    ).toBe("workspace_mismatch");
  });

  it("treats null stored workspace as legacy-compatible", () => {
    expect(
      getFirmaSigningSessionStaleReason({
        ...base,
        storedWorkspaceId: null,
        firmaStatus: "sent",
      })
    ).toBeNull();
  });

  it.each(["completed", "signed", "expired", "cancelled", "voided"])(
    "returns terminal_status for %s",
    (status) => {
      expect(
        getFirmaSigningSessionStaleReason({
          ...base,
          storedWorkspaceId: "workspace_new",
          firmaStatus: status,
        })
      ).toBe("terminal_status");
    }
  );

  it("returns draft_not_sent for draft requests", () => {
    expect(
      getFirmaSigningSessionStaleReason({
        ...base,
        storedWorkspaceId: "workspace_new",
        firmaStatus: "draft",
      })
    ).toBe("draft_not_sent");
  });

  it("returns template_changed when recruiter template id differs", () => {
    expect(
      getFirmaSigningSessionStaleReason({
        ...base,
        storedWorkspaceId: "workspace_new",
        firmaStatus: "sent",
        recruiterTemplateId: "recruiter-old",
      })
    ).toBe("template_changed");
  });

  it("returns template_changed when firma template id differs", () => {
    expect(
      getFirmaSigningSessionStaleReason({
        ...base,
        storedWorkspaceId: "workspace_new",
        firmaStatus: "sent",
        firmaTemplateId: "firma-old",
      })
    ).toBe("template_changed");
  });

  it("returns null for an in-progress sent request in the current workspace", () => {
    expect(
      getFirmaSigningSessionStaleReason({
        ...base,
        storedWorkspaceId: "workspace_new",
        firmaStatus: "sent",
      })
    ).toBeNull();
  });
});

describe("isFirmaSigningSessionStale", () => {
  it("mirrors getFirmaSigningSessionStaleReason", () => {
    expect(
      isFirmaSigningSessionStale({
        ...base,
        storedWorkspaceId: "workspace_old",
        firmaStatus: "sent",
      })
    ).toBe(true);
    expect(
      isFirmaSigningSessionStale({
        ...base,
        storedWorkspaceId: null,
        firmaStatus: "sent",
      })
    ).toBe(false);
  });
});

describe("staleFirmaSigningSessionMessage", () => {
  it("returns actionable messages for each stale reason", () => {
    expect(staleFirmaSigningSessionMessage("workspace_mismatch")).toContain("different Firma workspace");
    expect(staleFirmaSigningSessionMessage("draft_not_sent")).toContain("never sent");
    expect(staleFirmaSigningSessionMessage("terminal_status")).toContain("already finished");
  });
});
