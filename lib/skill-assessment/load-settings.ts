import type { SupabaseClient } from "@supabase/supabase-js";
import { applyPublishedSkillAssessmentToConfig } from "@/lib/skill-assessment/apply-to-config";
import { cloneSkillAssessmentCatalog, normalizeSkillAssessmentCatalog } from "@/lib/skill-assessment/catalog";
import { createDefaultSkillAssessmentCatalog } from "@/lib/skill-assessment/defaults";
import type { SkillAssessmentApplicantSettings, SkillAssessmentCatalog } from "@/lib/skill-assessment/types";
import type { TenantOnboardingConfig } from "@/lib/onboarding/types";

export type TenantSkillAssessmentSettingsRecord = {
  tenantId: string;
  draft: SkillAssessmentCatalog;
  published: SkillAssessmentCatalog | null;
  publishedVersion: number;
  publishedAt: string | null;
  draftUpdatedAt: string | null;
  enabled: boolean;
  allowSkip: boolean;
};

type SettingsRow = {
  tenant_id: string;
  draft: unknown;
  published: unknown;
  published_version: number | null;
  published_at: string | null;
  draft_updated_at: string | null;
  enabled: boolean | null;
  allow_skip: boolean | null;
};

function applicantSettingsFromCatalog(catalog: SkillAssessmentCatalog): SkillAssessmentApplicantSettings {
  return {
    enabled: catalog.enabled,
    allowSkip: catalog.allowSkip,
    showResultsToApplicant: catalog.scoring.showResultsToApplicant,
    passingScore: catalog.scoring.passingScore,
    scoreByCategory: catalog.scoring.scoreByCategory,
    showOverallScore: catalog.scoring.showOverallScore,
  };
}

function fromRow(row: SettingsRow): TenantSkillAssessmentSettingsRecord {
  return {
    tenantId: String(row.tenant_id),
    draft: normalizeSkillAssessmentCatalog(row.draft),
    published: row.published ? normalizeSkillAssessmentCatalog(row.published) : null,
    publishedVersion: Number(row.published_version ?? 0),
    publishedAt: row.published_at ?? null,
    draftUpdatedAt: row.draft_updated_at ?? null,
    enabled: row.enabled !== false,
    allowSkip: row.allow_skip !== false,
  };
}

export async function loadTenantSkillAssessmentSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantSkillAssessmentSettingsRecord> {
  const { data, error } = await supabase
    .from("tenant_skill_assessment_settings")
    .select(
      "tenant_id, draft, published, published_version, published_at, draft_updated_at, enabled, allow_skip"
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw error;
  if (data) return fromRow(data as SettingsRow);

  const draft = createDefaultSkillAssessmentCatalog();
  const now = new Date().toISOString();
  const insert = {
    tenant_id: tenantId,
    draft,
    published: null,
    published_version: 0,
    published_at: null,
    draft_updated_at: now,
    enabled: true,
    allow_skip: true,
  };
  const { data: created, error: insertError } = await supabase
    .from("tenant_skill_assessment_settings")
    .insert(insert)
    .select(
      "tenant_id, draft, published, published_version, published_at, draft_updated_at, enabled, allow_skip"
    )
    .maybeSingle();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: existing, error: existingError } = await supabase
        .from("tenant_skill_assessment_settings")
        .select(
          "tenant_id, draft, published, published_version, published_at, draft_updated_at, enabled, allow_skip"
        )
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) return fromRow(existing as SettingsRow);
    }
    throw insertError;
  }

  if (created) return fromRow(created as SettingsRow);
  return {
    tenantId,
    draft,
    published: null,
    publishedVersion: 0,
    publishedAt: null,
    draftUpdatedAt: now,
    enabled: true,
    allowSkip: true,
  };
}

export async function saveTenantSkillAssessmentDraft(
  supabase: SupabaseClient,
  tenantId: string,
  catalog: SkillAssessmentCatalog
): Promise<TenantSkillAssessmentSettingsRecord> {
  const draft = normalizeSkillAssessmentCatalog(catalog);
  const now = new Date().toISOString();
  await loadTenantSkillAssessmentSettings(supabase, tenantId);
  const { data, error } = await supabase
    .from("tenant_skill_assessment_settings")
    .update({
      draft,
      draft_updated_at: now,
      updated_at: now,
    })
    .eq("tenant_id", tenantId)
    .select(
      "tenant_id, draft, published, published_version, published_at, draft_updated_at, enabled, allow_skip"
    )
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Failed to save assessment draft");
  return fromRow(data as SettingsRow);
}

export async function publishTenantSkillAssessment(
  supabase: SupabaseClient,
  tenantId: string,
  catalog?: SkillAssessmentCatalog
): Promise<TenantSkillAssessmentSettingsRecord> {
  const current = catalog
    ? await saveTenantSkillAssessmentDraft(supabase, tenantId, catalog)
    : await loadTenantSkillAssessmentSettings(supabase, tenantId);
  const published = cloneSkillAssessmentCatalog(current.draft);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("tenant_skill_assessment_settings")
    .update({
      draft: published,
      published,
      published_version: current.publishedVersion + 1,
      published_at: now,
      draft_updated_at: now,
      enabled: published.enabled,
      allow_skip: published.allowSkip,
      updated_at: now,
    })
    .eq("tenant_id", tenantId)
    .select(
      "tenant_id, draft, published, published_version, published_at, draft_updated_at, enabled, allow_skip"
    )
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Failed to publish assessment");
  return fromRow(data as SettingsRow);
}

export function publishedCatalogForApplicants(
  record: TenantSkillAssessmentSettingsRecord
): SkillAssessmentCatalog {
  return record.published ?? createDefaultSkillAssessmentCatalog();
}

export function publishedApplicantSkillAssessmentSettings(
  record: TenantSkillAssessmentSettingsRecord
): SkillAssessmentApplicantSettings {
  const catalog = publishedCatalogForApplicants(record);
  return applicantSettingsFromCatalog(catalog);
}

export async function attachPublishedSkillAssessmentToConfig(
  supabase: SupabaseClient,
  tenantId: string,
  config: TenantOnboardingConfig
): Promise<TenantOnboardingConfig> {
  try {
    const record = await loadTenantSkillAssessmentSettings(supabase, tenantId);
    return applyPublishedSkillAssessmentToConfig(
      config,
      publishedApplicantSkillAssessmentSettings(record)
    );
  } catch (error) {
    console.error("[skill-assessment] attach settings", error);
    return applyPublishedSkillAssessmentToConfig(config, {
      enabled: true,
      allowSkip: true,
      showResultsToApplicant: false,
      passingScore: 70,
      scoreByCategory: true,
      showOverallScore: true,
    });
  }
}
