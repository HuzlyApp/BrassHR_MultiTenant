import type { AiPackKey, UserFacingIndustryKey } from "./industry-catalog";

export const AI_FEATURE_KEYS = [
  "candidate_match",
  "job_description",
  "resume_refine",
  "rate_strategy",
  "content_draft",
] as const;
export type AiFeatureKey = (typeof AI_FEATURE_KEYS)[number];

export const AI_VARIANT_KEYS = ["default", "deep", "client_gate"] as const;
export type AiVariantKey = (typeof AI_VARIANT_KEYS)[number];

export const AI_PROMPT_STATUSES = ["draft", "published", "retired"] as const;
export type AiPromptStatus = (typeof AI_PROMPT_STATUSES)[number];

export const AI_BINDING_MODES = ["inherited", "pinned", "forked", "disabled"] as const;
export type AiBindingMode = (typeof AI_BINDING_MODES)[number];

export const AI_PROMPT_RUN_STATUSES = [
  "success",
  "failed",
  "skipped_no_prompt",
  "skipped_budget",
] as const;
export type AiPromptRunStatus = (typeof AI_PROMPT_RUN_STATUSES)[number];

export type AiModelConfig = {
  provider?: string;
  model?: string;
  temperature?: number;
  base_max_tokens?: number;
  long_resume_max_tokens?: number;
  long_resume_chars?: number;
  [key: string]: unknown;
};

export type ResolvedPromptVersion = {
  promptVersionId: string;
  templateId: string;
  featureKey: AiFeatureKey;
  variantKey: AiVariantKey;
  requestedIndustryKey: string | null;
  resolvedVerticalKey: AiPackKey;
  contentHash: string;
  systemPrompt: string;
  userPromptTemplate: string;
  responseSchema: Record<string, unknown>;
  modelConfig: AiModelConfig;
  status: AiPromptStatus;
  versionNumber: number;
  source: "tenant_fork" | "pinned" | "published_master" | "fallback";
  fallbackApplied: boolean;
};

export type PromptResolveRequest = {
  tenantId: string;
  featureKey: AiFeatureKey;
  variantKey: AiVariantKey;
  industryKey?: string | null;
  tenantPrimaryIndustryKey?: string | null;
  clientAccountId?: string | null;
  clientName?: string | null;
  sourceKey?: string | null;
  asOf?: Date;
};

export type PromptResolveSnapshot = {
  industryToPack: Record<string, AiPackKey>;
  publishedPacks: Set<string>;
  bindings: TenantBindingSnapshot[];
  clientGates: ClientGateSnapshot[];
};

export type TenantBindingSnapshot = {
  tenantId: string;
  featureKey: AiFeatureKey;
  variantKey: AiVariantKey;
  verticalKey: AiPackKey;
  mode: AiBindingMode;
  isEnabled: boolean;
  pinnedVersionId: string | null;
  forkTemplateId: string | null;
};

export type ClientGateSnapshot = {
  tenantId: string | null;
  matchType: "client_name" | "source_key" | "client_account_id";
  matchValue: string;
  featureKey: AiFeatureKey;
  variantKey: AiVariantKey;
  verticalKeyOverride: AiPackKey | null;
  isActive: boolean;
  priority: number;
};

export type PromptRunInsert = {
  tenantId: string;
  featureKey: AiFeatureKey;
  variantKey: AiVariantKey;
  verticalKey: AiPackKey | null;
  industryKey: string | null;
  promptVersionId: string | null;
  contentHash: string | null;
  entityType: string;
  entityId: string;
  inputHash: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  creditCost: number | null;
  status: AiPromptRunStatus;
  errorCode: string | null;
  outputReference: string | null;
  requestedBy: string | null;
};

export type PromptTemplateVariables = Record<string, string | null | undefined>;

export type UserFacingIndustrySelection = {
  industryKey: UserFacingIndustryKey;
  isPrimary: boolean;
};
