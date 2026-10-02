import { beforeEach, describe, expect, it, vi } from "vitest";

const invalidateAiPromptCaches = vi.fn(async () => undefined);
const writeActivityLog = vi.fn(async () => undefined);

vi.mock("@/lib/ai-catalog/cache", () => ({
  invalidateAiPromptCaches: (...args: unknown[]) => invalidateAiPromptCaches(...args),
}));

vi.mock("@/lib/audit/activity-log", () => ({
  writeActivityLog: (...args: unknown[]) => writeActivityLog(...args),
}));

type Row = Record<string, unknown>;

function createFakeSupabase(state: {
  templates: Row[];
  versions: Row[];
  features: Row[];
  variants: Row[];
  verticals: Row[];
}) {
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === "publish_ai_prompt_version") {
      const id = String(args.p_version_id);
      for (const version of state.versions) {
        if (version.template_id === state.versions.find((row) => row.id === id)?.template_id) {
          version.is_current = false;
        }
      }
      const target = state.versions.find((row) => row.id === id);
      if (!target) return { data: null, error: { message: "missing" } };
      target.status = "published";
      target.is_current = true;
      target.change_reason = args.p_change_reason;
      target.published_at = "2026-09-30T00:00:00.000Z";
      return { data: id, error: null };
    }
    return { data: null, error: { message: `unknown rpc ${name}` } };
  });

  return {
    rpc,
    from(table: string) {
      const filters: Array<(row: Row) => boolean> = [];
      let orderCol: string | null = null;
      let ascending = true;
      let limitCount: number | null = null;
      let insertPayload: Row | null = null;
      let updatePayload: Row | null = null;

      const builder = {
        select() {
          return builder;
        },
        insert(payload: Row) {
          insertPayload = { ...payload, id: `new-${state.versions.length + 1}` };
          return builder;
        },
        update(payload: Row) {
          updatePayload = payload;
          return builder;
        },
        eq(column: string, value: unknown) {
          filters.push((row) => row[column] === value);
          return builder;
        },
        is(column: string, value: unknown) {
          filters.push((row) => row[column] == value);
          return builder;
        },
        in(column: string, values: unknown[]) {
          filters.push((row) => values.includes(row[column]));
          return builder;
        },
        order(column: string, opts?: { ascending?: boolean }) {
          orderCol = column;
          ascending = opts?.ascending !== false;
          return builder;
        },
        limit(count: number) {
          limitCount = count;
          return builder;
        },
        maybeSingle: async () => {
          const rows = resolveRows();
          return { data: rows[0] ?? null, error: null };
        },
        single: async () => {
          if (insertPayload && table === "ai_prompt_version") {
            const row = {
              ...insertPayload,
              created_at: "2026-09-30T00:00:00.000Z",
              updated_at: "2026-09-30T00:00:00.000Z",
              published_at: null,
              is_current: false,
              content_hash: null,
            };
            state.versions.push(row);
            return { data: { id: row.id, version_number: row.version_number }, error: null };
          }
          const rows = resolveRows();
          return { data: rows[0] ?? null, error: rows[0] ? null : { message: "not found" } };
        },
        then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
          if (updatePayload) {
            for (const row of resolveRows(false)) {
              Object.assign(row, updatePayload);
            }
            return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
          }
          return Promise.resolve({ data: resolveRows(), error: null }).then(onFulfilled, onRejected);
        },
      };

      function resolveRows(applyLimit = true) {
        let rows: Row[] = [];
        if (table === "ai_feature") rows = state.features;
        else if (table === "ai_variant") rows = state.variants;
        else if (table === "ai_vertical") rows = state.verticals;
        else if (table === "ai_prompt_template") rows = state.templates;
        else if (table === "ai_prompt_version") rows = state.versions;
        else if (table === "users") rows = [];
        else if (table === "ai_current_prompt_version") {
          rows = state.versions
            .filter((row) => row.is_current && row.status === "published")
            .map((row) => {
              const template = state.templates.find((item) => item.id === row.template_id);
              return {
                ...row,
                feature_key: "candidate_match",
                variant_key: template?.variant_key,
                vertical_key: template?.vertical_key,
                tenant_id: null,
              };
            });
        }
        let filtered = rows.filter((row) => filters.every((fn) => fn(row)));
        if (orderCol) {
          filtered = [...filtered].sort((a, b) => {
            const av = Number(a[orderCol!]);
            const bv = Number(b[orderCol!]);
            return ascending ? av - bv : bv - av;
          });
        }
        if (applyLimit && limitCount != null) filtered = filtered.slice(0, limitCount);
        return filtered;
      }

      return builder;
    },
  };
}

describe("industry prompt service versioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an immutable published version and invalidates prompt caches", async () => {
    const state = {
      features: [{ id: "f1", key: "candidate_match" }],
      variants: [{ id: "va1", key: "quick" }],
      verticals: [{ id: "ve1", key: "technology" }],
      templates: [
        {
          id: "tpl-tech-quick",
          feature_id: "f1",
          variant_id: "va1",
          vertical_id: "ve1",
          tenant_id: null,
          variant_key: "quick",
          vertical_key: "technology",
        },
      ],
      versions: [
        {
          id: "v1",
          template_id: "tpl-tech-quick",
          version_number: 1,
          status: "published",
          is_current: true,
          system_prompt: "Old system prompt with enough characters for safety.",
          user_prompt_template: "{{candidate_resume}}",
          response_schema: {},
          model_config: {},
          created_by: "admin-0",
          published_by: "admin-0",
          source_version_id: null,
          change_reason: "Initial",
          created_at: "2026-09-01T00:00:00.000Z",
          updated_at: "2026-09-01T00:00:00.000Z",
          published_at: "2026-09-01T00:00:00.000Z",
          content_hash: "h1",
        },
      ],
    };
    const supabase = createFakeSupabase(state);
    const { saveIndustryPromptVersion } = await import("./industry-prompts-service");
    const result = await saveIndustryPromptVersion(supabase as never, {
      industryKey: "technology",
      variantKey: "quick",
      systemPrompt: "New system prompt with enough characters for safety checks.",
      userPromptTemplate: "Job:\n{{job_description}}\n{{candidate_resume}}",
      changeNote: "Improve evidence rules",
      actorUserId: "admin-1",
    });

    expect(result.versionNumber).toBe(2);
    expect(state.versions).toHaveLength(2);
    expect(state.versions[0].is_current).toBe(false);
    expect(state.versions[1].is_current).toBe(true);
    expect(state.versions[1].system_prompt).toContain("New system prompt");
    expect(state.versions[0].system_prompt).toContain("Old system prompt");
    expect(invalidateAiPromptCaches).toHaveBeenCalledOnce();
    expect(writeActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "industry_prompt_saved", actorUserId: "admin-1" })
    );
  });

  it("restores a prior version as a new active row and keeps history", async () => {
    const state = {
      features: [{ id: "f1", key: "candidate_match" }],
      variants: [{ id: "va1", key: "quick" }],
      verticals: [{ id: "ve1", key: "technology" }],
      templates: [
        {
          id: "tpl-tech-quick",
          feature_id: "f1",
          variant_id: "va1",
          vertical_id: "ve1",
          tenant_id: null,
          variant_key: "quick",
          vertical_key: "technology",
        },
      ],
      versions: [
        {
          id: "v1",
          template_id: "tpl-tech-quick",
          version_number: 1,
          status: "published",
          is_current: false,
          system_prompt: "Historical system prompt with enough characters.",
          user_prompt_template: "{{candidate_resume}}",
          response_schema: {},
          model_config: {},
          created_by: "admin-0",
          published_by: "admin-0",
          source_version_id: null,
          change_reason: "Initial",
          created_at: "2026-09-01T00:00:00.000Z",
          updated_at: "2026-09-01T00:00:00.000Z",
          published_at: "2026-09-01T00:00:00.000Z",
          content_hash: "h1",
        },
        {
          id: "v2",
          template_id: "tpl-tech-quick",
          version_number: 2,
          status: "published",
          is_current: true,
          system_prompt: "Current system prompt with enough characters.",
          user_prompt_template: "{{candidate_resume}}",
          response_schema: {},
          model_config: {},
          created_by: "admin-0",
          published_by: "admin-0",
          source_version_id: "v1",
          change_reason: "Rewrite",
          created_at: "2026-09-02T00:00:00.000Z",
          updated_at: "2026-09-02T00:00:00.000Z",
          published_at: "2026-09-02T00:00:00.000Z",
          content_hash: "h2",
        },
      ],
    };
    const supabase = createFakeSupabase(state);
    const { restoreIndustryPromptVersion } = await import("./industry-prompts-service");
    const result = await restoreIndustryPromptVersion(supabase as never, {
      industryKey: "technology",
      variantKey: "quick",
      sourceVersionId: "v1",
      changeNote: "Restored from version 1",
      actorUserId: "admin-2",
    });

    expect(result.versionNumber).toBe(3);
    expect(state.versions).toHaveLength(3);
    expect(state.versions.find((row) => row.id === "v1")?.system_prompt).toContain("Historical");
    expect(state.versions.find((row) => row.id === "v2")?.is_current).toBe(false);
    const restored = state.versions.find((row) => row.version_number === 3);
    expect(restored?.is_current).toBe(true);
    expect(restored?.source_version_id).toBe("v1");
    expect(restored?.system_prompt).toContain("Historical");
    expect(invalidateAiPromptCaches).toHaveBeenCalledOnce();
    expect(writeActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "industry_prompt_restored" })
    );
  });
});
