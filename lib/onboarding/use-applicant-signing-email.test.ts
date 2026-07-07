// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useApplicantSigningEmail } from "@/lib/onboarding/use-applicant-signing-email";

vi.mock("@/lib/supabase-browser", () => ({
  supabaseBrowser: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    },
  },
}));

describe("useApplicantSigningEmail", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("hydrates email from signing-profile API after refresh", async () => {
    localStorage.setItem(
      "parsedResume",
      JSON.stringify({ email: "stale@placeholder.local", first_name: "Stale" })
    );

    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          profile: {
            email: "saved@example.com",
            firstName: "Jane",
            lastName: "Doe",
          },
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    const { result } = renderHook(() =>
      useApplicantSigningEmail({ applicantId: "applicant-1", tenantSlug: "braas-hr" })
    );

    await waitFor(() => {
      expect(result.current.resolved).toBe(true);
    });

    expect(result.current.email).toBe("saved@example.com");
    expect(result.current.firstName).toBe("Jane");
    expect(result.current.lastName).toBe("Doe");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/onboarding/applicant-signing-profile"),
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("keeps missing-email state when API and local sources have no deliverable email", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: "A valid applicant email is required before signing.",
          code: "INVALID_APPLICANT_EMAIL",
        }),
        { status: 400 }
      )
    ) as typeof fetch;

    const { result } = renderHook(() =>
      useApplicantSigningEmail({ applicantId: "applicant-1" })
    );

    await waitFor(() => {
      expect(result.current.resolved).toBe(true);
    });

    expect(result.current.email).toBe("");
    expect(result.current.loading).toBe(false);
  });
});
