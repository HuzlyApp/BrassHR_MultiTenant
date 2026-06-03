import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";
import { loadTenantOnboardingConfig, seedDefaultTenantOnboarding } from "@/lib/onboarding/load-tenant-config";
import {
  reindexStepSortOrders,
  type OnboardingStepDraft,
} from "@/lib/onboarding/default-onboarding-steps";
import { invalidateTenantCache } from "@/lib/cache";

export type PersistStepInput = OnboardingStepDraft;

export async function persistTenantOnboardingConfig(
  supabase: OnboardingDbClient,
  tenantId: string,
  steps: PersistStepInput[]
): Promise<{ configId: string }> {
  if (!steps.length) {
    throw new Error("At least one onboarding step is required");
  }

  const normalizedSteps = reindexStepSortOrders(steps);

  let configId = (await loadTenantOnboardingConfig(supabase, tenantId))?.configId;
  if (!configId) {
    configId = (await seedDefaultTenantOnboarding(supabase, tenantId)) ?? undefined;
  }
  if (!configId) {
    throw new Error("Could not resolve onboarding config");
  }

  const incomingKeys = new Set(normalizedSteps.map((s) => s.step_key));

  const { data: existingSteps } = await supabase
    .from("tenant_onboarding_steps")
    .select("id, step_key")
    .eq("onboarding_config_id", configId);

  // Clear unique (onboarding_config_id, sort_order) slots before applying final order.
  // Disabled seeded steps otherwise keep sort_order 20/30/etc. and block upserts.
  for (let i = 0; i < (existingSteps ?? []).length; i++) {
    const row = existingSteps![i];
    await supabase
      .from("tenant_onboarding_steps")
      .update({
        sort_order: 100_000 + i,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  }

  let disabledSortBase = 200_000;
  for (const existing of existingSteps ?? []) {
    const key = String(existing.step_key);
    const stepId = String(existing.id);
    if (!incomingKeys.has(key)) {
      await supabase.from("tenant_required_documents").delete().eq("onboarding_step_id", stepId);
      await supabase
        .from("tenant_onboarding_steps")
        .update({
          is_enabled: false,
          sort_order: disabledSortBase++,
          updated_at: new Date().toISOString(),
        })
        .eq("id", stepId);
    }
  }

  for (const step of normalizedSteps) {
    const { data: stepRow, error: stepErr } = await supabase
      .from("tenant_onboarding_steps")
      .upsert(
        {
          onboarding_config_id: configId,
          tenant_id: tenantId,
          step_key: step.step_key,
          title: step.title.trim() || step.step_key,
          description: step.description?.trim() || null,
          step_type: step.step_type,
          sort_order: step.sort_order,
          is_required: step.is_required,
          is_enabled: step.is_enabled,
          metadata: step.metadata ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "onboarding_config_id,step_key" }
      )
      .select("id")
      .single();

    if (stepErr) throw stepErr;
    const stepId = String(stepRow.id);

    const docsToSync = (step.required_documents ?? []).filter((d) => d.title.trim().length > 0);

    if (
      docsToSync.length &&
      (step.step_type === "document_upload" ||
        step.step_type === "authorizations" ||
        step.step_type === "professional_license")
    ) {
      const { data: existingDocs } = await supabase
        .from("tenant_required_documents")
        .select("id, title")
        .eq("onboarding_step_id", stepId);

      const keepTitles = new Set(docsToSync.map((d) => d.title.trim().toLowerCase()));

      for (const doc of existingDocs ?? []) {
        if (!keepTitles.has(String(doc.title).trim().toLowerCase())) {
          await supabase.from("tenant_required_documents").delete().eq("id", doc.id);
        }
      }

      for (const doc of docsToSync) {
        const title = doc.title.trim();

        const match = (existingDocs ?? []).find(
          (d) => String(d.title).trim().toLowerCase() === title.toLowerCase()
        );

        if (match?.id) {
          await supabase
            .from("tenant_required_documents")
            .update({
              description: doc.description?.trim() || null,
              is_required: doc.is_required ?? true,
              sort_order: doc.sort_order ?? 0,
              updated_at: new Date().toISOString(),
            })
            .eq("id", match.id);
        } else {
          await supabase.from("tenant_required_documents").insert({
            tenant_id: tenantId,
            onboarding_step_id: stepId,
            title,
            description: doc.description?.trim() || null,
            is_required: doc.is_required ?? true,
            sort_order: doc.sort_order ?? 0,
          });
        }
      }
    }
  }

  await supabase
    .from("tenants")
    .update({
      onboarding_config_version: 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);

  await Promise.all([
    invalidateTenantCache("tenant_onboarding_configs", tenantId),
    invalidateTenantCache("tenant_onboarding_steps", tenantId),
    invalidateTenantCache("tenant_required_documents", tenantId),
    invalidateTenantCache("tenant_skill_assessments", tenantId),
    invalidateTenantCache("tenant_skill_assessment_questions", tenantId),
  ]);

  return { configId };
}
