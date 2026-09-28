import { describe, expect, it, vi } from "vitest";
import { syncApplicantProfileFromWorkerField } from "./sync-applicant-profile-from-worker";

describe("syncApplicantProfileFromWorkerField", () => {
  it("mirrors first_name / last_name / phone / email onto applicant_profiles", async () => {
    const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "applicant_profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ id: "profile-1" }],
                  error: null,
                }),
              }),
            }),
            update: vi.fn((patch: Record<string, unknown>) => ({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockImplementation(async () => {
                  updates.push({ id: "profile-1", patch });
                  return { error: null };
                }),
              }),
            })),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    await syncApplicantProfileFromWorkerField({
      supabase: supabase as never,
      tenantId: "tenant-1",
      workerId: "worker-1",
      field: "first_name",
      dbValue: "Alex",
    });
    await syncApplicantProfileFromWorkerField({
      supabase: supabase as never,
      tenantId: "tenant-1",
      workerId: "worker-1",
      field: "last_name",
      dbValue: "Rivera",
    });
    await syncApplicantProfileFromWorkerField({
      supabase: supabase as never,
      tenantId: "tenant-1",
      workerId: "worker-1",
      field: "phone",
      dbValue: "5125550199",
    });
    await syncApplicantProfileFromWorkerField({
      supabase: supabase as never,
      tenantId: "tenant-1",
      workerId: "worker-1",
      field: "email",
      dbValue: "alex.rivera@example.com",
    });

    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          patch: expect.objectContaining({ first_name: "Alex" }),
        }),
        expect.objectContaining({
          patch: expect.objectContaining({ last_name: "Rivera" }),
        }),
        expect.objectContaining({
          patch: expect.objectContaining({ phone: "5125550199" }),
        }),
        expect.objectContaining({
          patch: expect.objectContaining({
            email: "alex.rivera@example.com",
            normalized_email: "alex.rivera@example.com",
          }),
        }),
      ])
    );
  });

  it("skips non-identity fields like job_role", async () => {
    const from = vi.fn();
    await syncApplicantProfileFromWorkerField({
      supabase: { from } as never,
      tenantId: "tenant-1",
      workerId: "worker-1",
      field: "job_role",
      dbValue: "Nurse",
    });
    expect(from).not.toHaveBeenCalled();
  });
});
