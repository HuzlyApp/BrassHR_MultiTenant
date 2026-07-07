import { describe, expect, it, vi } from "vitest";
import { resolveApplicantSigningProfile } from "@/lib/onboarding/resolve-applicant-signing-profile";

describe("resolveApplicantSigningProfile", () => {
  it("returns worker email when present on the tenant worker row", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                first_name: "Jane",
                last_name: "Doe",
                email: "jane@example.com",
              },
              error: null,
            }),
          }),
        }),
        update: vi.fn(() => ({
          eq: vi.fn(async () => ({ error: null })),
        })),
      })),
      auth: {
        admin: {
          getUserById: vi.fn(),
        },
      },
    };

    const profile = await resolveApplicantSigningProfile(
      supabase as never,
      "worker-1",
      "auth-user-1"
    );

    expect(profile).toEqual({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
    });
    expect(supabase.auth.admin.getUserById).not.toHaveBeenCalled();
  });

  it("falls back to Supabase Auth email and backfills worker row", async () => {
    const updateEq = vi.fn(async () => ({ error: null }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "worker_resumes") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table !== "worker") throw new Error(`unexpected table ${table}`);
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { first_name: "Jane", last_name: "Doe", email: null },
                error: null,
              }),
            }),
          }),
          update: vi.fn(() => ({ eq: updateEq })),
        };
      }),
      auth: {
        admin: {
          getUserById: vi.fn(async () => ({
            data: { user: { email: "zipstaffcom@gmail.com" } },
            error: null,
          })),
        },
      },
    };

    const profile = await resolveApplicantSigningProfile(
      supabase as never,
      "worker-zip",
      "auth-user-1"
    );

    expect(profile?.email).toBe("zipstaffcom@gmail.com");
    expect(supabase.auth.admin.getUserById).toHaveBeenCalledWith("auth-user-1");
    expect(updateEq).toHaveBeenCalledWith("id", "worker-zip");
  });

  it("rejects placeholder auth emails", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "worker_resumes") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { first_name: "Jane", last_name: "Doe", email: null },
                error: null,
              }),
            }),
          }),
        };
      }),
      auth: {
        admin: {
          getUserById: vi.fn(async () => ({
            data: { user: { email: "applicant+e876124e@placeholder.local" } },
            error: null,
          })),
        },
      },
    };

    const profile = await resolveApplicantSigningProfile(
      supabase as never,
      "worker-1",
      "auth-user-1"
    );

    expect(profile).toBeNull();
  });

  it("falls back to resume parsed email when worker email is missing", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "worker_resumes") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: {
                        parsed_data: { email: "resume@example.com" },
                        extracted_text: null,
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { first_name: "Jane", last_name: "Doe", email: null },
                error: null,
              }),
            }),
          }),
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        };
      }),
      auth: {
        admin: {
          getUserById: vi.fn(),
        },
      },
    };

    const profile = await resolveApplicantSigningProfile(
      supabase as never,
      "worker-1",
      "auth-user-1"
    );

    expect(profile?.email).toBe("resume@example.com");
  });
});
