import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { mapIndustryKeyToAiPack, type AiPackKey } from "./industry-catalog";
import { PromptNotConfiguredError } from "./errors";
import {
  cacheKeyFromRequest,
  readResolvedPromptCache,
  writeResolvedPromptCache,
} from "./cache";
import {
  applyIndustryPriority,
  applyTenantBinding,
  bindingFor,
  matchingClientGate,
  planPromptResolution,
  selectIndustryKey,
} from "./resolve-core";
import type {
  AiFeatureKey,
  AiVariantKey,
  ClientGateSnapshot,
  PromptResolveRequest,
  PromptResolveSnapshot,
  ResolvedPromptVersion,
  TenantBindingSnapshot,
} from "./types";

function nestedRecord<T extends object>(value: unknown): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value as T;
}

type VersionRow = {
  id: string;
  template_id: string;
  version_number: number;
  status: "draft" | "published" | "retired";
  content_hash: string | null;
  system_prompt: string;
  user_prompt_template: string;
  response_schema: Record<string, unknown>;
  model_config: Record<string, unknown>;
  feature_key: AiFeatureKey;
  variant_key: AiVariantKey;
  vertical_key: AiPackKey;
  tenant_id: string | null;
  is_current: boolean;
};

async function loadSnapshot(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PromptResolveSnapshot> {
  const [industries, versions, bindings, gates] = await Promise.all([
    supabase.from("industry_catalog").select("key, ai_vertical_key").eq("is_active", true),
    supabase
      .from("ai_current_prompt_version")
      .select("feature_key, variant_key, vertical_key, tenant_id"),
    supabase
      .from("tenant_ai_binding")
      .select(
        "tenant_id, mode, is_enabled, pinned_version_id, fork_template_id, ai_feature!inner(key), ai_variant!inner(key), ai_vertical!inner(key)"
      )
      .eq("tenant_id", tenantId),
    supabase
      .from("ai_client_gate")
      .select(
        "tenant_id, match_type, match_value, feature_key, variant_key, vertical_key_override, is_active, priority"
      )
      .eq("is_active", true),
  ]);

  if (industries.error) throw industries.error;
  if (versions.error) throw versions.error;
  if (bindings.error) throw bindings.error;
  if (gates.error) throw gates.error;

  const industryToPack: Record<string, AiPackKey> = {};
  for (const row of industries.data ?? []) {
    industryToPack[String(row.key)] = String(row.ai_vertical_key) as AiPackKey;
  }

  const publishedPacks = new Set<string>();
  for (const row of versions.data ?? []) {
    if (row.tenant_id) continue;
    publishedPacks.add(`${row.feature_key}:${row.variant_key}:${row.vertical_key}`);
  }

  const bindingRows: TenantBindingSnapshot[] = (bindings.data ?? []).map((row) => {
    const feature = nestedRecord<{ key: AiFeatureKey }>(row.ai_feature);
    const variant = nestedRecord<{ key: AiVariantKey }>(row.ai_variant);
    const vertical = nestedRecord<{ key: AiPackKey }>(row.ai_vertical);
    return {
      tenantId: String(row.tenant_id),
      featureKey: feature?.key as AiFeatureKey,
      variantKey: variant?.key as AiVariantKey,
      verticalKey: vertical?.key as AiPackKey,
      mode: row.mode as TenantBindingSnapshot["mode"],
      isEnabled: row.is_enabled !== false,
      pinnedVersionId: row.pinned_version_id ? String(row.pinned_version_id) : null,
      forkTemplateId: row.fork_template_id ? String(row.fork_template_id) : null,
    };
  });

  const clientGates: ClientGateSnapshot[] = (gates.data ?? []).map((row) => ({
    tenantId: row.tenant_id ? String(row.tenant_id) : null,
    matchType: row.match_type as ClientGateSnapshot["matchType"],
    matchValue: String(row.match_value ?? ""),
    featureKey: String(row.feature_key) as AiFeatureKey,
    variantKey: String(row.variant_key) as AiVariantKey,
    verticalKeyOverride: row.vertical_key_override
      ? (String(row.vertical_key_override) as AiPackKey)
      : null,
    isActive: row.is_active !== false,
    priority: Number(row.priority ?? 0),
  }));

  return { industryToPack, publishedPacks, bindings: bindingRows, clientGates };
}

async function loadVersionById(
  supabase: SupabaseClient,
  versionId: string
): Promise<VersionRow | null> {
  const { data, error } = await supabase
    .from("ai_prompt_version")
    .select(
      "id, template_id, version_number, status, is_current, content_hash, system_prompt, user_prompt_template, response_schema, model_config, ai_prompt_template!inner(tenant_id, ai_feature!inner(key), ai_variant!inner(key), ai_vertical!inner(key))"
    )
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const template = nestedRecord<{
    tenant_id: string | null;
    ai_feature: { key: AiFeatureKey } | { key: AiFeatureKey }[];
    ai_variant: { key: AiVariantKey } | { key: AiVariantKey }[];
    ai_vertical: { key: AiPackKey } | { key: AiPackKey }[];
  }>(data.ai_prompt_template);
  if (!template) return null;
  const feature = nestedRecord<{ key: AiFeatureKey }>(template.ai_feature);
  const variant = nestedRecord<{ key: AiVariantKey }>(template.ai_variant);
  const vertical = nestedRecord<{ key: AiPackKey }>(template.ai_vertical);
  if (!feature || !variant || !vertical) return null;
  return {
    id: String(data.id),
    template_id: String(data.template_id),
    version_number: Number(data.version_number),
    status: data.status as VersionRow["status"],
    content_hash: data.content_hash ? String(data.content_hash) : null,
    system_prompt: String(data.system_prompt ?? ""),
    user_prompt_template: String(data.user_prompt_template ?? ""),
    response_schema: (data.response_schema ?? {}) as Record<string, unknown>,
    model_config: (data.model_config ?? {}) as Record<string, unknown>,
    feature_key: feature.key,
    variant_key: variant.key,
    vertical_key: vertical.key,
    tenant_id: template.tenant_id,
    is_current: data.is_current === true,
  };
}

async function loadCurrentMaster(
  supabase: SupabaseClient,
  featureKey: AiFeatureKey,
  variantKey: AiVariantKey,
  verticalKey: AiPackKey
): Promise<VersionRow | null> {
  const { data, error } = await supabase
    .from("ai_current_prompt_version")
    .select(
      "id, template_id, version_number, status, is_current, content_hash, system_prompt, user_prompt_template, response_schema, model_config, tenant_id, feature_key, variant_key, vertical_key"
    )
    .is("tenant_id", null)
    .eq("feature_key", featureKey)
    .eq("variant_key", variantKey)
    .eq("vertical_key", verticalKey)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: String(data.id),
    template_id: String(data.template_id),
    version_number: Number(data.version_number),
    status: data.status as VersionRow["status"],
    content_hash: data.content_hash ? String(data.content_hash) : null,
    system_prompt: String(data.system_prompt ?? ""),
    user_prompt_template: String(data.user_prompt_template ?? ""),
    response_schema: (data.response_schema ?? {}) as Record<string, unknown>,
    model_config: (data.model_config ?? {}) as Record<string, unknown>,
    feature_key: data.feature_key as AiFeatureKey,
    variant_key: data.variant_key as AiVariantKey,
    vertical_key: data.vertical_key as AiPackKey,
    tenant_id: data.tenant_id ? String(data.tenant_id) : null,
    is_current: true,
  };
}

function toResolved(
  row: VersionRow,
  request: PromptResolveRequest,
  resolvedVerticalKey: AiPackKey,
  source: ResolvedPromptVersion["source"],
  fallbackApplied: boolean
): ResolvedPromptVersion {
  if (!row.system_prompt.trim() || row.status !== "published" || !row.content_hash) {
    throw new PromptNotConfiguredError();
  }
  return {
    promptVersionId: row.id,
    templateId: row.template_id,
    featureKey: request.featureKey,
    variantKey: row.variant_key,
    requestedIndustryKey: selectIndustryKey(request),
    resolvedVerticalKey,
    contentHash: row.content_hash,
    systemPrompt: row.system_prompt,
    userPromptTemplate: row.user_prompt_template,
    responseSchema: row.response_schema,
    modelConfig: row.model_config,
    status: row.status,
    versionNumber: row.version_number,
    source,
    fallbackApplied,
  };
}

/**
 * Central prompt resolver. Never matches on display labels or fuzzy text.
 */
export async function resolvePromptVersion(
  supabase: SupabaseClient,
  request: PromptResolveRequest
): Promise<ResolvedPromptVersion> {
  if (request.industryKey && !mapIndustryKeyToAiPack(request.industryKey) && request.industryKey !== "global") {
    throw new PromptNotConfiguredError(
      "No published AI prompt is configured for this feature, variant, and industry."
    );
  }

  const snapshot = await loadSnapshot(supabase, request.tenantId);
  const plan = planPromptResolution(request, snapshot);
  const cacheKey = cacheKeyFromRequest(
    { ...request, variantKey: plan.variantKey, industryKey: plan.requestedIndustryKey },
    plan.resolvedVerticalKey
  );
  const cached = await readResolvedPromptCache(cacheKey);
  if (cached) return cached;

  const packsToTry: AiPackKey[] = [plan.resolvedVerticalKey, ...plan.fallbackPacks];
  const uniquePacks = [...new Set(packsToTry)];

  for (const pack of uniquePacks) {
    if (pack === "staffing" || pack === "msp") continue;
    const binding = bindingFor(snapshot, request.tenantId, request.featureKey, plan.variantKey, pack);
    const bindingDecision = applyTenantBinding(binding);
    if (bindingDecision.skip) continue;

    if (binding?.mode === "forked" && binding.forkTemplateId) {
      const { data: forkVersion, error } = await supabase
        .from("ai_prompt_version")
        .select("id")
        .eq("template_id", binding.forkTemplateId)
        .eq("status", "published")
        .eq("is_current", true)
        .maybeSingle();
      if (error) throw error;
      if (forkVersion?.id) {
        const row = await loadVersionById(supabase, String(forkVersion.id));
        if (row) {
          const resolved = toResolved(row, request, pack, "tenant_fork", pack !== applyIndustryPriority(request));
          await writeResolvedPromptCache(cacheKey, resolved);
          return resolved;
        }
      }
    }

    if (binding?.mode === "pinned" && binding.pinnedVersionId) {
      const row = await loadVersionById(supabase, binding.pinnedVersionId);
      if (row && row.status === "published") {
        const resolved = toResolved(row, request, pack, "pinned", pack !== applyIndustryPriority(request));
        await writeResolvedPromptCache(cacheKey, resolved);
        return resolved;
      }
    }

    const master = await loadCurrentMaster(supabase, request.featureKey, plan.variantKey, pack);
    if (master) {
      const resolved = toResolved(
        master,
        request,
        pack,
        pack === uniquePacks[0] ? "published_master" : "fallback",
        pack !== uniquePacks[0]
      );
      await writeResolvedPromptCache(cacheKey, resolved);
      return resolved;
    }
  }

  throw new PromptNotConfiguredError();
}

export { matchingClientGate, planPromptResolution, applyIndustryPriority };
