import { describe, expect, it } from "vitest";
import { findAuthUserIdByEmail } from "@/lib/auth/find-auth-user-by-email";

function query(data: unknown) {
  const q: Record<string, unknown> = {};
  q.select = () => q;
  q.ilike = () => q;
  q.not = () => q;
  q.then = (resolve: (value: { data: unknown; error: null }) => unknown) =>
    resolve({ data, error: null });
  return q;
}

function supabaseMock(params: {
  staffIds: string[];
  workerIds?: string[];
  authUsers: Record<string, { email?: string | null }>;
}) {
  return {
    from: (table: string) =>
      query(
        table === "users"
          ? params.staffIds.map((id) => ({ id }))
          : (params.workerIds ?? []).map((id) => ({ user_id: id }))
      ),
    auth: {
      admin: {
        getUserById: async (id: string) => {
          const user = params.authUsers[id];
          if (!user) return { data: { user: null }, error: { message: "not found" } };
          return { data: { user: { id, email: user.email } }, error: null };
        },
      },
    },
  };
}

describe("findAuthUserIdByEmail", () => {
  it("returns the auth user whose email matches, not another staff row", async () => {
    const svc = supabaseMock({
      staffIds: ["admin-1", "recruiter-1"],
      authUsers: {
        "admin-1": { email: "app@huzly.com" },
        "recruiter-1": { email: "clelipan@up.edu.ph" },
      },
    });

    const id = await findAuthUserIdByEmail(svc as never, "clelipan@up.edu.ph");
    expect(id).toBe("recruiter-1");
  });

  it("does not attach an invite to an account with a blank Auth email", async () => {
    const svc = supabaseMock({
      staffIds: ["admin-1"],
      authUsers: {
        "admin-1": { email: null },
      },
    });

    const id = await findAuthUserIdByEmail(svc as never, "clelipan@up.edu.ph");
    expect(id).toBeNull();
  });
});
