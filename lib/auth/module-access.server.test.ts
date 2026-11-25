import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { authorizeStaffHttpAccess } from "./module-access.server";

const state = vi.hoisted(() => ({
  active: true, edit: true, resourceRead: false,
  profile: null as Promise<unknown> | null,
  filters: [] as Array<[string, string, unknown]>,
}));
const tenantId = "11111111-1111-4111-8111-111111111111";
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({
  from(table: string) {
    let columns = "";
    const execute = () => {
      if (table === "users" && columns === "god_admin") return { data: { god_admin: false }, error: null };
      if (table === "users") return state.profile ?? { data: { tenant_id: tenantId, role: "admin", is_active: state.active }, error: null };
      if (table === "permission_resources") {
        state.resourceRead = true;
        return { data: [{ key: "hiring", page_prefixes: [], api_prefixes: ["/api/admin/jobs"], always_granted: false }], error: null };
      }
      if (table === "staff_roles") return { data: [{ key: "admin", storage_key: "admin", aliases: [] }], error: null };
      if (table === "tenant_roles") return { data: [{ role_key: "admin" }], error: null };
      if (table === "user_roles") return { data: { role: "admin", is_active: true }, error: null };
      if (table === "tenant_role_permissions") return { data: { can_view: true, can_edit: state.edit, can_delete: false }, error: null };
      throw new Error(`Unexpected table ${table}`);
    };
    const query = {
      select(value: string) { columns = value; return query; },
      eq(key: string, value: unknown) { state.filters.push([table, key, value]); return query; },
      order() { return query; },
      maybeSingle: async () => execute(),
      then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) { return Promise.resolve(execute()).then(resolve, reject); },
    };
    return query;
  },
}) }));
const input = { user: { id: "staff-a", app_metadata: {}, user_metadata: {} } as User, pathname: "/api/admin/jobs", method: "POST" };

beforeEach(() => { state.active = true; state.edit = true; state.resourceRead = false; state.profile = null; state.filters = []; });

describe("fresh staff authorization reads", () => {
  it("loads resources while the independent profile read is pending", async () => {
    let release!: (value: unknown) => void;
    state.profile = new Promise(resolve => { release = resolve; });
    const pending = authorizeStaffHttpAccess(input);
    await vi.waitFor(() => expect(state.resourceRead).toBe(true));
    release({ data: { tenant_id: tenantId, role: "admin", is_active: true }, error: null });
    expect(await pending).toEqual({ ok: true });
    expect(state.filters).toContainEqual(["tenant_role_permissions", "tenant_id", tenantId]);
    expect(state.filters).toContainEqual(["user_roles", "user_id", "staff-a"]);
  });
  it("observes permission revocation on the next request", async () => {
    expect(await authorizeStaffHttpAccess(input)).toEqual({ ok: true });
    state.edit = false;
    expect(await authorizeStaffHttpAccess(input)).toMatchObject({ ok: false, status: 403 });
  });
  it("still rejects disabled profiles", async () => {
    state.active = false;
    expect(await authorizeStaffHttpAccess(input)).toMatchObject({ ok: false, status: 403 });
  });
});
