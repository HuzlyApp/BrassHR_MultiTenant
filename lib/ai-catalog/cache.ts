import "server-only";

import { createHash } from "crypto";
import {
  deleteByPattern,
  getCache,
  setCache,
  CACHE_TTL_SECONDS,
} from "@/lib/cache";
import { aiPromptCacheKey } from "./cache-key";
import type { PromptResolveRequest, ResolvedPromptVersion } from "./types";

export { aiPromptCacheKey };

export async function readResolvedPromptCache(
  key: string
): Promise<ResolvedPromptVersion | null> {
  return getCache<ResolvedPromptVersion>(key);
}

export async function writeResolvedPromptCache(
  key: string,
  value: ResolvedPromptVersion
): Promise<void> {
  await setCache(key, value, CACHE_TTL_SECONDS.tenantConfig);
}

export async function invalidateAiPromptCaches(): Promise<void> {
  await deleteByPattern("ai:prompt:*");
}

export function hashPromptContent(parts: {
  systemPrompt: string;
  userPromptTemplate: string;
  responseSchema: unknown;
  modelConfig: unknown;
}): string {
  const payload = JSON.stringify({
    systemPrompt: parts.systemPrompt,
    userPromptTemplate: parts.userPromptTemplate,
    responseSchema: parts.responseSchema,
    modelConfig: parts.modelConfig,
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function cacheKeyFromRequest(
  request: PromptResolveRequest,
  resolvedVerticalKey: string
): string {
  return aiPromptCacheKey({
    tenantId: request.tenantId,
    featureKey: request.featureKey,
    variantKey: request.variantKey,
    industryKey: request.industryKey ?? request.tenantPrimaryIndustryKey ?? null,
    resolvedVerticalKey,
    clientAccountId: request.clientAccountId ?? request.clientName ?? null,
  });
}
