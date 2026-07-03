import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findPlatformOwnerEmailConflict,
  findStaffTenantEmailConflict,
  findWorkerTenantEmailConflict,
  isWorkerTenantEmailUniqueViolation,
  normalizeTenantEmail,
  TENANT_EMAIL_TAKEN_MESSAGE,
} from "@/lib/tenant/tenant-email-uniqueness";

const TENANT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const USER_A = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const WORKER_A = "dddddddd-dddd-dddd-dddd-dddddddddddd";

type WorkerRow = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  email: string | null;
};

type UserRow = {
  id: string;
  tenant_id: string | null;
  email: string | null;
  signup_completed_at: string | null;
};

function createWorkerSupabase(rows: WorkerRow[]) {
  return {
    from: (table: string) => {
      if (table !== "worker") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: (column: string, value: string) => {
            const filters: Record<string, string> = { [column]: value };
            const chain = {
              ilike: (col: string, pattern: string) => {
                filters[col] = pattern;
                return chain;
              },
              neq: (col: string, neqValue: string) => {
                filters[`neq:${col}`] = neqValue;
                return chain;
              },
              limit: () => chain,
              maybeSingle: async () => {
                const match = rows.find((row) => {
                  if (filters.tenant_id && row.tenant_id !== filters.tenant_id) return false;
                  if (filters.email && row.email?.toLowerCase() !== filters.email.toLowerCase()) {
                    return false;
                  }
                  if (filters["neq:user_id"] && row.user_id === filters["neq:user_id"]) {
                    return false;
                  }
                  if (filters["neq:id"] && row.id === filters["neq:id"]) return false;
                  return true;
                });
                return { data: match ?? null, error: null };
              },
            };
            return chain;
          },
        }),
      };
    },
  };
}

function createUsersSupabase(rows: UserRow[]) {
  const buildChain = (filters: Record<string, string>) => {
    const chain = {
      is: (col: string, isValue: null) => {
        filters[`is:${col}`] = String(isValue);
        return chain;
      },
      ilike: (col: string, pattern: string) => {
        filters[col] = pattern;
        return chain;
      },
      neq: (col: string, neqValue: string) => {
        filters[`neq:${col}`] = neqValue;
        return chain;
      },
      limit: () => chain,
      maybeSingle: async () => {
        const match = rows.find((row) => {
          if (filters.tenant_id && row.tenant_id !== filters.tenant_id) return false;
          if (filters["is:tenant_id"] === "null" && row.tenant_id !== null) return false;
          if (filters.email && row.email?.toLowerCase() !== filters.email.toLowerCase()) {
            return false;
          }
          if (filters["neq:id"] && row.id === filters["neq:id"]) return false;
          return true;
        });
        return { data: match ?? null, error: null };
      },
    };
    return chain;
  };

  return {
    from: (table: string) => {
      if (table !== "users") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: (column: string, value: string) => {
            const filters: Record<string, string> = { [column]: value };
            return buildChain(filters);
          },
          is: (column: string, value: null) => buildChain({ [`is:${column}`]: String(value) }),
        }),
      };
    },
  };
}

describe("normalizeTenantEmail", () => {
  it("lowercases and trims email", () => {
    expect(normalizeTenantEmail("  User@Example.COM ")).toBe("user@example.com");
  });
});

describe("findWorkerTenantEmailConflict", () => {
  it("blocks same email in the same tenant", async () => {
    const supabase = createWorkerSupabase([
      {
        id: WORKER_A,
        tenant_id: TENANT_A,
        user_id: USER_A,
        email: "user@example.com",
      },
    ]);

    const conflict = await findWorkerTenantEmailConflict(supabase as never, {
      tenantId: TENANT_A,
      email: "user@example.com",
      excludeUserId: "other-user",
    });

    expect(conflict).toEqual({ id: WORKER_A });
  });

  it("allows same email in a different tenant", async () => {
    const supabase = createWorkerSupabase([
      {
        id: WORKER_A,
        tenant_id: TENANT_A,
        user_id: USER_A,
        email: "user@example.com",
      },
    ]);

    const conflict = await findWorkerTenantEmailConflict(supabase as never, {
      tenantId: TENANT_B,
      email: "user@example.com",
      excludeUserId: "other-user",
    });

    expect(conflict).toBeNull();
  });

  it("blocks different casing for the same tenant", async () => {
    const supabase = createWorkerSupabase([
      {
        id: WORKER_A,
        tenant_id: TENANT_A,
        user_id: USER_A,
        email: "User@Example.COM",
      },
    ]);

    const conflict = await findWorkerTenantEmailConflict(supabase as never, {
      tenantId: TENANT_A,
      email: "user@example.com",
      excludeUserId: "other-user",
    });

    expect(conflict).toEqual({ id: WORKER_A });
  });

  it("allows different casing in a different tenant", async () => {
    const supabase = createWorkerSupabase([
      {
        id: WORKER_A,
        tenant_id: TENANT_A,
        user_id: USER_A,
        email: "User@Example.COM",
      },
    ]);

    const conflict = await findWorkerTenantEmailConflict(supabase as never, {
      tenantId: TENANT_B,
      email: "USER@example.com",
      excludeUserId: "other-user",
    });

    expect(conflict).toBeNull();
  });

  it("ignores the current applicant user id", async () => {
    const supabase = createWorkerSupabase([
      {
        id: WORKER_A,
        tenant_id: TENANT_A,
        user_id: USER_A,
        email: "user@example.com",
      },
    ]);

    const conflict = await findWorkerTenantEmailConflict(supabase as never, {
      tenantId: TENANT_A,
      email: "user@example.com",
      excludeUserId: USER_A,
    });

    expect(conflict).toBeNull();
  });
});

describe("findStaffTenantEmailConflict", () => {
  it("blocks duplicate staff email in the same tenant", async () => {
    const supabase = createUsersSupabase([
      {
        id: USER_A,
        tenant_id: TENANT_A,
        email: "admin@example.com",
        signup_completed_at: new Date().toISOString(),
      },
    ]);

    const conflict = await findStaffTenantEmailConflict(supabase as never, {
      tenantId: TENANT_A,
      email: "admin@example.com",
    });

    expect(conflict).toEqual({ id: USER_A });
  });

  it("allows the same staff email in another tenant", async () => {
    const supabase = createUsersSupabase([
      {
        id: USER_A,
        tenant_id: TENANT_A,
        email: "admin@example.com",
        signup_completed_at: new Date().toISOString(),
      },
    ]);

    const conflict = await findStaffTenantEmailConflict(supabase as never, {
      tenantId: TENANT_B,
      email: "admin@example.com",
    });

    expect(conflict).toBeNull();
  });
});

describe("findPlatformOwnerEmailConflict", () => {
  it("blocks completed platform owner signup for the same email", async () => {
    const supabase = createUsersSupabase([
      {
        id: USER_A,
        tenant_id: null,
        email: "owner@example.com",
        signup_completed_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const conflict = await findPlatformOwnerEmailConflict(supabase as never, "owner@example.com");
    expect(conflict?.id).toBe(USER_A);
  });

  it("does not block when email exists only on a tenant staff profile", async () => {
    const supabase = createUsersSupabase([
      {
        id: USER_A,
        tenant_id: TENANT_A,
        email: "owner@example.com",
        signup_completed_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const conflict = await findPlatformOwnerEmailConflict(supabase as never, "owner@example.com");
    expect(conflict).toBeNull();
  });
});

describe("isWorkerTenantEmailUniqueViolation", () => {
  it("detects tenant email unique index violations", () => {
    expect(
      isWorkerTenantEmailUniqueViolation({
        code: "23505",
        message: 'duplicate key value violates unique constraint "worker_tenant_email_lower_uidx"',
      })
    ).toBe(true);
  });

  it("does not treat user_id uniqueness as an email conflict", () => {
    expect(
      isWorkerTenantEmailUniqueViolation({
        code: "23505",
        message: 'duplicate key value violates unique constraint "worker_user_id_key"',
      })
    ).toBe(false);
  });
});

describe("TENANT_EMAIL_TAKEN_MESSAGE", () => {
  it("uses the required user-facing copy", () => {
    expect(TENANT_EMAIL_TAKEN_MESSAGE).toBe(
      "This email is already used in this organization."
    );
  });
});
