import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({ from: mocks.from }) }));
import { resolveAppRoleForUser } from "./resolve-role";

const user = { id: "auth-1", app_metadata: { role: "admin", tenant_id: "tenant-a" } } as unknown as User;
let active: boolean;
let membership: { role: string; is_active: boolean } | null;
describe("tenant portal role resolution", () => {
  beforeEach(() => {
    active = true; membership = { role: "candidate", is_active: true };
    mocks.from.mockImplementation((table: string) => {
      const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({
        data: table === "users" ? { role: "admin", tenant_id: "tenant-a", is_active: active } : membership,
        error: null,
      }) };
      return chain;
    });
  });
  it("uses membership in the requested tenant instead of another tenant's global role", async () => {
    expect(await resolveAppRoleForUser(user, "tenant-b")).toBe("candidate");
  });
  it("preserves the hired worker role for that tenant", async () => {
    membership = { role: "worker", is_active: true };
    expect(await resolveAppRoleForUser(user, "tenant-b")).toBe("worker");
  });
  it("rejects inactive profiles and absent or revoked memberships", async () => {
    active = false;
    expect(await resolveAppRoleForUser(user, "tenant-b")).toBe("revoked");
    active = true; membership = null;
    expect(await resolveAppRoleForUser(user, "tenant-b")).toBe("revoked");
    membership = { role: "candidate", is_active: false };
    expect(await resolveAppRoleForUser(user, "tenant-b")).toBe("revoked");
  });
  it("does not grant portal membership to anonymous onboarding identities", async () => {
    expect(await resolveAppRoleForUser({ ...user, is_anonymous: true }, "tenant-b")).toBe("revoked");
  });
});
