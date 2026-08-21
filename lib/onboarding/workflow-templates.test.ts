import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SerializableWorkflowState } from "@/lib/onboarding/workflow-builder-serialization";
import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";

const replaceFlowStepsFromDraft = vi.fn(
  async (_supabase: unknown, _flowId: string, _draft: unknown) => undefined
);

vi.mock("@/lib/onboarding/flow-steps-sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/onboarding/flow-steps-sync")>();
  return {
    ...actual,
    replaceFlowStepsFromDraft: (supabase: unknown, flowId: string, draft: unknown) =>
      replaceFlowStepsFromDraft(supabase, flowId, draft),
    loadTemplateBuilderDraft: vi.fn(async (_client: unknown, _id: string, draft: unknown) => draft),
  };
});

import {
  applyPublishedTemplateToEmploymentFlow,
  createWorkflowTemplate,
  getWorkflowTemplateById,
  inferEmploymentTypeFromName,
  listWorkflowTemplates,
  publishWorkflowTemplate,
  tenantTemplateDisplayName,
  updateWorkflowTemplate,
} from "@/lib/onboarding/workflow-templates";

const PRESET_ID = "2933a9a3-8c8f-4012-aafd-c2270262b617";
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const FLOW_1099_ID = "flow-1099";

const sampleDraft = {
  nodes: [
    {
      id: "n1",
      stepId: "parameterized-job-application",
      label: "Parameterized Job Application",
      description: "",
      position: { x: 0, y: 0 },
      day: 1,
      required: true,
      settings: { phase: "pre_hire" },
    },
    {
      id: "n2",
      stepId: "w9-tax-form",
      label: "W-9 Tax Form",
      description: "",
      position: { x: 0, y: 140 },
      day: 1,
      required: true,
      settings: { phase: "post_hire" },
    },
  ],
  edges: [{ id: "e1", source: "n1", target: "n2" }],
} as unknown as SerializableWorkflowState;

const presetDraft = {
  nodes: [
    {
      id: "preset-n1",
      stepId: "offer-acceptance",
      label: "Offer Acceptance",
      description: "",
      position: { x: 0, y: 0 },
      day: 1,
      required: true,
      settings: { phase: "pre_hire" },
    },
  ],
  edges: [],
} as unknown as SerializableWorkflowState;

type TemplateRow = {
  id: string;
  tenant_id: string | null;
  name: string;
  description: string | null;
  type: "preset" | "saved";
  status: string;
  employment_type: "W2" | "1099" | "RNR" | "Contract" | null;
  template_type: string | null;
  is_system_preset: boolean;
  is_editable: boolean;
  version: number;
  builder_draft: SerializableWorkflowState;
  flow_name: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type FlowRow = {
  id: string;
  tenant_id: string;
  name: string;
  employment_type: string | null;
  status: string;
  template_id: string | null;
  builder_draft: SerializableWorkflowState;
  updated_by?: string | null;
};

function nowIso() {
  return "2026-08-14T00:00:00.000Z";
}

function createDb() {
  const templates: TemplateRow[] = [
    {
      id: PRESET_ID,
      tenant_id: null,
      name: "Default 1099 Contractor Workflow",
      description: null,
      type: "preset",
      status: "published",
      employment_type: "1099",
      template_type: "default",
      is_system_preset: true,
      is_editable: false,
      version: 1,
      builder_draft: presetDraft,
      flow_name: "Default 1099 Contractor Workflow",
      created_by: null,
      updated_by: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
  ];
  const steps: Array<{ template_id: string; title: string; position: number }> = [];
  const flows: FlowRow[] = [
    {
      id: FLOW_1099_ID,
      tenant_id: TENANT_A,
      name: "1099 Contractor Workflow",
      employment_type: "1099",
      status: "published",
      template_id: PRESET_ID,
      builder_draft: presetDraft,
    },
  ];
  let seq = 0;

  function matches(row: Record<string, unknown>, filters: Record<string, unknown>) {
    return Object.entries(filters).every(([key, value]) => row[key] === value);
  }

  const from = vi.fn((table: string) => {
    if (table === "onboarding_templates") {
      const filters: Record<string, unknown> = {};
      const api: Record<string, unknown> = {};
      api.select = vi.fn(() => api);
      api.eq = vi.fn((col: string, value: unknown) => {
        filters[col] = value;
        return api;
      });
      api.order = vi.fn(() => api);
      api.maybeSingle = vi.fn(async () => {
        const row = templates.find((t) => matches(t as unknown as Record<string, unknown>, filters));
        return { data: row ? { ...row } : null, error: null };
      });
      api.single = vi.fn(async () => {
        const row = templates.find((t) => matches(t as unknown as Record<string, unknown>, filters));
        return { data: row ? { ...row } : null, error: row ? null : { message: "not found" } };
      });
      api.then = (
        resolve: (value: { data: TemplateRow[]; error: null }) => unknown
      ) =>
        resolve({
          data: templates.filter((t) => matches(t as unknown as Record<string, unknown>, filters)),
          error: null,
        });
      api.insert = vi.fn((payload: Record<string, unknown>) => {
        const row: TemplateRow = {
          id: `tpl-${++seq}`,
          tenant_id: (payload.tenant_id as string | null) ?? null,
          name: String(payload.name),
          description: (payload.description as string | null) ?? null,
          type: payload.type as "preset" | "saved",
          status: String(payload.status ?? "draft"),
          employment_type: (payload.employment_type as TemplateRow["employment_type"]) ?? null,
          template_type: (payload.template_type as string | null) ?? null,
          is_system_preset: Boolean(payload.is_system_preset),
          is_editable: payload.is_editable !== false,
          version: Number(payload.version) || 1,
          builder_draft: payload.builder_draft as SerializableWorkflowState,
          flow_name: (payload.flow_name as string | null) ?? null,
          created_by: (payload.created_by as string | null) ?? null,
          updated_by: (payload.updated_by as string | null) ?? null,
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        templates.push(row);
        const insertApi = {
          select: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { ...row }, error: null })),
          })),
        };
        return insertApi;
      });
      api.update = vi.fn((patch: Record<string, unknown>) => {
        const updateApi: Record<string, unknown> = {};
        const updateFilters: Record<string, unknown> = {};
        updateApi.eq = vi.fn((col: string, value: unknown) => {
          updateFilters[col] = value;
          return updateApi;
        });
        updateApi.select = vi.fn(() => updateApi);
        updateApi.single = vi.fn(async () => {
          const row = templates.find((t) =>
            matches(t as unknown as Record<string, unknown>, updateFilters)
          );
          if (!row) return { data: null, error: { message: "not found" } };
          Object.assign(row, patch, { updated_at: nowIso() });
          return { data: { ...row }, error: null };
        });
        return updateApi;
      });
      return api;
    }

    if (table === "onboarding_template_steps") {
      return {
        delete: vi.fn(() => ({
          eq: vi.fn(async (col: string, value: string) => {
            if (col === "template_id") {
              for (let i = steps.length - 1; i >= 0; i -= 1) {
                if (steps[i].template_id === value) steps.splice(i, 1);
              }
            }
            return { error: null };
          }),
        })),
        insert: vi.fn(async (rows: Array<{ template_id: string; title: string; position: number }>) => {
          steps.push(...rows.map((row) => ({ ...row })));
          return { error: null };
        }),
      };
    }

    if (table === "onboarding_flows") {
      const filters: Record<string, unknown> = {};
      const api: Record<string, unknown> = {};
      api.select = vi.fn(() => api);
      api.eq = vi.fn((col: string, value: unknown) => {
        filters[col] = value;
        return api;
      });
      api.then = (
        resolve: (value: { data: FlowRow[]; error: null }) => unknown
      ) =>
        resolve({
          data: flows.filter((f) => matches(f as unknown as Record<string, unknown>, filters)),
          error: null,
        });
      api.update = vi.fn((patch: Record<string, unknown>) => {
        const updateApi: Record<string, unknown> = {};
        const updateFilters: Record<string, unknown> = {};
        updateApi.eq = vi.fn((col: string, value: unknown) => {
          updateFilters[col] = value;
          return updateApi;
        });
        updateApi.select = vi.fn(() => updateApi);
        updateApi.single = vi.fn(async () => {
          const row = flows.find((f) =>
            matches(f as unknown as Record<string, unknown>, updateFilters)
          );
          if (!row) return { data: null, error: { message: "not found" } };
          Object.assign(row, patch);
          return { data: { id: row.id }, error: null };
        });
        return updateApi;
      });
      return api;
    }

    throw new Error(`unexpected table ${table}`);
  });

  return {
    from,
    templates,
    steps,
    flows,
    client: { from } as unknown as OnboardingDbClient,
  };
}

describe("inferEmploymentTypeFromName", () => {
  it("detects 1099, W2, and RNR names", () => {
    expect(inferEmploymentTypeFromName("Default 1099 Contractor Workflow")).toBe("1099");
    expect(inferEmploymentTypeFromName("Default W2 Employee Workflow")).toBe("W2");
    expect(inferEmploymentTypeFromName("Default RNR Worker Workflow")).toBe("RNR");
    expect(inferEmploymentTypeFromName("Default R&R Workflow")).toBe("RNR");
  });
});

describe("tenantTemplateDisplayName", () => {
  it("strips Default prefix and .tpl suffix from presets", () => {
    expect(tenantTemplateDisplayName("Default 1099 Contractor Workflow")).toBe(
      "1099 Contractor Workflow"
    );
    expect(tenantTemplateDisplayName("W2 Employee Workflow.tpl")).toBe("W2 Employee Workflow");
  });
});

describe("createWorkflowTemplate", () => {
  let db: ReturnType<typeof createDb>;

  beforeEach(() => {
    db = createDb();
    replaceFlowStepsFromDraft.mockClear();
  });

  it("creates a tenant-owned saved template even when folder is presets", async () => {
    const created = await createWorkflowTemplate(db.client, TENANT_A, {
      name: "Default 1099 Contractor Workflow",
      folder: "presets",
      builderDraft: sampleDraft,
      flowName: "Default 1099 Contractor Workflow",
      createdBy: "admin-a",
    });

    expect(created.id).not.toBe(PRESET_ID);
    expect(created.folder).toBe("saved-templates");
    expect(created.isPreset).toBe(false);
    expect(created.status).toBe("draft");
    expect(created.employmentType).toBe("1099");
    expect(created.name).toBe("1099 Contractor Workflow.tpl");

    const row = db.templates.find((t) => t.id === created.id);
    expect(row?.tenant_id).toBe(TENANT_A);
    expect(row?.type).toBe("saved");
    expect(row?.is_system_preset).toBe(false);
    expect(row?.builder_draft.nodes.map((n) => n.stepId)).toEqual([
      "parameterized-job-application",
      "w9-tax-form",
    ]);
    expect(db.steps.filter((s) => s.template_id === created.id)).toHaveLength(2);

    const preset = db.templates.find((t) => t.id === PRESET_ID);
    expect(preset?.builder_draft).toEqual(presetDraft);
    expect(preset?.type).toBe("preset");
  });

  it("refuses to create a system preset from the builder", async () => {
    await expect(
      createWorkflowTemplate(db.client, TENANT_A, {
        name: "Hacked preset",
        builderDraft: sampleDraft,
        createdBy: "admin-a",
        isPreset: true,
      })
    ).rejects.toThrow(/system presets/i);
    expect(db.templates.filter((t) => t.type === "preset")).toHaveLength(1);
  });

  it("infers RNR employment type when copying the RNR preset", async () => {
    const created = await createWorkflowTemplate(db.client, TENANT_A, {
      name: "Default RNR Worker Workflow",
      folder: "presets",
      builderDraft: sampleDraft,
      createdBy: "admin-a",
    });

    expect(created.employmentType).toBe("RNR");
    expect(created.name).toBe("RNR Worker Workflow.tpl");
  });
});

describe("listWorkflowTemplates", () => {
  it("includes published and draft tenant templates without replacing presets", async () => {
    const db = createDb();
    const draft = await createWorkflowTemplate(db.client, TENANT_A, {
      name: "1099 Contractor Workflow",
      folder: "saved-templates",
      builderDraft: sampleDraft,
      createdBy: "admin-a",
    });
    await publishWorkflowTemplate(db.client, TENANT_A, draft.id, {
      builderDraft: sampleDraft,
      updatedBy: "admin-a",
    });

    const lists = await listWorkflowTemplates(db.client, TENANT_A);
    expect(lists.presets.map((p) => p.id)).toEqual([PRESET_ID]);
    expect(lists.savedTemplates.map((t) => t.id)).toEqual([draft.id]);
    expect(lists.savedTemplates[0]?.status).toBe("published");
  });

  it("does not list another tenant's saved templates", async () => {
    const db = createDb();
    await createWorkflowTemplate(db.client, TENANT_A, {
      name: "Tenant A 1099",
      builderDraft: sampleDraft,
      createdBy: "admin-a",
    });
    const lists = await listWorkflowTemplates(db.client, TENANT_B);
    expect(lists.savedTemplates).toEqual([]);
    expect(lists.presets.map((p) => p.id)).toEqual([PRESET_ID]);
  });
});

describe("update and publish", () => {
  it("cannot modify the system preset", async () => {
    const db = createDb();
    await expect(
      updateWorkflowTemplate(db.client, TENANT_A, PRESET_ID, {
        builderDraft: sampleDraft,
        updatedBy: "admin-a",
      })
    ).rejects.toThrow(/system preset/i);
    expect(db.templates.find((t) => t.id === PRESET_ID)?.builder_draft).toEqual(presetDraft);
  });

  it("hides another tenant's template", async () => {
    const db = createDb();
    const created = await createWorkflowTemplate(db.client, TENANT_A, {
      name: "Tenant A 1099",
      builderDraft: sampleDraft,
      createdBy: "admin-a",
    });
    await expect(getWorkflowTemplateById(db.client, TENANT_B, created.id)).resolves.toBeNull();
  });

  it("persists publish status, graph, and remaps the employment-type flow", async () => {
    const db = createDb();
    const created = await createWorkflowTemplate(db.client, TENANT_A, {
      name: "Default 1099 Contractor Workflow",
      folder: "presets",
      builderDraft: sampleDraft,
      createdBy: "admin-a",
    });

    const published = await publishWorkflowTemplate(db.client, TENANT_A, created.id, {
      builderDraft: sampleDraft,
      updatedBy: "admin-a",
    });

    expect(published.template.status).toBe("published");
    expect(published.appliedFlowId).toBe(FLOW_1099_ID);
    expect(db.templates.find((t) => t.id === created.id)?.status).toBe("published");
    expect(db.templates.find((t) => t.id === PRESET_ID)?.builder_draft).toEqual(presetDraft);

    const flow = db.flows.find((f) => f.id === FLOW_1099_ID);
    expect(flow?.template_id).toBe(created.id);
    expect(flow?.status).toBe("published");
    expect(flow?.builder_draft.nodes.map((n) => n.label)).toEqual([
      "Parameterized Job Application",
      "W-9 Tax Form",
    ]);
    expect(replaceFlowStepsFromDraft).toHaveBeenCalled();
  });

  it("does not report a successful mapping update when no flow row is affected", async () => {
    const db = createDb();
    db.flows.splice(0, db.flows.length);
    const applied = await applyPublishedTemplateToEmploymentFlow(db.client, TENANT_A, {
      templateId: "missing",
      employmentType: "1099",
      builderDraft: sampleDraft,
      updatedBy: "admin-a",
    });
    expect(applied).toBeNull();
  });
});
