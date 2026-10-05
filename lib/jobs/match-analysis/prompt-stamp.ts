const MATCH_PROMPT_VARIANTS = new Set([
  "quick",
  "call_pack",
  "follow_up",
  "deep",
  "submission",
]);

export type StoredAnalysisPromptStamp = {
  contentHash: string | null;
  variantKey: string | null;
};

export function storedAnalysisPromptStamp(analysis: unknown): StoredAnalysisPromptStamp {
  if (!analysis || typeof analysis !== "object") {
    return { contentHash: null, variantKey: null };
  }
  const row = analysis as Record<string, unknown>;
  const contentHash =
    typeof row.prompt_content_hash === "string" ? row.prompt_content_hash.trim() : "";
  const variantKey = typeof row.prompt_variant_key === "string" ? row.prompt_variant_key.trim() : "";
  return {
    contentHash: contentHash || null,
    variantKey: variantKey && MATCH_PROMPT_VARIANTS.has(variantKey) ? variantKey : null,
  };
}

/** Old rows have no hash and stay visible. A different hash means the saved run used another prompt. */
export function analysisPromptIsStale(
  storedHash: string | null | undefined,
  currentHash: string | null | undefined
): boolean {
  const stored = storedHash?.trim() ?? "";
  const current = currentHash?.trim() ?? "";
  if (!stored || !current) return false;
  return stored !== current;
}
