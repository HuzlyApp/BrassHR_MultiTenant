export function aiPromptCacheKey(args: {
  tenantId: string;
  featureKey: string;
  variantKey: string;
  industryKey: string | null;
  resolvedVerticalKey: string;
  clientAccountId?: string | null;
}): string {
  const industry = args.industryKey || "none";
  const client = args.clientAccountId || "none";
  return [
    "ai:prompt",
    args.tenantId,
    args.featureKey,
    args.variantKey,
    industry,
    args.resolvedVerticalKey,
    client,
  ].join(":");
}
