import { describe, expect, it, vi } from "vitest";
import { completeStaffPasswordSetup } from "@/lib/admin/complete-staff-password-setup";

vi.mock("@/lib/audit/activity-log", () => ({
  writeActivityLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/cache", () => ({
  invalidateUserCache: vi.fn(async () => undefined),
}));

describe("completeStaffPasswordSetup", () => {
  it("clears the recruiter password gate and accepts that user's pending invite", async () => {
    const userUpdates: Record<string, unknown>[] = [];
    const inviteUpdates: Record<string, unknown>[] = [];

    const supabase = {
      from: (table: string) => {
        const filters: Array<[string, unknown]> = [];
        const builder: Record<string, unknown> = {};
        const result = async () => {
          if (table === "users") {
            return {
              data: {
                id: "recruiter-1",
                tenant_id: "tenant-zipstaff",
                must_change_password: true,
                email: "clelipan@up.edu.ph",
              },
              error: null,
            };
          }
          if (table === "staff_invitations") {
            const byUser = filters.some((item) => item[0] === "invited_user_id" && item[1] === "recruiter-1");
            return {
              data: byUser
                ? [{ id: "invite-recruiter", tenant_id: "tenant-zipstaff", email: "clelipan@up.edu.ph" }]
                : [],
              error: null,
            };
          }
          return { data: null, error: null };
        };
        builder.select = () => builder;
        builder.eq = (column: string, value: unknown) => {
          filters.push([column, value]);
          return builder;
        };
        builder.ilike = (column: string, value: unknown) => {
          filters.push([column, value]);
          return builder;
        };
        builder.update = (payload: Record<string, unknown>) => {
          if (table === "users") userUpdates.push(payload);
          if (table === "staff_invitations") inviteUpdates.push(payload);
          return builder;
        };
        builder.in = () => builder;
        builder.maybeSingle = result;
        builder.then = (resolve: (value: unknown) => unknown) => result().then(resolve);
        return builder;
      },
    };

    await completeStaffPasswordSetup(supabase as never, {
      userId: "recruiter-1",
      email: "clelipan@up.edu.ph",
    });

    expect(userUpdates).toContainEqual({ must_change_password: false });
    expect(inviteUpdates.some((payload) => payload.status === "accepted")).toBe(true);
  });
});
