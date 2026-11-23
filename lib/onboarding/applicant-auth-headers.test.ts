/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from "vitest";

const setScopedApplicantId = vi.fn();
const getSession = vi.fn();

vi.mock("@/lib/tenant/scoped-storage", () => ({
  setScopedApplicantId: (...args: unknown[]) => setScopedApplicantId(...args),
}));

vi.mock("@/lib/supabase-applicant-browser", () => ({
  getApplicantSupabaseClient: () => ({
    auth: {
      getSession: (...args: unknown[]) => getSession(...args),
    },
  }),
}));

describe("applicantAuthHeaders", () => {
  beforeEach(() => {
    vi.resetModules();
    setScopedApplicantId.mockReset();
    getSession.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  it("returns the draft-preview id and never reads a live session during preview (BUG-130)", async () => {
    window.history.replaceState({}, "", "/application/profile-review?tenant=zippycorp&preview=draft");
    getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "live-token",
          user: { id: "real-applicant-auth-user" },
        },
      },
    });

    const { applicantAuthHeaders } = await import("./applicant-auth-headers");
    const result = await applicantAuthHeaders({ "Content-Type": "application/json" });

    expect(result.applicantId).toBe("draft-preview");
    expect(setScopedApplicantId).toHaveBeenCalledWith("draft-preview");
    expect(getSession).not.toHaveBeenCalled();
    expect(result.headers.Authorization).toBeUndefined();
  });

  it("uses the live applicant session outside preview", async () => {
    window.history.replaceState({}, "", "/application/profile-review?tenant=zippycorp");
    getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "live-token",
          user: { id: "real-applicant-auth-user" },
        },
      },
    });

    const { applicantAuthHeaders } = await import("./applicant-auth-headers");
    const result = await applicantAuthHeaders();

    expect(result.applicantId).toBe("real-applicant-auth-user");
    expect(setScopedApplicantId).toHaveBeenCalledWith("real-applicant-auth-user");
    expect(result.headers.Authorization).toBe("Bearer live-token");
  });
});
