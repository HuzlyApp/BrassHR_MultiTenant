import { describe, expect, it, vi } from "vitest";
import { resolveWorkflowMatch } from "@/lib/workflow-mappings/service";

function createSupabaseMock(rows: unknown[]) {
  const maybeSingle = vi.fn(async () => ({ data: rows[0] ?? null, error: null }));
  const limit = vi.fn(() => ({ maybeSingle }));
  const order = vi.fn(() => ({ order, limit }));
  const eq = vi.fn(() => ({ eq, order }));
  const select = vi.fn(() => ({ eq }));
  return {
    from: vi.fn(() => ({ select })),
    _maybeSingle: maybeSingle,
  };
}

describe("resolveWorkflowMatch", () => {
  it("returns the highest-priority active published workflow for exact criteria", async () => {
    const supabase = createSupabaseMock([
      {
        id: "mapping-1",
        workflow_id: "workflow-1",
        onboarding_flows: { id: "workflow-1", name: "RN W2 Standard Workflow", status: "published", tenant_id: "tenant-1" },
      },
    ]);

    const result = await resolveWorkflowMatch(supabase as never, "tenant-1", {
      professionId: "prof-1",
      employmentType: "W2",
    });

    expect(result).toEqual({
      mappingId: "mapping-1",
      workflowId: "workflow-1",
      workflowName: "RN W2 Standard Workflow",
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
