import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";
import {
  isSerializableWorkflowState,
  type SerializableWorkflowState,
} from "@/lib/onboarding/workflow-builder-serialization";
import type { BuilderMeta } from "@/lib/onboarding/drafts-to-workflow";

export async function loadOnboardingBuilderMeta(
  supabase: OnboardingDbClient,
  tenantId: string
): Promise<BuilderMeta> {
  const { data, error } = await supabase
    .from("tenant_onboarding_configs")
    .select("flow_name, publish_status, builder_draft, updated_at, updated_by")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;

  const draftRaw = data?.builder_draft;
  const builderDraft = isSerializableWorkflowState(draftRaw) ? draftRaw : null;

  const status = String(data?.publish_status ?? "published");
  const publishStatus = status === "draft" ? "draft" : "published";

  return {
    flowName: String(data?.flow_name ?? "Worker onboarding").trim() || "Worker onboarding",
    publishStatus,
    builderDraft,
    updatedAt: data?.updated_at != null ? String(data.updated_at) : null,
    updatedBy: data?.updated_by != null ? String(data.updated_by) : null,
  };
}

export async function saveOnboardingBuilderDraft(
  supabase: OnboardingDbClient,
  tenantId: string,
  input: {
    flowName?: string;
    builderDraft: SerializableWorkflowState;
    updatedBy: string;
    publishStatus?: "draft" | "published";
  }
): Promise<void> {
  const { data: configRow } = await supabase
    .from("tenant_onboarding_configs")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();

  if (!configRow?.id) {
    throw new Error("Onboarding config not found for tenant");
  }

  const patch: Record<string, unknown> = {
    builder_draft: input.builderDraft,
    updated_by: input.updatedBy,
    updated_at: new Date().toISOString(),
    publish_status: input.publishStatus ?? "draft",
  };

  if (input.flowName?.trim()) {
    patch.flow_name = input.flowName.trim();
  }

  const { error } = await supabase
    .from("tenant_onboarding_configs")
    .update(patch)
    .eq("id", configRow.id);

  if (error) throw error;
}

export async function markOnboardingFlowPublished(
  supabase: OnboardingDbClient,
  tenantId: string,
  updatedBy: string
): Promise<void> {
  const { data: configRow } = await supabase
    .from("tenant_onboarding_configs")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();

  if (!configRow?.id) {
    throw new Error("Onboarding config not found for tenant");
  }

  const { error } = await supabase
    .from("tenant_onboarding_configs")
    .update({
      publish_status: "published",
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", configRow.id);

  if (error) throw error;
}
