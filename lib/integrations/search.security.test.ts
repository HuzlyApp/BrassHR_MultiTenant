import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { searchInboundJob } from "./jobs";
import { searchInboundApplicant } from "./applicants";
vi.mock("@/lib/jobs/service", () => ({}));
vi.mock("@/lib/jobs/admin-add-candidate-from-resume", () => ({}));
vi.mock("@/lib/jobs/ensure-admin-candidate-worker", () => ({}));
vi.mock("@/lib/interviews/ensure-applicant", () => ({}));
vi.mock("@/lib/onboarding/sync-worker-primary-resume-path", () => ({}));

// Evaluate query predicates against records owned by another tenant, including fallback searches.
function foreignTenantDatabase() {
  const queries: Array<Array<[string, unknown]>> = [];
  const foreign = { id: "foreign-id", tenant_id: "tenant-b", external_req_id: "external", external_requisition_id: "external", public_title: "Nurse", title: "Nurse", normalized_email: "person@example.com", phone: "+1234", worker_id: "foreign-id" };
  const from = vi.fn(() => {
    const filters: Array<[string, unknown]> = [];
    queries.push(filters);
    const matches = () => filters.every(([column, value]) => foreign[column as keyof typeof foreign] === value);
    const query = {
      select: vi.fn(), eq: vi.fn((column: string, value: unknown) => { filters.push([column, value]); return query; }),
      not: vi.fn(), limit: vi.fn(), order: vi.fn(),
      maybeSingle: async () => ({ data: matches() ? foreign : null, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: matches() ? [foreign] : [], error: null }).then(resolve),
    };
    for (const method of [query.select, query.not, query.limit, query.order]) method.mockReturnValue(query);
    return query;
  });
  return { client: { from } as unknown as SupabaseClient, queries };
}
describe("inbound search tenant isolation", () => {
  it.each(["id=foreign-id", "external_req_id=external", "title=Nurse"])("does not return another tenant's job for %s", async (params) => {
    const db = foreignTenantDatabase();
    expect(await searchInboundJob(db.client, "tenant-a", new URLSearchParams(params))).toBeNull();
    expect(db.queries.length).toBeGreaterThan(0);
    for (const filters of db.queries) expect(filters).toContainEqual(["tenant_id", "tenant-a"]);
  });
  it.each(["email=person%40example.com", "phone=%2B1234"])("does not return another tenant's applicant for %s", async (params) => {
    const db = foreignTenantDatabase();
    expect(await searchInboundApplicant(db.client, "tenant-a", new URLSearchParams(params))).toBeNull();
    for (const filters of db.queries) expect(filters).toContainEqual(["tenant_id", "tenant-a"]);
  });
});
