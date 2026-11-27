import { describe, expect, it, vi } from "vitest";
import { checkApplicationSessionOwnership } from "./verify-application-session";
import type { SupabaseClient } from "@supabase/supabase-js";
describe("public job links are not applicant credentials", () => {
  it("does not offer claims even when the owner is anonymous and the public job token matches", async () => {
    const rows = { job_applications: { id: "app", tenant_id: "tenant", worker_id: "worker", job_requisition_id: "job", applicant_auth_user_id: "victim", status: "new" }, worker: { id: "worker", user_id: "victim", email: "test@example.test", tenant_id: "tenant" }, job_requisitions: { id: "job", public_job_token: "public-token" } };
    const update = vi.fn();
    const svc = { from: (table: keyof typeof rows) => { const q = { select: () => q, eq: () => q, update, maybeSingle: async () => ({ data: rows[table], error: null }) }; return q; }, auth: { admin: { getUserById: async () => ({ data: { user: { is_anonymous: true } }, error: null }) } } } as unknown as SupabaseClient;
    const check = await checkApplicationSessionOwnership(svc, { applicationId: "app", authUserId: "attacker", tenantId: "tenant", jobToken: "public-token" });
    expect(check).toMatchObject({ owned: false, canClaimWithJobToken: false });
    expect(update).not.toHaveBeenCalled();
  });
});
