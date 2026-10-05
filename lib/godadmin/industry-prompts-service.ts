import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { invalidateAiPromptCaches } from "@/lib/ai-catalog/cache";
import { AI_PACK_LABELS, industryLabelForKey } from "@/lib/ai-catalog/industry-catalog";
import { writeActivityLog } from "@/lib/audit/activity-log";
import {
  INDUSTRY_PROMPT_FEATURE_KEY,
  INDUSTRY_PROMPT_VARIANTS,
  buildIndustryPromptListItems,
  formatActorName,
  industriesSharingPack,
  isIndustryPromptVariantKey,
  packKeyForIndustry,
  versionEventLabel,
  type IndustryPromptListItem,
  type IndustryPromptVariantKey,
  type IndustryPromptVersionDetail,
  type IndustryPromptVersionSummary,
} from "@/lib/godadmin/industry-prompts";

type Nested = Record<string, unknown> | Record<string, unknown>[] | null | undefined;

function nestedRecord<T extends object>(value: Nested): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value as T;
}

function actorIdsFromRows(
  rows: Array<{ created_by?: string | null; published_by?: string | null }>
): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.created_by) ids.add(row.created_by);
    if (row.published_by) ids.add(row.published_by);
  }
  return [...ids];
}

async function loadActorMap(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!userIds.length) return map;
  const { data } = await supabase
    .from("users")
    .select("id, first_name, last_name, email")
    .in("id", userIds);
  for (const row of data ?? []) {
    const label = formatActorName(row);
    if (label) map.set(row.id, label);
  }
  return map;
}

async function findTemplateId(
  supabase: SupabaseClient,
  packKey: string,
  variantKey: IndustryPromptVariantKey
): Promise<string | null> {
  const [feature, variant, vertical] = await Promise.all([
    supabase.from("ai_feature").select("id").eq("key", INDUSTRY_PROMPT_FEATURE_KEY).maybeSingle(),
    supabase.from("ai_variant").select("id").eq("key", variantKey).maybeSingle(),
    supabase.from("ai_vertical").select("id").eq("key", packKey).maybeSingle(),
  ]);
  if (feature.error) throw new Error(feature.error.message);
  if (variant.error) throw new Error(variant.error.message);
  if (vertical.error) throw new Error(vertical.error.message);
  if (!feature.data?.id || !variant.data?.id || !vertical.data?.id) return null;

  const { data, error } = await supabase
    .from("ai_prompt_template")
    .select("id")
    .is("tenant_id", null)
    .eq("feature_id", feature.data.id)
    .eq("variant_id", variant.data.id)
    .eq("vertical_id", vertical.data.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

async function loadCurrentStampMap(
  supabase: SupabaseClient
): Promise<Map<string, { versionNumber: number; publishedAt: string | null }>> {
  const { data, error } = await supabase
    .from("ai_current_prompt_version")
    .select("feature_key, variant_key, vertical_key, version_number, published_at")
    .eq("feature_key", INDUSTRY_PROMPT_FEATURE_KEY)
    .is("tenant_id", null);
  if (error) throw new Error(error.message);
  const map = new Map<string, { versionNumber: number; publishedAt: string | null }>();
  for (const row of data ?? []) {
    if (!INDUSTRY_PROMPT_VARIANTS.includes(row.variant_key as IndustryPromptVariantKey)) continue;
    map.set(`${row.vertical_key}:${row.variant_key}`, {
      versionNumber: Number(row.version_number),
      publishedAt: row.published_at ?? null,
    });
  }
  return map;
}

export async function listIndustryPrompts(
  supabase: SupabaseClient
): Promise<IndustryPromptListItem[]> {
  const stampMap = await loadCurrentStampMap(supabase);
  return buildIndustryPromptListItems(stampMap);
}

function mapVersionRow(
  row: Record<string, unknown>,
  actors: Map<string, string>
): IndustryPromptVersionDetail {
  const template = nestedRecord<{
    tenant_id: string | null;
    ai_feature: { key: string } | { key: string }[];
    ai_variant: { key: string } | { key: string }[];
    ai_vertical: { key: string } | { key: string }[];
  }>(row.ai_prompt_template as Nested);
  const feature = nestedRecord<{ key: string }>(template?.ai_feature as Nested);
  const variant = nestedRecord<{ key: string }>(template?.ai_variant as Nested);
  const vertical = nestedRecord<{ key: string }>(template?.ai_vertical as Nested);
  const createdBy = (row.created_by as string | null) ?? null;
  const publishedBy = (row.published_by as string | null) ?? null;
  const status = String(row.status) as IndustryPromptVersionSummary["status"];
  const isCurrent = Boolean(row.is_current);
  const sourceVersionId = (row.source_version_id as string | null) ?? null;
  const changeReason = (row.change_reason as string | null) ?? null;
  return {
    id: String(row.id),
    templateId: String(row.template_id),
    versionNumber: Number(row.version_number),
    status,
    isCurrent,
    changeReason,
    contentHash: (row.content_hash as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    publishedAt: (row.published_at as string | null) ?? null,
    createdBy,
    publishedBy,
    actorLabel: (publishedBy && actors.get(publishedBy)) || (createdBy && actors.get(createdBy)) || null,
    sourceVersionId,
    eventLabel: versionEventLabel({ status, isCurrent, sourceVersionId, changeReason }),
    systemPrompt: String(row.system_prompt ?? ""),
    userPromptTemplate: String(row.user_prompt_template ?? ""),
    responseSchema:
      row.response_schema && typeof row.response_schema === "object"
        ? (row.response_schema as Record<string, unknown>)
        : {},
    modelConfig:
      row.model_config && typeof row.model_config === "object"
        ? (row.model_config as Record<string, unknown>)
        : {},
    featureKey: feature?.key ?? INDUSTRY_PROMPT_FEATURE_KEY,
    variantKey: variant?.key ?? "",
    verticalKey: vertical?.key ?? "",
  };
}

export async function getIndustryPromptDetail(
  supabase: SupabaseClient,
  industryKey: string,
  variantKey: IndustryPromptVariantKey
): Promise<{
  industryKey: string;
  industryLabel: string;
  aiPackKey: string;
  aiPackLabel: string;
  sharesPackWith: { key: string; label: string }[];
  variantKey: IndustryPromptVariantKey;
  templateId: string | null;
  active: IndustryPromptVersionDetail | null;
  effectiveSource: "dedicated" | "global_fallback" | "none";
  fallbackActive: IndustryPromptVersionDetail | null;
  versions: IndustryPromptVersionDetail[];
}> {
  const packKey = packKeyForIndustry(industryKey);
  if (!packKey) throw new Error(`Unsupported industry key: ${industryKey}`);

  const templateId = await findTemplateId(supabase, packKey, variantKey);
  const { data: packRows, error: packError } = templateId
    ? await supabase
        .from("ai_prompt_version")
        .select(
          "id, template_id, version_number, status, is_current, content_hash, change_reason, created_at, updated_at, published_at, created_by, published_by, source_version_id, system_prompt, user_prompt_template, response_schema, model_config, ai_prompt_template!inner(tenant_id, ai_feature!inner(key), ai_variant!inner(key), ai_vertical!inner(key))"
        )
        .eq("template_id", templateId)
        .order("version_number", { ascending: false })
    : { data: [], error: null };
  if (packError) throw new Error(packError.message);

  const actors = await loadActorMap(supabase, actorIdsFromRows(packRows ?? []));
  const versions = (packRows ?? []).map((row) => mapVersionRow(row as Record<string, unknown>, actors));
  const active = versions.find((row) => row.isCurrent && row.status === "published") ?? null;

  let fallbackActive: IndustryPromptVersionDetail | null = null;
  if (!active && packKey !== "global") {
    const globalTemplateId = await findTemplateId(supabase, "global", variantKey);
    if (globalTemplateId) {
      const { data: globalCurrent } = await supabase
        .from("ai_prompt_version")
        .select(
          "id, template_id, version_number, status, is_current, content_hash, change_reason, created_at, updated_at, published_at, created_by, published_by, source_version_id, system_prompt, user_prompt_template, response_schema, model_config, ai_prompt_template!inner(tenant_id, ai_feature!inner(key), ai_variant!inner(key), ai_vertical!inner(key))"
        )
        .eq("template_id", globalTemplateId)
        .eq("is_current", true)
        .eq("status", "published")
        .maybeSingle();
      if (globalCurrent) {
        const globalActors = await loadActorMap(supabase, actorIdsFromRows([globalCurrent]));
        fallbackActive = mapVersionRow(globalCurrent as Record<string, unknown>, globalActors);
      }
    }
  }

  const sharesPackWith = industriesSharingPack(packKey).filter(
    (peer) => peer.key !== industryKey
  );

  return {
    industryKey,
    industryLabel: industryLabelForKey(industryKey) ?? industryKey,
    aiPackKey: packKey,
    aiPackLabel: AI_PACK_LABELS[packKey] ?? packKey,
    sharesPackWith,
    variantKey,
    templateId,
    active,
    effectiveSource: active ? "dedicated" : fallbackActive ? "global_fallback" : "none",
    fallbackActive,
    versions,
  };
}

async function nextVersionNumber(supabase: SupabaseClient, templateId: string): Promise<number> {
  const { data } = await supabase
    .from("ai_prompt_version")
    .select("version_number")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return Number(data?.version_number ?? 0) + 1;
}

async function loadSeedContent(
  supabase: SupabaseClient,
  packKey: string,
  variantKey: IndustryPromptVariantKey,
  sourceVersionId?: string | null
): Promise<{
  systemPrompt: string;
  userPromptTemplate: string;
  responseSchema: Record<string, unknown>;
  modelConfig: Record<string, unknown>;
  sourceVersionId: string | null;
}> {
  if (sourceVersionId) {
    const { data, error } = await supabase
      .from("ai_prompt_version")
      .select("id, system_prompt, user_prompt_template, response_schema, model_config")
      .eq("id", sourceVersionId)
      .maybeSingle();
    if (error || !data) throw new Error(error?.message || "Source version not found");
    return {
      systemPrompt: data.system_prompt,
      userPromptTemplate: data.user_prompt_template,
      responseSchema: (data.response_schema as Record<string, unknown>) ?? {},
      modelConfig: (data.model_config as Record<string, unknown>) ?? {},
      sourceVersionId: data.id,
    };
  }

  const templateId = await findTemplateId(supabase, packKey, variantKey);
  if (templateId) {
    const { data: current } = await supabase
      .from("ai_prompt_version")
      .select("id, system_prompt, user_prompt_template, response_schema, model_config")
      .eq("template_id", templateId)
      .eq("is_current", true)
      .maybeSingle();
    if (current) {
      return {
        systemPrompt: current.system_prompt,
        userPromptTemplate: current.user_prompt_template,
        responseSchema: (current.response_schema as Record<string, unknown>) ?? {},
        modelConfig: (current.model_config as Record<string, unknown>) ?? {},
        sourceVersionId: current.id,
      };
    }
  }

  if (packKey !== "global") {
    return loadSeedContent(supabase, "global", variantKey, null);
  }

  return {
    systemPrompt: "",
    userPromptTemplate: "",
    responseSchema: {},
    modelConfig: {},
    sourceVersionId: null,
  };
}

async function publishDraft(
  supabase: SupabaseClient,
  versionId: string,
  changeReason: string,
  actorUserId: string
): Promise<void> {
  const { error } = await supabase.rpc("publish_ai_prompt_version", {
    p_version_id: versionId,
    p_change_reason: changeReason,
  });
  if (error) throw new Error(error.message);

  // Service-role RPC often leaves published_by null (auth.uid() empty). Stamp actor.
  await supabase
    .from("ai_prompt_version")
    .update({ published_by: actorUserId, updated_at: new Date().toISOString() })
    .eq("id", versionId);
}

export async function saveIndustryPromptVersion(
  supabase: SupabaseClient,
  input: {
    industryKey: string;
    variantKey: IndustryPromptVariantKey;
    systemPrompt: string;
    userPromptTemplate: string;
    changeNote: string;
    responseSchema?: Record<string, unknown>;
    modelConfig?: Record<string, unknown>;
    actorUserId: string;
    request?: Request;
  }
): Promise<{ versionId: string; versionNumber: number }> {
  const packKey = packKeyForIndustry(input.industryKey);
  if (!packKey) throw new Error(`Unsupported industry key: ${input.industryKey}`);

  const templateId = await findTemplateId(supabase, packKey, input.variantKey);
  if (!templateId) {
    throw new Error(
      `No prompt template exists for pack "${packKey}" / variant "${input.variantKey}".`
    );
  }

  const seed = await loadSeedContent(supabase, packKey, input.variantKey, null);
  const versionNumber = await nextVersionNumber(supabase, templateId);
  const { data: inserted, error: insertError } = await supabase
    .from("ai_prompt_version")
    .insert({
      template_id: templateId,
      version_number: versionNumber,
      status: "draft",
      system_prompt: input.systemPrompt,
      user_prompt_template: input.userPromptTemplate,
      response_schema: input.responseSchema ?? seed.responseSchema ?? {},
      model_config: input.modelConfig ?? seed.modelConfig ?? {},
      source_version_id: seed.sourceVersionId,
      change_reason: input.changeNote,
      created_by: input.actorUserId,
    })
    .select("id, version_number")
    .single();
  if (insertError || !inserted) {
    throw new Error(insertError?.message || "Failed to create prompt version");
  }

  await publishDraft(supabase, inserted.id, input.changeNote, input.actorUserId);
  await invalidateAiPromptCaches();
  await writeActivityLog({
    actorUserId: input.actorUserId,
    action: "industry_prompt_saved",
    entityType: "ai_prompt_version",
    entityId: inserted.id,
    request: input.request,
    metadata: {
      industry_key: input.industryKey,
      ai_pack_key: packKey,
      variant_key: input.variantKey,
      version_number: inserted.version_number,
      change_note: input.changeNote,
    },
  });

  return { versionId: inserted.id, versionNumber: Number(inserted.version_number) };
}

export async function createIndustryPromptDraft(
  supabase: SupabaseClient,
  input: {
    industryKey: string;
    variantKey: IndustryPromptVariantKey;
    actorUserId: string;
    request?: Request;
  }
): Promise<{ versionId: string; versionNumber: number }> {
  const packKey = packKeyForIndustry(input.industryKey);
  if (!packKey) throw new Error(`Unsupported industry key: ${input.industryKey}`);
  const templateId = await findTemplateId(supabase, packKey, input.variantKey);
  if (!templateId) {
    throw new Error(
      `No prompt template exists for pack "${packKey}" / variant "${input.variantKey}".`
    );
  }

  const { data: existingCurrent } = await supabase
    .from("ai_prompt_version")
    .select("id")
    .eq("template_id", templateId)
    .eq("is_current", true)
    .maybeSingle();
  if (existingCurrent) {
    throw new Error("This industry pack already has an active prompt. Edit it instead.");
  }

  const seed = await loadSeedContent(supabase, "global", input.variantKey, null);
  if (!seed.systemPrompt.trim()) {
    throw new Error(
      "No seed prompt available. Publish a Global prompt for this step first, or paste content via Save."
    );
  }

  const versionNumber = await nextVersionNumber(supabase, templateId);
  const changeNote = `Initial ${AI_PACK_LABELS[packKey] ?? packKey} ${input.variantKey} prompt (seeded from Global).`;
  const { data: inserted, error } = await supabase
    .from("ai_prompt_version")
    .insert({
      template_id: templateId,
      version_number: versionNumber,
      status: "draft",
      system_prompt: seed.systemPrompt,
      user_prompt_template: seed.userPromptTemplate,
      response_schema: seed.responseSchema,
      model_config: seed.modelConfig,
      source_version_id: seed.sourceVersionId,
      change_reason: changeNote,
      created_by: input.actorUserId,
    })
    .select("id, version_number")
    .single();
  if (error || !inserted) throw new Error(error?.message || "Failed to create draft");

  await publishDraft(supabase, inserted.id, changeNote, input.actorUserId);
  await invalidateAiPromptCaches();
  await writeActivityLog({
    actorUserId: input.actorUserId,
    action: "industry_prompt_created",
    entityType: "ai_prompt_version",
    entityId: inserted.id,
    request: input.request,
    metadata: {
      industry_key: input.industryKey,
      ai_pack_key: packKey,
      variant_key: input.variantKey,
      version_number: inserted.version_number,
      seeded_from_global: true,
    },
  });

  return { versionId: inserted.id, versionNumber: Number(inserted.version_number) };
}

export async function restoreIndustryPromptVersion(
  supabase: SupabaseClient,
  input: {
    industryKey: string;
    variantKey: IndustryPromptVariantKey;
    sourceVersionId: string;
    changeNote?: string | null;
    actorUserId: string;
    request?: Request;
  }
): Promise<{ versionId: string; versionNumber: number }> {
  if (!isIndustryPromptVariantKey(input.variantKey)) {
    throw new Error(`Unsupported variant: ${input.variantKey}`);
  }
  const packKey = packKeyForIndustry(input.industryKey);
  if (!packKey) throw new Error(`Unsupported industry key: ${input.industryKey}`);

  const templateId = await findTemplateId(supabase, packKey, input.variantKey);
  if (!templateId) throw new Error("Prompt template not found for this industry pack.");

  const { data: source, error: sourceError } = await supabase
    .from("ai_prompt_version")
    .select(
      "id, template_id, version_number, system_prompt, user_prompt_template, response_schema, model_config"
    )
    .eq("id", input.sourceVersionId)
    .maybeSingle();
  if (sourceError || !source) throw new Error(sourceError?.message || "Source version not found");
  if (source.template_id !== templateId) {
    throw new Error("Source version does not belong to this industry prompt template.");
  }

  const changeNote =
    (input.changeNote ?? "").trim() ||
    `Restored from version ${source.version_number}`;

  const versionNumber = await nextVersionNumber(supabase, templateId);
  const { data: inserted, error } = await supabase
    .from("ai_prompt_version")
    .insert({
      template_id: templateId,
      version_number: versionNumber,
      status: "draft",
      system_prompt: source.system_prompt,
      user_prompt_template: source.user_prompt_template,
      response_schema: source.response_schema ?? {},
      model_config: source.model_config ?? {},
      source_version_id: source.id,
      change_reason: changeNote,
      created_by: input.actorUserId,
    })
    .select("id, version_number")
    .single();
  if (error || !inserted) throw new Error(error?.message || "Failed to create restored version");

  await publishDraft(supabase, inserted.id, changeNote, input.actorUserId);
  await invalidateAiPromptCaches();
  await writeActivityLog({
    actorUserId: input.actorUserId,
    action: "industry_prompt_restored",
    entityType: "ai_prompt_version",
    entityId: inserted.id,
    request: input.request,
    metadata: {
      industry_key: input.industryKey,
      ai_pack_key: packKey,
      variant_key: input.variantKey,
      version_number: inserted.version_number,
      restored_from_version_id: source.id,
      restored_from_version_number: source.version_number,
      change_note: changeNote,
    },
  });

  return { versionId: inserted.id, versionNumber: Number(inserted.version_number) };
}
