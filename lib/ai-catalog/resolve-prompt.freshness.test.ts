import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cachedPromptIsCurrent } from "./resolve-core";
import { resolvePromptVersion } from "./resolve-prompt";

const cache = new Map<string, unknown>();

vi.mock("@/lib/cache", () => ({
  CACHE_TTL_SECONDS: { tenantConfig: 900 },
  getCache: vi.fn(async (key: string) => cache.get(key) ?? null),
  setCache: vi.fn(async (key: string, value: unknown) => {
    cache.set(key, value);
    return true;
  }),
  deleteByPattern: vi.fn(async () => undefined),
}));

type Master = {
  id: string;
  content_hash: string;
  system_prompt: string;
  feature_key: string;
  variant_key: string;
  vertical_key: string;
};

let masters: Master[];

function masterRow(row: Master) {
  return {
    ...row,
    template_id: `tpl-${row.vertical_key}`,
    version_number: 2,
    status: "published",
    is_current: true,
    tenant_id: null,
    user_prompt_template: "Job:\n{{job_description}}\nResume:\n{{candidate_resume}}",
    response_schema: {},
    model_config: {},
  };
}

function supabaseMock(): SupabaseClient {
  return {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const builder = {
        select() {
          return builder;
        },
        eq(column: string, value: unknown) {
          filters[column] = value;
          return builder;
        },
        is(column: string, value: unknown) {
          filters[column] = value;
          return builder;
        },
        maybeSingle: async () => ({ data: pick(table, filters, true), error: null }),
        then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
          return Promise.resolve({ data: pick(table, filters, false), error: null }).then(
            onFulfilled,
            onRejected
          );
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

function pick(table: string, filters: Record<string, unknown>, single: boolean) {
  if (table === "industry_catalog") {
    return [
      { key: "technology", ai_vertical_key: "technology" },
      { key: "healthcare", ai_vertical_key: "healthcare" },
    ];
  }
  if (table === "tenant_ai_binding" || table === "ai_client_gate") return [];
  if (table !== "ai_current_prompt_version") return single ? null : [];

  const rows = masters.filter((row) => {
    if (filters.feature_key && row.feature_key !== filters.feature_key) return false;
    if (filters.variant_key && row.variant_key !== filters.variant_key) return false;
    if (filters.vertical_key && row.vertical_key !== filters.vertical_key) return false;
    return true;
  });
  if (single) return rows[0] ? masterRow(rows[0]) : null;
  return rows.map(masterRow);
}

describe("cachedPromptIsCurrent", () => {
  it("rejects a cached body after the published hash changes", () => {
    expect(
      cachedPromptIsCurrent({
        cached: {
          promptVersionId: "v1",
          contentHash: "hash-v1",
          resolvedVerticalKey: "technology",
        },
        plannedVerticalKey: "technology",
        plannedStamp: { id: "v2", contentHash: "hash-v2" },
        fallbackStamp: { id: "global-v1", contentHash: "hash-global" },
        binding: null,
      })
    ).toBe(false);
  });

  it("keeps a cached body when the published stamp is unchanged", () => {
    expect(
      cachedPromptIsCurrent({
        cached: {
          promptVersionId: "v2",
          contentHash: "hash-v2",
          resolvedVerticalKey: "technology",
        },
        plannedVerticalKey: "technology",
        plannedStamp: { id: "v2", contentHash: "hash-v2" },
        fallbackStamp: null,
        binding: null,
      })
    ).toBe(true);
  });

  it("does not reuse a global fallback after the industry pack is published", () => {
    expect(
      cachedPromptIsCurrent({
        cached: {
          promptVersionId: "global-v1",
          contentHash: "hash-global",
          resolvedVerticalKey: "global",
        },
        plannedVerticalKey: "technology",
        plannedStamp: { id: "tech-v1", contentHash: "hash-tech" },
        fallbackStamp: { id: "global-v1", contentHash: "hash-global" },
        binding: null,
      })
    ).toBe(false);
  });
});

describe("resolvePromptVersion cache freshness", () => {
  beforeEach(() => {
    cache.clear();
    masters = [
      {
        id: "tech-v1",
        content_hash: "hash-tech-v1",
        system_prompt: "Technology prompt v1",
        feature_key: "candidate_match",
        variant_key: "quick",
        vertical_key: "technology",
      },
      {
        id: "health-v1",
        content_hash: "hash-health-v1",
        system_prompt: "Healthcare prompt v1",
        feature_key: "candidate_match",
        variant_key: "quick",
        vertical_key: "healthcare",
      },
    ];
  });

  it("sends the updated industry prompt on the next resolve and does not reuse another industry", async () => {
    const supabase = supabaseMock();
    const first = await resolvePromptVersion(supabase, {
      tenantId: "tenant-a",
      featureKey: "candidate_match",
      variantKey: "quick",
      industryKey: "technology",
    });
    expect(first.systemPrompt).toBe("Technology prompt v1");
    expect(first.contentHash).toBe("hash-tech-v1");

    masters = masters.map((row) =>
      row.id === "tech-v1"
        ? {
            ...row,
            id: "tech-v2",
            content_hash: "hash-tech-v2",
            system_prompt: "Technology prompt v2 CORE SEAT",
          }
        : row
    );

    const second = await resolvePromptVersion(supabase, {
      tenantId: "tenant-a",
      featureKey: "candidate_match",
      variantKey: "quick",
      industryKey: "technology",
    });
    expect(second.systemPrompt).toBe("Technology prompt v2 CORE SEAT");
    expect(second.promptVersionId).toBe("tech-v2");
    expect(second.contentHash).toBe("hash-tech-v2");

    const healthcare = await resolvePromptVersion(supabase, {
      tenantId: "tenant-a",
      featureKey: "candidate_match",
      variantKey: "quick",
      industryKey: "healthcare",
    });
    expect(healthcare.systemPrompt).toBe("Healthcare prompt v1");
    expect(healthcare.resolvedVerticalKey).toBe("healthcare");

    const otherTenant = await resolvePromptVersion(supabase, {
      tenantId: "tenant-b",
      featureKey: "candidate_match",
      variantKey: "quick",
      industryKey: "technology",
    });
    expect(otherTenant.systemPrompt).toBe("Technology prompt v2 CORE SEAT");
    expect(otherTenant.promptVersionId).toBe("tech-v2");
  });
});
