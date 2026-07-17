import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OnboardingDbClient = SupabaseClient<any, "public", any>;
import type {
  TenantOnboardingConfig,
  TenantOnboardingStep,
  TenantRequiredDocument,
  TenantSkillAssessment,
  TenantSkillQuestion,
} from "@/lib/onboarding/types";
import { buildCacheKey, CACHE_TTL_SECONDS, getOrSetCache, invalidateTenantCache } from "@/lib/cache";
import { enforceUploadResumeFirstInTenantSteps } from "@/lib/onboarding/enforce-upload-resume-first";
import { mapConfigToDrafts } from "@/lib/onboarding/config-to-drafts";
import { ensureProfessionalLicenseRequiredDocuments } from "@/lib/onboarding/ensure-professional-license-documents";
import { enrichTenantConfigFromPublishedFlow } from "@/lib/onboarding/enrich-config-from-published-flow";

export async function seedDefaultTenantOnboarding(
  supabase: OnboardingDbClient,
  tenantId: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc("seed_default_tenant_onboarding", {
    p_tenant_id: tenantId,
  });
  if (error) throw error;
  return data != null ? String(data) : null;
}

export async function loadTenantOnboardingConfig(
  supabase: OnboardingDbClient,
  tenantId: string,
  options?: { workerFacing?: boolean; bypassCache?: boolean }
): Promise<TenantOnboardingConfig | null> {
  const workerFacing = options?.workerFacing ?? false;
  const bypassCache = options?.bypassCache ?? false;

  const loadFresh = async (): Promise<TenantOnboardingConfig | null> => {
    const fresh = await loadTenantOnboardingConfigUncached(supabase, tenantId, { workerFacing });
    if (!fresh || !workerFacing) return fresh;
    return enrichTenantConfigFromPublishedFlow(supabase, tenantId, fresh);
  };

  if (bypassCache) {
    await invalidateTenantCache("tenant_onboarding_configs", tenantId);
    return loadFresh();
  }

  const config = await getOrSetCache(
    buildCacheKey("tenant_onboarding_configs", ["tenant", tenantId], { workerFacing }),
    () => loadTenantOnboardingConfigUncached(supabase, tenantId, { workerFacing }),
    CACHE_TTL_SECONDS.tenantConfig
  );

  if (!config || !workerFacing) return config;
  return enrichTenantConfigFromPublishedFlow(supabase, tenantId, config);
}

async function loadTenantOnboardingConfigUncached(
  supabase: OnboardingDbClient,
  tenantId: string,
  options?: { workerFacing?: boolean }
): Promise<TenantOnboardingConfig | null> {
  const workerFacing = options?.workerFacing ?? false;
  let configId: string | null = null;
  let version = 1;

  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("onboarding_config_version")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantRow && typeof tenantRow === "object") {
    const v = (tenantRow as { onboarding_config_version?: number }).onboarding_config_version;
    if (typeof v === "number") version = v;
  }

  const { data: configRow, error: cfgErr } = await supabase
    .from("tenant_onboarding_configs")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();

  if (cfgErr) throw cfgErr;

  if (!configRow?.id) {
    await seedDefaultTenantOnboarding(supabase, tenantId);
    const { data: retry } = await supabase
      .from("tenant_onboarding_configs")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .maybeSingle();
    configId = retry?.id ? String(retry.id) : null;
  } else {
    configId = String(configRow.id);
  }

  if (!configId) return null;

  let stepsQuery = supabase
    .from("tenant_onboarding_steps")
    .select(
      "id, step_key, title, description, step_type, sort_order, is_required, is_enabled, metadata"
    )
    .eq("onboarding_config_id", configId)
    .order("sort_order", { ascending: true });

  if (workerFacing) {
    stepsQuery = stepsQuery.eq("is_enabled", true);
  }

  let { data: stepsRaw, error: stepsErr } = await stepsQuery;
  if (stepsErr) throw stepsErr;

  if (!(stepsRaw ?? []).length) {
    await seedDefaultTenantOnboarding(supabase, tenantId);
    ({ data: stepsRaw, error: stepsErr } = await stepsQuery);
    if (stepsErr) throw stepsErr;
  }

  let steps: TenantOnboardingStep[] = (stepsRaw ?? []).map((s) => ({
    id: String(s.id),
    step_key: String(s.step_key),
    title: String(s.title),
    description: s.description != null ? String(s.description) : null,
    step_type: s.step_type as TenantOnboardingStep["step_type"],
    sort_order: Number(s.sort_order),
    is_required: Boolean(s.is_required),
    is_enabled: Boolean(s.is_enabled),
    metadata: (s.metadata as Record<string, unknown>) ?? {},
  }));

  const { steps: normalizedSteps, changed: resumeOrderChanged } =
    enforceUploadResumeFirstInTenantSteps(steps);
  steps = normalizedSteps;

  const licenseDocsSeeded = await ensureProfessionalLicenseRequiredDocuments(
    supabase,
    tenantId,
    steps
  );
  if (licenseDocsSeeded) {
    await invalidateTenantCache("tenant_required_documents", tenantId);
  }

  const stepIds = steps.map((s) => s.id);

  const { data: docsRaw, error: docsErr } = await supabase
    .from("tenant_required_documents")
    .select(
      "id, onboarding_step_id, title, description, is_required, sort_order, accepted_file_types, max_file_size_mb"
    )
    .eq("tenant_id", tenantId)
    .in("onboarding_step_id", stepIds.length ? stepIds : ["00000000-0000-0000-0000-000000000000"])
    .order("sort_order", { ascending: true });

  if (docsErr) throw docsErr;

  const requiredDocuments: TenantRequiredDocument[] = (docsRaw ?? []).map((d) => ({
    id: String(d.id),
    onboarding_step_id: String(d.onboarding_step_id),
    title: String(d.title),
    description: d.description != null ? String(d.description) : null,
    is_required: Boolean(d.is_required),
    sort_order: Number(d.sort_order),
    accepted_file_types: Array.isArray(d.accepted_file_types)
      ? (d.accepted_file_types as string[])
      : ["application/pdf", "image/jpeg", "image/png"],
    max_file_size_mb: Number(d.max_file_size_mb) || 10,
  }));

  let assessmentsQuery = supabase
    .from("tenant_skill_assessments")
    .select("id, onboarding_step_id, title, description, is_enabled")
    .eq("tenant_id", tenantId)
    .in("onboarding_step_id", stepIds.length ? stepIds : ["00000000-0000-0000-0000-000000000000"]);

  if (workerFacing) {
    assessmentsQuery = assessmentsQuery.eq("is_enabled", true);
  }

  const { data: assessmentsRaw, error: assErr } = await assessmentsQuery;
  if (assErr) throw assErr;

  const assessmentIds = (assessmentsRaw ?? []).map((a) => String(a.id));

  let questionsSelect =
    "id, assessment_id, question_text, question_type, options, is_required, sort_order, points";
  if (workerFacing) {
    questionsSelect =
      "id, assessment_id, question_text, question_type, options, is_required, sort_order, points";
  }

  const { data: questionsRaw, error: qErr } = await supabase
    .from("tenant_skill_assessment_questions")
    .select(questionsSelect)
    .eq("tenant_id", tenantId)
    .in(
      "assessment_id",
      assessmentIds.length ? assessmentIds : ["00000000-0000-0000-0000-000000000000"]
    )
    .order("sort_order", { ascending: true });

  if (qErr) throw qErr;

  type QuestionRow = {
    id: string;
    assessment_id: string;
    question_text: string;
    question_type: string;
    options: unknown;
    is_required: boolean;
    sort_order: number;
    points: number;
  };

  const questionsByAssessment = new Map<string, TenantSkillQuestion[]>();
  for (const q of (questionsRaw ?? []) as unknown as QuestionRow[]) {
    const aid = String(q.assessment_id);
    const list = questionsByAssessment.get(aid) ?? [];
    list.push({
      id: String(q.id),
      assessment_id: aid,
      question_text: String(q.question_text),
      question_type: String(q.question_type),
      options: q.options,
      is_required: Boolean(q.is_required),
      sort_order: Number(q.sort_order),
      points: Number(q.points) || 1,
    });
    questionsByAssessment.set(aid, list);
  }

  const skillAssessments: TenantSkillAssessment[] = (assessmentsRaw ?? []).map((a) => ({
    id: String(a.id),
    onboarding_step_id: String(a.onboarding_step_id),
    title: String(a.title),
    description: a.description != null ? String(a.description) : null,
    is_enabled: Boolean(a.is_enabled),
    questions: questionsByAssessment.get(String(a.id)) ?? [],
  }));

  const config: TenantOnboardingConfig = {
    configId,
    tenantId,
    version,
    steps,
    requiredDocuments,
    skillAssessments,
  };

  if (resumeOrderChanged) {
    try {
      const { persistTenantOnboardingConfig } = await import(
        "@/lib/onboarding/persist-tenant-onboarding-config"
      );
      await persistTenantOnboardingConfig(supabase, tenantId, mapConfigToDrafts(config), {
        configId,
      });
    } catch (err) {
      console.warn("[loadTenantOnboardingConfig] upload resume normalization persist failed", err);
    }
  }

  return config;
}
