import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PromptRunInsert } from "./types";

export async function recordAiPromptRun(
  supabase: SupabaseClient,
  run: PromptRunInsert
): Promise<void> {
  const { error } = await supabase.from("ai_prompt_run").insert({
    tenant_id: run.tenantId,
    feature_key: run.featureKey,
    variant_key: run.variantKey,
    vertical_key: run.verticalKey,
    industry_key: run.industryKey,
    prompt_version_id: run.promptVersionId,
    content_hash: run.contentHash,
    entity_type: run.entityType,
    entity_id: run.entityId,
    input_hash: run.inputHash,
    model: run.model,
    input_tokens: run.inputTokens,
    output_tokens: run.outputTokens,
    latency_ms: run.latencyMs,
    credit_cost: run.creditCost,
    status: run.status,
    error_code: run.errorCode,
    output_reference: run.outputReference,
    requested_by: run.requestedBy,
  });
  if (error) throw error;
}
