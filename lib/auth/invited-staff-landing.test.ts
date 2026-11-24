import { describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { resolveRecruiterOnboardingStatus } from "./recruiter-onboarding-status.server";
const mocks = vi.hoisted(() => ({ role: "hr" }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({ from: (table: string) => {
  const query = { select: () => query, eq: () => query,
    maybeSingle: async () => ({ data: { id: "invitee", tenant_id: "tenant-a", role: mocks.role, is_active: true, onboarding_completed: true }, error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === "user_roles" ? [{ tenant_id: "tenant-a", role: mocks.role, is_active: true }] : [], error: null }).then(resolve),
  }; return query;
} }) }));
vi.mock("@/lib/tenant/tenant-category", () => ({ getTenantCategory: async () => "SMB" }));
vi.mock("@/lib/auth/recruiter-dashboard-redirect", () => ({ fetchTenantVanityLabel: async () => null }));
describe("invited staff SMB landing", () => {
  it.each(["hr", "manager", "client"])("routes %s to staff home without promoting it to an owner", async role => {
    mocks.role = role;
    const result = await resolveRecruiterOnboardingStatus({ id: "invitee", app_metadata: {}, user_metadata: {} } as User);
    expect(result.redirectTarget).toBe("/admin_recruiter/home"); expect(result.role).toBe(role);
  });
  it("preserves the SMB admin Launch Pad landing", async () => {
    mocks.role = "admin";
    const result = await resolveRecruiterOnboardingStatus({ id: "invitee", app_metadata: {}, user_metadata: {} } as User);
    expect(result.redirectTarget).toBe("/admin_recruiter/launch-pad");
  });
});
