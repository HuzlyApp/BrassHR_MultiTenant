import { beforeEach, describe, expect, it, vi } from "vitest";

const workflowTemplateDraft = vi.fn();
const replaceFlowStepsFromDraft = vi.fn();

vi.mock("@/lib/onboarding/workflow-templates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/onboarding/workflow-templates")>();
  return {
    ...actual,
    workflowTemplateDraft: (...args: unknown[]) => workflowTemplateDraft(...args),
  };
});

vi.mock("@/lib/onboarding/flow-steps-sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/onboarding/flow-steps-sync")>();
  return {
    ...actual,
    replaceFlowStepsFromDraft: (...args: unknown[]) => replaceFlowStepsFromDraft(...args),
  };
});

import {
  DEFAULT_1099_FLOW_NAME,
  DEFAULT_1099_PRESET_NAME,
  DEFAULT_W2_FLOW_NAME,
  DEFAULT_W2_PRESET_NAME,
  ensureDefaultTenantOnboardingFlows,
} from "@/lib/onboarding/onboarding-flows";

type InsertCall = { table: string; payload: Record<string, unknown> };

function createEmptyLibrarySupabase(options?: {
  existingFlowCount?: number;
  presets?: Record<string, { id: string; name: string; employment_type: string }>;
}) {
  const existingFlowCount = options?.existingFlowCount ?? 0;
  const presets = options?.presets ?? {
    [DEFAULT_W2_PRESET_NAME]: {
      id: "preset-w2",
      name: DEFAULT_W2_PRESET_NAME,
      employment_type: "W2",
    },
    [DEFAULT_1099_PRESET_NAME]: {
      id: "preset-1099",
      name: DEFAULT_1099_PRESET_NAME,
      employment_type: "1099",
    },
  };
  const inserts: InsertCall[] = [];
  let flowInsertSeq = 0;

  const from = vi.fn((table: string) => {
    if (table === "onboarding_flows") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => ({ count: existingFlowCount, error: null })),
          })),
        })),
        insert: vi.fn((payload: Record<string, unknown>) => {
          inserts.push({ table, payload });
          flowInsertSeq += 1;
          const id = `flow-${flowInsertSeq}`;
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { id }, error: null })),
            })),
          };
        }),
      };
    }

    if (table === "onboarding_templates") {
      const filters: Record<string, string> = {};
      const api = {
        select: vi.fn(() => api),
        eq: vi.fn((col: string, value: string) => {
          filters[col] = value;
          return api;
        }),
        maybeSingle: vi.fn(async () => {
          const name = filters.name;
          const row = name ? presets[name] : null;
          if (!row) return { data: null, error: null };
          return {
            data: {
              ...row,
              tenant_id: null,
              type: "preset",
              status: "published",
              builder_draft: { nodes: [{ id: "n1", data: { label: row.name } }], edges: [] },
              description: null,
              template_type: "default",
              is_system_preset: true,
              is_editable: false,
              version: 1,
              flow_name: row.name,
              created_by: null,
              updated_by: null,
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
            error: null,
          };
        }),
      };
      return api;
    }

    throw new Error(`Unexpected table ${table}`);
  });

  return { from, inserts };
}

describe("ensureDefaultTenantOnboardingFlows", () => {
  beforeEach(() => {
    workflowTemplateDraft.mockReset();
    replaceFlowStepsFromDraft.mockReset();
    workflowTemplateDraft.mockImplementation(async (_sb: unknown, row: { name: string }) => ({
      nodes: [{ id: `node-${row.name}`, data: { label: row.name } }],
      edges: [],
    }));
    replaceFlowStepsFromDraft.mockResolvedValue(undefined);
  });

  it("no-ops when the library already has flows", async () => {
    const supabase = createEmptyLibrarySupabase({ existingFlowCount: 2 });
    await ensureDefaultTenantOnboardingFlows(supabase as never, "tenant-1", "library-1");
    expect(supabase.inserts).toHaveLength(0);
    expect(workflowTemplateDraft).not.toHaveBeenCalled();
  });

  it("seeds published W2 and 1099 flows from system presets when empty", async () => {
    const supabase = createEmptyLibrarySupabase();
    await ensureDefaultTenantOnboardingFlows(supabase as never, "tenant-1", "library-1", "user-1");

    expect(supabase.inserts).toHaveLength(2);
    expect(supabase.inserts.map((row) => row.payload)).toEqual([
      expect.objectContaining({
        tenant_id: "tenant-1",
        library_id: "library-1",
        template_id: "preset-w2",
        name: DEFAULT_W2_FLOW_NAME,
        status: "published",
        employment_type: "W2",
        sort_order: 1,
        created_by: "user-1",
      }),
      expect.objectContaining({
        tenant_id: "tenant-1",
        library_id: "library-1",
        template_id: "preset-1099",
        name: DEFAULT_1099_FLOW_NAME,
        status: "published",
        employment_type: "1099",
        sort_order: 2,
        created_by: "user-1",
      }),
    ]);
    expect(replaceFlowStepsFromDraft).toHaveBeenCalledTimes(2);
  });

  it("throws when a required system preset is missing", async () => {
    const supabase = createEmptyLibrarySupabase({
      presets: {
        [DEFAULT_W2_PRESET_NAME]: {
          id: "preset-w2",
          name: DEFAULT_W2_PRESET_NAME,
          employment_type: "W2",
        },
      },
    });

    await expect(
      ensureDefaultTenantOnboardingFlows(supabase as never, "tenant-1", "library-1")
    ).rejects.toThrow(/Default 1099 Contractor Workflow/);
  });
});
