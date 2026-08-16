import { describe, expect, it, vi } from "vitest";
import { resolveWorkflowMatch } from "@/lib/workflow-mappings/service";

function createSupabaseMock(rows: unknown[]) {
  const maybeSingle = vi.fn(async () => ({ data: rows[0] ?? null, error: null }));
  const eq = vi.fn(() => ({ eq, maybeSingle, then: undefined }));
  // Chainable builder that resolves via awaiting the final query object.
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.maybeSingle = maybeSingle;
  // When awaited directly (without maybeSingle), return all rows.
  builder.then = (resolve: (value: unknown) => unknown) =>
    resolve({ data: rows, error: null });

  return {
    from: vi.fn(() => builder),
  };
}

describe("resolveWorkflowMatch", () => {
  it("returns the most specific active published workflow", async () => {
    const supabase = createSupabaseMock([
      {
        id: "mapping-default",
        workflow_id: "workflow-default",
        priority: 1000,
        created_at: "2026-01-01T00:00:00.000Z",
        employment_type: "W2",
        profession_id: null,
        specialty_id: null,
        location: null,
        location_type: null,
        years_of_experience: null,
        onboarding_flows: {
          id: "workflow-default",
          name: "Default W2 Employee Workflow",
          status: "published",
          tenant_id: "tenant-1",
        },
      },
      {
        id: "mapping-icu",
        workflow_id: "workflow-icu",
        priority: 100,
        created_at: "2026-01-02T00:00:00.000Z",
        employment_type: "W2",
        profession_id: "prof-1",
        specialty_id: "spec-1",
        location: null,
        location_type: "On-site",
        years_of_experience: null,
        onboarding_flows: {
          id: "workflow-icu",
          name: "ICU Nurse Employee Workflow",
          status: "published",
          tenant_id: "tenant-1",
        },
      },
    ]);

    const result = await resolveWorkflowMatch(supabase as never, "tenant-1", {
      professionId: "prof-1",
      specialtyId: "spec-1",
      employmentType: "W2",
      locationType: "On-site",
      jobLocationType: "On-site",
    });

    expect(result).toMatchObject({
      mappingId: "mapping-icu",
      workflowId: "workflow-icu",
      workflowName: "ICU Nurse Employee Workflow",
      source: "mapping",
      specificity: 4,
    });
  });

  it("returns null when no active mapping exists", async () => {
    const supabase = createSupabaseMock([]);
    const result = await resolveWorkflowMatch(supabase as never, "tenant-1", {
      professionId: "prof-1",
      employmentType: "1099",
    });
    expect(result).toBeNull();
  });
});
