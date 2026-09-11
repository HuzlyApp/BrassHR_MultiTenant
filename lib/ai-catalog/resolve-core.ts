import {
  INDUSTRY_TO_AI_PACK,
  mapIndustryKeyToAiPack,
  type AiPackKey,
} from "./industry-catalog";
import type {
  AiFeatureKey,
  AiVariantKey,
  ClientGateSnapshot,
  PromptResolveRequest,
  PromptResolveSnapshot,
  TenantBindingSnapshot,
} from "./types";

export type ResolvedPackPlan = {
  requestedIndustryKey: string | null;
  resolvedVerticalKey: AiPackKey;
  variantKey: AiVariantKey;
  featureKey: AiFeatureKey;
  clientGateApplied: boolean;
  fallbackPacks: AiPackKey[];
};

function normalizeMatch(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function selectIndustryKey(request: PromptResolveRequest): string | null {
  const explicit = request.industryKey?.trim() || null;
  if (explicit) return explicit;
  const primary = request.tenantPrimaryIndustryKey?.trim() || null;
  if (primary) return primary;
  return "other";
}

export function applyIndustryPriority(request: PromptResolveRequest): AiPackKey {
  const key = selectIndustryKey(request);
  const mapped = mapIndustryKeyToAiPack(key);
  if (mapped) return mapped;
  return "global";
}

export function matchingClientGate(
  request: PromptResolveRequest,
  gates: ClientGateSnapshot[]
): ClientGateSnapshot | null {
  const clientName = normalizeMatch(request.clientName);
  const sourceKey = normalizeMatch(request.sourceKey);
  const accountId = normalizeMatch(request.clientAccountId);
  const active = gates
    .filter((gate) => gate.isActive && gate.featureKey === request.featureKey)
    .filter((gate) => gate.tenantId == null || gate.tenantId === request.tenantId)
    .sort((a, b) => b.priority - a.priority);

  for (const gate of active) {
    const expected = normalizeMatch(gate.matchValue);
    if (!expected) continue;
    if (gate.matchType === "client_account_id" && accountId === expected) return gate;
    if (gate.matchType === "source_key" && sourceKey === expected) return gate;
    if (gate.matchType === "client_name") {
      if (clientName.includes(expected) || sourceKey.includes(expected)) return gate;
    }
  }
  return null;
}

function packPublished(snapshot: PromptResolveSnapshot, pack: AiPackKey, variant: AiVariantKey, feature: AiFeatureKey): boolean {
  return snapshot.publishedPacks.has(`${feature}:${variant}:${pack}`);
}

export function planPromptResolution(
  request: PromptResolveRequest,
  snapshot: PromptResolveSnapshot
): ResolvedPackPlan {
  const requestedIndustryKey = selectIndustryKey(request);
  let resolvedVerticalKey = applyIndustryPriority(request);
  let variantKey = request.variantKey;
  const gate = matchingClientGate(request, snapshot.clientGates);
  if (gate) {
    variantKey = gate.variantKey;
    if (gate.verticalKeyOverride) {
      resolvedVerticalKey = gate.verticalKeyOverride;
    }
  }

  const fallbackPacks: AiPackKey[] = [];
  if (
    resolvedVerticalKey !== "global" &&
    !packPublished(snapshot, resolvedVerticalKey, variantKey, request.featureKey)
  ) {
    fallbackPacks.push("global");
  }

  if (variantKey !== request.variantKey && gate) {
    const gatePack = resolvedVerticalKey;
    if (!packPublished(snapshot, gatePack, variantKey, request.featureKey)) {
      if (gatePack !== "global" && packPublished(snapshot, "global", variantKey, request.featureKey)) {
        resolvedVerticalKey = "global";
      } else {
        variantKey = request.variantKey;
        resolvedVerticalKey = applyIndustryPriority(request);
        if (
          resolvedVerticalKey !== "global" &&
          !packPublished(snapshot, resolvedVerticalKey, variantKey, request.featureKey)
        ) {
          fallbackPacks.push("global");
        }
      }
    }
  }

  return {
    requestedIndustryKey,
    resolvedVerticalKey,
    variantKey,
    featureKey: request.featureKey,
    clientGateApplied: Boolean(gate),
    fallbackPacks,
  };
}

export function applyTenantBinding(binding: TenantBindingSnapshot | null): {
  skip: boolean;
  source: "tenant_fork" | "pinned" | "published_master" | null;
} {
  if (!binding) return { skip: false, source: "published_master" };
  if (!binding.isEnabled || binding.mode === "disabled") return { skip: true, source: null };
  if (binding.mode === "forked" && binding.forkTemplateId) return { skip: false, source: "tenant_fork" };
  if (binding.mode === "pinned" && binding.pinnedVersionId) return { skip: false, source: "pinned" };
  return { skip: false, source: "published_master" };
}

export function bindingFor(
  snapshot: PromptResolveSnapshot,
  tenantId: string,
  featureKey: AiFeatureKey,
  variantKey: AiVariantKey,
  verticalKey: AiPackKey
): TenantBindingSnapshot | null {
  return (
    snapshot.bindings.find(
      (row) =>
        row.tenantId === tenantId &&
        row.featureKey === featureKey &&
        row.variantKey === variantKey &&
        row.verticalKey === verticalKey
    ) ?? null
  );
}

export function industryMapMatchesCanonical(dbMap: Record<string, string>): boolean {
  return Object.entries(INDUSTRY_TO_AI_PACK).every(([key, pack]) => dbMap[key] === pack);
}

export { INDUSTRY_TO_AI_PACK };
