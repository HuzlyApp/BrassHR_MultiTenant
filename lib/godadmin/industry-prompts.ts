/**
 * Industry Prompts (God Admin) — shared types, validation, and catalog helpers.
 * Runtime analysis continues to resolve prompts via lib/ai-catalog (same DB rows).
 */

import {
  AI_PACK_LABELS,
  CANDIDATE_MATCH_PACK_KEYS,
  INDUSTRY_CATALOG,
  mapIndustryKeyToAiPack,
  type CandidateMatchPackKey,
  type UserFacingIndustryKey,
} from "@/lib/ai-catalog/industry-catalog";
import { extractTemplateVariables } from "@/lib/ai-catalog/render-prompt";
import type { AiVariantKey } from "@/lib/ai-catalog/types";

export const INDUSTRY_PROMPT_FEATURE_KEY = "candidate_match" as const;

/** Progression steps managed in Industry Prompts UI. */
export const INDUSTRY_PROMPT_VARIANTS = [
  "quick",
  "call_pack",
  "follow_up",
  "deep",
  "submission",
] as const satisfies readonly AiVariantKey[];

export type IndustryPromptVariantKey = (typeof INDUSTRY_PROMPT_VARIANTS)[number];

export const INDUSTRY_PROMPT_VARIANT_LABELS: Record<IndustryPromptVariantKey, string> = {
  quick: "Step 1 · Quick Match",
  call_pack: "Step 2 · Verifications",
  follow_up: "Step 3 · Follow-Up",
  deep: "Step 4 · Deep Match",
  submission: "Step 5 · Submission Résumé",
};

/** Documented `{{placeholders}}` by progression variant. */
export const INDUSTRY_PROMPT_SUPPORTED_VARIABLES: Record<
  IndustryPromptVariantKey,
  readonly { name: string; description: string }[]
> = {
  quick: [
    { name: "job_id", description: "Job identifier" },
    { name: "job_title", description: "Job title" },
    { name: "msp_or_client", description: "MSP or client name" },
    { name: "specialty", description: "Specialty / discipline" },
    { name: "location", description: "Job location" },
    { name: "recent_experience_months", description: "Recent-experience window in months" },
    { name: "mandatory_requirements", description: "Mandatory requirement bullets" },
    { name: "preferred_requirements", description: "Preferred requirement bullets" },
    { name: "required_licenses", description: "Required licenses" },
    { name: "required_certifications", description: "Required certifications" },
    { name: "education_requirements", description: "Education requirements" },
    { name: "required_years_experience", description: "Years of experience requirement" },
    { name: "job_description", description: "Full job description (untrusted data)" },
    { name: "candidate_resume", description: "Candidate résumé text (untrusted data)" },
    { name: "verified_recruiter_info", description: "Verified recruiter JSON" },
    { name: "recruiter_notes", description: "Recruiter notes (untrusted data)" },
    { name: "candidate_name", description: "Candidate display name (optional)" },
  ],
  call_pack: [
    { name: "job_id", description: "Job identifier" },
    { name: "job_title", description: "Job title" },
    { name: "msp_or_client", description: "MSP or client name" },
    { name: "specialty", description: "Specialty / discipline" },
    { name: "location", description: "Job location" },
    { name: "recent_experience_months", description: "Recent-experience window in months" },
    { name: "mandatory_requirements", description: "Mandatory requirement bullets" },
    { name: "preferred_requirements", description: "Preferred requirement bullets" },
    { name: "required_licenses", description: "Required licenses" },
    { name: "required_certifications", description: "Required certifications" },
    { name: "education_requirements", description: "Education requirements" },
    { name: "required_years_experience", description: "Years of experience requirement" },
    { name: "job_description", description: "Full job description (untrusted data)" },
    { name: "candidate_resume", description: "Candidate résumé text (untrusted data)" },
    { name: "verified_recruiter_info", description: "Verified recruiter JSON" },
    { name: "recruiter_notes", description: "Recruiter notes (untrusted data)" },
    { name: "candidate_name", description: "Candidate display name (optional)" },
  ],
  follow_up: [
    { name: "job_title", description: "Job title" },
    { name: "qualification_checklist", description: "Formatted qualification checklist" },
    { name: "enrichment_notes", description: "Recruiter enrichment notes" },
  ],
  deep: [
    { name: "job_id", description: "Job identifier" },
    { name: "job_title", description: "Job title" },
    { name: "msp_or_client", description: "MSP or client name" },
    { name: "specialty", description: "Specialty / discipline" },
    { name: "location", description: "Job location" },
    { name: "recent_experience_months", description: "Recent-experience window in months" },
    { name: "mandatory_requirements", description: "Mandatory requirement bullets" },
    { name: "preferred_requirements", description: "Preferred requirement bullets" },
    { name: "required_licenses", description: "Required licenses" },
    { name: "required_certifications", description: "Required certifications" },
    { name: "education_requirements", description: "Education requirements" },
    { name: "required_years_experience", description: "Years of experience requirement" },
    { name: "job_description", description: "Full job description (untrusted data)" },
    { name: "candidate_resume", description: "Candidate résumé text (untrusted data)" },
    { name: "verified_recruiter_info", description: "Verified recruiter JSON" },
    { name: "recruiter_notes", description: "Recruiter notes (untrusted data)" },
    { name: "candidate_name", description: "Candidate display name (optional)" },
  ],
  submission: [
    { name: "job_title", description: "Job title" },
    { name: "candidate_name", description: "Candidate name" },
    { name: "candidate_contact", description: "Email | phone | location" },
    { name: "recruiter_summary", description: "Recruiter summary" },
    { name: "confirmed_evidence", description: "Confirmed evidence bullets" },
    { name: "strengths", description: "Strength bullets" },
    { name: "enrichment_notes", description: "Enrichment notes" },
    { name: "candidate_resume", description: "Source résumé text (untrusted data)" },
  ],
};

export type IndustryPromptConfigStatus =
  | "dedicated"
  | "partial"
  | "fallback_global"
  | "missing";

export type IndustryPromptListItem = {
  industryKey: UserFacingIndustryKey;
  label: string;
  aiPackKey: CandidateMatchPackKey | string;
  aiPackLabel: string;
  sharesPackWith: { key: string; label: string }[];
  configStatus: IndustryPromptConfigStatus;
  configuredVariantCount: number;
  totalVariantCount: number;
  activeVersionSummary: string | null;
};

export type IndustryPromptVersionSummary = {
  id: string;
  templateId: string;
  versionNumber: number;
  status: "draft" | "published" | "retired";
  isCurrent: boolean;
  changeReason: string | null;
  contentHash: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  createdBy: string | null;
  publishedBy: string | null;
  actorLabel: string | null;
  sourceVersionId: string | null;
  eventLabel: "created" | "updated" | "activated" | "restored" | "retired" | "draft";
};

export type IndustryPromptVersionDetail = IndustryPromptVersionSummary & {
  systemPrompt: string;
  userPromptTemplate: string;
  responseSchema: Record<string, unknown>;
  modelConfig: Record<string, unknown>;
  featureKey: string;
  variantKey: IndustryPromptVariantKey | string;
  verticalKey: string;
};

export function isIndustryPromptVariantKey(value: string): value is IndustryPromptVariantKey {
  return (INDUSTRY_PROMPT_VARIANTS as readonly string[]).includes(value);
}

export function isCandidateMatchPackKey(value: string): value is CandidateMatchPackKey {
  return (CANDIDATE_MATCH_PACK_KEYS as readonly string[]).includes(value);
}

export function industriesSharingPack(packKey: string): { key: string; label: string }[] {
  return INDUSTRY_CATALOG.filter((entry) => entry.aiPackKey === packKey).map((entry) => ({
    key: entry.key,
    label: entry.label,
  }));
}

export function classifyPackConfigStatus(input: {
  packKey: string;
  dedicatedCurrentVariantCount: number;
  globalHasAnyCurrent: boolean;
}): IndustryPromptConfigStatus {
  const total = INDUSTRY_PROMPT_VARIANTS.length;
  if (input.dedicatedCurrentVariantCount >= total) return "dedicated";
  if (input.dedicatedCurrentVariantCount > 0) return "partial";
  if (input.packKey === "global") {
    return input.globalHasAnyCurrent ? "dedicated" : "missing";
  }
  return input.globalHasAnyCurrent ? "fallback_global" : "missing";
}

export function configStatusLabel(status: IndustryPromptConfigStatus): string {
  switch (status) {
    case "dedicated":
      return "Dedicated prompt";
    case "partial":
      return "Partially configured";
    case "fallback_global":
      return "Uses Global fallback";
    case "missing":
      return "Not configured";
  }
}

export function buildIndustryPromptListItems(
  currentByPackVariant: Map<string, { versionNumber: number; publishedAt: string | null }>
): IndustryPromptListItem[] {
  const globalCount = INDUSTRY_PROMPT_VARIANTS.filter((variant) =>
    currentByPackVariant.has(`global:${variant}`)
  ).length;

  return INDUSTRY_CATALOG.map((entry) => {
    const packKey = entry.aiPackKey;
    const configuredVariantCount = INDUSTRY_PROMPT_VARIANTS.filter((variant) =>
      currentByPackVariant.has(`${packKey}:${variant}`)
    ).length;
    const configStatus = classifyPackConfigStatus({
      packKey,
      dedicatedCurrentVariantCount: configuredVariantCount,
      globalHasAnyCurrent: globalCount > 0,
    });
    const peers = industriesSharingPack(packKey).filter((peer) => peer.key !== entry.key);
    const primaryVariant =
      INDUSTRY_PROMPT_VARIANTS.map((variant) => currentByPackVariant.get(`${packKey}:${variant}`)).find(
        Boolean
      ) ??
      (packKey !== "global"
        ? INDUSTRY_PROMPT_VARIANTS.map((variant) =>
            currentByPackVariant.get(`global:${variant}`)
          ).find(Boolean)
        : undefined);
    return {
      industryKey: entry.key,
      label: entry.label,
      aiPackKey: packKey,
      aiPackLabel: AI_PACK_LABELS[packKey] ?? packKey,
      sharesPackWith: peers,
      configStatus,
      configuredVariantCount,
      totalVariantCount: INDUSTRY_PROMPT_VARIANTS.length,
      activeVersionSummary: primaryVariant
        ? `Active v${primaryVariant.versionNumber}${
            primaryVariant.publishedAt ? ` · activated ${primaryVariant.publishedAt}` : ""
          }`
        : null,
    };
  });
}

export type PromptBodyValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  variablesUsed: string[];
  unknownVariables: string[];
};

export function validateIndustryPromptBody(input: {
  systemPrompt: string;
  userPromptTemplate: string;
  variantKey: IndustryPromptVariantKey;
}): PromptBodyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const system = input.systemPrompt ?? "";
  const user = input.userPromptTemplate ?? "";

  if (!system.trim()) {
    errors.push("System prompt cannot be blank.");
  }
  if (!user.trim()) {
    errors.push("User prompt template cannot be blank.");
  }

  const variablesUsed = [
    ...new Set([...extractTemplateVariables(system), ...extractTemplateVariables(user)]),
  ].sort();
  const allowed = new Set(
    INDUSTRY_PROMPT_SUPPORTED_VARIABLES[input.variantKey].map((item) => item.name)
  );
  const unknownVariables = variablesUsed.filter((name) => !allowed.has(name));
  if (unknownVariables.length) {
    errors.push(
      `Unsupported placeholder${unknownVariables.length === 1 ? "" : "s"}: ${unknownVariables
        .map((name) => `{{${name}}}`)
        .join(", ")}. Remove or replace them — supported variables are documented for this step.`
    );
  }

  if (system.trim().length > 0 && system.trim().length < 40) {
    warnings.push("System prompt looks unusually short for a Candidate–Job Analyzer assessment.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    variablesUsed,
    unknownVariables,
  };
}

export function parseIndustryPromptSavePayload(body: unknown): {
  industryKey: string;
  variantKey: IndustryPromptVariantKey;
  systemPrompt: string;
  userPromptTemplate: string;
  changeNote: string;
  responseSchema: Record<string, unknown>;
  modelConfig: Record<string, unknown>;
} | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body." };
  const record = body as Record<string, unknown>;
  const industryKey = String(record.industryKey ?? "").trim();
  const variantRaw = String(record.variantKey ?? "").trim();
  const systemPrompt = typeof record.systemPrompt === "string" ? record.systemPrompt : "";
  const userPromptTemplate =
    typeof record.userPromptTemplate === "string" ? record.userPromptTemplate : "";
  const changeNote = String(record.changeNote ?? record.changeReason ?? "").trim();

  if (!industryKey) return { error: "industryKey is required." };
  if (!mapIndustryKeyToAiPack(industryKey) && industryKey !== "global") {
    return { error: `Unsupported industry key: ${industryKey}` };
  }
  if (!isIndustryPromptVariantKey(variantRaw)) {
    return { error: `Unsupported variantKey: ${variantRaw}` };
  }
  if (!changeNote) return { error: "A change note is required." };

  let responseSchema: Record<string, unknown> = {};
  let modelConfig: Record<string, unknown> = {};
  if (record.responseSchema != null) {
    if (typeof record.responseSchema !== "object" || Array.isArray(record.responseSchema)) {
      return { error: "responseSchema must be a JSON object." };
    }
    responseSchema = record.responseSchema as Record<string, unknown>;
  }
  if (record.modelConfig != null) {
    if (typeof record.modelConfig !== "object" || Array.isArray(record.modelConfig)) {
      return { error: "modelConfig must be a JSON object." };
    }
    modelConfig = record.modelConfig as Record<string, unknown>;
  }

  const validation = validateIndustryPromptBody({
    systemPrompt,
    userPromptTemplate,
    variantKey: variantRaw,
  });
  if (!validation.ok) {
    return { error: validation.errors.join(" ") };
  }

  return {
    industryKey,
    variantKey: variantRaw,
    systemPrompt,
    userPromptTemplate,
    changeNote,
    responseSchema,
    modelConfig,
  };
}

export function versionEventLabel(input: {
  status: string;
  isCurrent: boolean;
  sourceVersionId: string | null;
  changeReason: string | null;
}): IndustryPromptVersionSummary["eventLabel"] {
  if (input.status === "draft") return "draft";
  if (input.status === "retired") return "retired";
  const reason = (input.changeReason ?? "").toLowerCase();
  if (input.sourceVersionId && (reason.includes("restor") || reason.startsWith("restore"))) {
    return "restored";
  }
  if (input.isCurrent) return "activated";
  if (input.sourceVersionId) return "updated";
  return "created";
}

export function formatActorName(user: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
} | null): string | null {
  if (!user) return null;
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  if (name) return name;
  return user.email?.trim() || null;
}

export function packKeyForIndustry(industryKey: string): CandidateMatchPackKey | null {
  if (industryKey === "global") return "global";
  const pack = mapIndustryKeyToAiPack(industryKey);
  if (!pack || !isCandidateMatchPackKey(pack)) return null;
  return pack;
}
