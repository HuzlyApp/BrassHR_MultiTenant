import "server-only";

import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";
import { loadTenantOnboardingConfig, seedDefaultTenantOnboarding } from "@/lib/onboarding/load-tenant-config";
import {
  reindexStepSortOrders,
  type OnboardingStepDraft,
} from "@/lib/onboarding/default-onboarding-steps";
import { invalidateTenantCache } from "@/lib/cache";

export type PersistStepInput = OnboardingStepDraft;

async function syncStepDocuments(
  supabase: OnboardingDbClient,
  tenantId: string,
  stepId: string,
  step: PersistStepInput
): Promise<void> {
  const docsToSync = (step.required_documents ?? []).filter((d) => d.title.trim().length > 0);

  if (
    !docsToSync.length ||
    !(
      step.step_type === "document_upload" ||
      step.step_type === "authorizations" ||
      step.step_type === "professional_license"
    )
  ) {
    return;
  }

  const { data: existingDocs } = await supabase
    .from("tenant_required_documents")
    .select("id, title")
    .eq("onboarding_step_id", stepId);

  const keepTitles = new Set(docsToSync.map((d) => d.title.trim().toLowerCase()));

  await Promise.all(
    (existingDocs ?? [])
      .filter((doc) => !keepTitles.has(String(doc.title).trim().toLowerCase()))
      .map((doc) => supabase.from("tenant_required_documents").delete().eq("id", doc.id))
  );

  await Promise.all(
    docsToSync.map(async (doc) => {
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
        return;
      }

      await supabase.from("tenant_required_documents").insert({
        tenant_id: tenantId,
        onboarding_step_id: stepId,
        title,
        description: doc.description?.trim() || null,
        is_required: doc.is_required ?? true,
        sort_order: doc.sort_order ?? 0,
      });
    })
  );
}

export async function persistTenantOnboardingConfig(
  supabase: OnboardingDbClient,
  tenantId: string,
  steps: PersistStepInput[],
  options?: { configId?: string }
): Promise<{ configId: string }> {
  if (!steps.length) {
    throw new Error("At least one onboarding step is required");
  }

  const normalizedSteps = reindexStepSortOrders(steps);
  const now = new Date().toISOString();

  let configId = options?.configId ?? (await loadTenantOnboardingConfig(supabase, tenantId))?.configId;
  if (!configId) {
    configId = (await seedDefaultTenantOnboarding(supabase, tenantId)) ?? undefined;
  }
  if (!configId) {
    throw new Error("Could not resolve onboarding config");
  }

  const incomingKeys = new Set(normalizedSteps.map((s) => s.step_key));

  const { data: existingSteps, error: existingErr } = await supabase
    .from("tenant_onboarding_steps")
    .select("id, step_key")
    .eq("onboarding_config_id", configId);

  if (existingErr) throw existingErr;

  const existingRows = existingSteps ?? [];

  // Clear unique (onboarding_config_id, sort_order) slots before applying final order.
  await Promise.all(
    existingRows.map((row, i) =>
      supabase
        .from("tenant_onboarding_steps")
        .update({
          sort_order: 100_000 + i,
          updated_at: now,
        })
        .eq("id", row.id)
    )
  );

  const removedRows = existingRows.filter((existing) => !incomingKeys.has(String(existing.step_key)));

  await Promise.all(
    removedRows.map(async (existing, index) => {
      const stepId = String(existing.id);
      await supabase.from("tenant_required_documents").delete().eq("onboarding_step_id", stepId);
      await supabase
        .from("tenant_onboarding_steps")
        .update({
          is_enabled: false,
          sort_order: 200_000 + index,
          updated_at: now,
        })
        .eq("id", stepId);
    })
  );

  await Promise.all(
    normalizedSteps.map(async (step) => {
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
            updated_at: now,
          },
          { onConflict: "onboarding_config_id,step_key" }
        )
        .select("id")
        .single();

      if (stepErr) throw stepErr;
      await syncStepDocuments(supabase, tenantId, String(stepRow.id), step);
    })
  );

  const { data: tenantRow, error: versionReadErr } = await supabase
    .from("tenants")
    .select("onboarding_config_version")
    .eq("id", tenantId)
    .maybeSingle();

  if (versionReadErr) throw versionReadErr;

  const nextVersion = Math.max(1, Number(tenantRow?.onboarding_config_version ?? 0) + 1);

  const { error: tenantErr } = await supabase
    .from("tenants")
    .update({
      onboarding_config_version: nextVersion,
      updated_at: now,
    })
    .eq("id", tenantId);

  if (tenantErr) throw tenantErr;

  await Promise.all([
    invalidateTenantCache("tenant_onboarding_configs", tenantId),
    invalidateTenantCache("tenant_onboarding_steps", tenantId),
    invalidateTenantCache("tenant_required_documents", tenantId),
    invalidateTenantCache("tenant_skill_assessments", tenantId),
    invalidateTenantCache("tenant_skill_assessment_questions", tenantId),
  ]);

  return { configId };
}
