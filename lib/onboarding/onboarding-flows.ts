import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";
import {
  isSerializableWorkflowState,
  type SerializableWorkflowState,
} from "@/lib/onboarding/workflow-builder-serialization";
import { workflowTemplateDraft, getWorkflowTemplateById } from "@/lib/onboarding/workflow-templates";
import {
  loadFlowBuilderDraft,
  replaceFlowStepsFromDraft,
} from "@/lib/onboarding/flow-steps-sync";
import { normalizeFlowNameKey } from "@/lib/onboarding/validate-flow-name";
import { resolveOnboardingLibraryForFlows } from "@/lib/onboarding/onboarding-libraries";
import { createDefaultWorkflowState } from "@/lib/onboarding/default-workflow";

export type OnboardingFlowStatus = "draft" | "published" | "unpublished";

export type OnboardingFlowRow = {
  id: string;
  tenant_id: string;
  library_id: string | null;
  template_id: string | null;
  name: string;
  status: OnboardingFlowStatus;
  created_as_blank: boolean;
  builder_draft: SerializableWorkflowState;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OnboardingFlowListItem = {
  id: string;
  name: string;
  status: OnboardingFlowStatus;
  libraryId: string | null;
  templateId: string | null;
  createdAsBlank: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OnboardingFlowDetail = OnboardingFlowListItem & {
  builderDraft: SerializableWorkflowState;
  createdBy: string | null;
  updatedBy: string | null;
};

function parseDraft(raw: unknown): SerializableWorkflowState {
  if (isSerializableWorkflowState(raw)) return raw;
  return { nodes: [], edges: [] };
}

function toListItem(row: OnboardingFlowRow): OnboardingFlowListItem {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    libraryId: row.library_id,
    templateId: row.template_id,
    createdAsBlank: row.created_as_blank,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDetail(row: OnboardingFlowRow): OnboardingFlowDetail {
  return {
    ...toListItem(row),
    builderDraft: parseDraft(row.builder_draft),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  };
}

export function isPublishedFlowStatus(status: OnboardingFlowStatus): boolean {
  return status === "published";
}

export async function findDuplicateOnboardingFlowName(
  supabase: OnboardingDbClient,
  tenantId: string,
  name: string,
  opts?: { excludeFlowId?: string }
): Promise<string | null> {
  const normalized = normalizeFlowNameKey(name);
  if (!normalized) return "Flow name is required.";

  const { data, error } = await supabase
    .from("onboarding_flows")
    .select("id, name")
    .eq("tenant_id", tenantId);

  if (error) throw error;

  for (const row of data ?? []) {
    if (opts?.excludeFlowId && String(row.id) === opts.excludeFlowId) continue;
    if (normalizeFlowNameKey(String(row.name)) === normalized) {
      return `A flow named "${name.trim()}" already exists. Please choose another name.`;
    }
  }

  return null;
}

export type OnboardingFlowsListResult = {
  flows: OnboardingFlowListItem[];
  publishedCount: number;
  unpublishedCount: number;
  library: { id: string; name: string; slug: string } | null;
};

export const DEFAULT_ONBOARDING_FLOW_NAME = "Worker Onboarding";

export async function ensureDefaultTenantOnboardingFlow(
  supabase: OnboardingDbClient,
  tenantId: string,
  libraryId: string,
  createdBy?: string | null
): Promise<void> {
  const { count, error: countError } = await supabase
    .from("onboarding_flows")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("library_id", libraryId);

  if (countError) throw countError;
  if (count && count > 0) return;

  const builderDraft = createDefaultWorkflowState();
  const { data, error } = await supabase
    .from("onboarding_flows")
    .insert({
      tenant_id: tenantId,
      library_id: libraryId,
      name: DEFAULT_ONBOARDING_FLOW_NAME,
      status: "published",
      created_as_blank: false,
      builder_draft: builderDraft,
      sort_order: 1,
      created_by: createdBy ?? null,
      updated_by: createdBy ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  if (data?.id) {
    await replaceFlowStepsFromDraft(supabase, String(data.id), builderDraft);
  }
}

export async function listOnboardingFlows(
  supabase: OnboardingDbClient,
  tenantId: string,
  opts?: { libraryId?: string; librarySlug?: string; status?: "published" | "unpublished" }
): Promise<OnboardingFlowsListResult> {
  const library = await resolveOnboardingLibraryForFlows(supabase, tenantId, {
    libraryId: opts?.libraryId,
    librarySlug: opts?.librarySlug,
  });

  if (!library) {
    return { flows: [], publishedCount: 0, unpublishedCount: 0, library: null };
  }

  await ensureDefaultTenantOnboardingFlow(supabase, tenantId, library.id);

  const baseQuery = supabase
    .from("onboarding_flows")
    .select(
      "id, tenant_id, library_id, template_id, name, status, created_as_blank, created_at, updated_at, sort_order"
    )
    .eq("tenant_id", tenantId)
    .eq("library_id", library.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const { data: allRows, error: allError } = await baseQuery;
  if (allError) throw allError;

  const rows = (allRows ?? []) as (OnboardingFlowRow & { sort_order: number })[];
  let publishedCount = 0;
  let unpublishedCount = 0;
  for (const row of rows) {
    if (row.status === "published") publishedCount += 1;
    else unpublishedCount += 1;
  }

  let filtered = rows;
  if (opts?.status === "published") {
    filtered = rows.filter((r) => r.status === "published");
  } else if (opts?.status === "unpublished") {
    filtered = rows.filter((r) => r.status === "unpublished" || r.status === "draft");
  }

  return {
    flows: filtered.map(toListItem),
    publishedCount,
    unpublishedCount,
    library: { id: library.id, name: library.name, slug: library.slug },
  };
}

export async function getOnboardingFlowById(
  supabase: OnboardingDbClient,
  tenantId: string,
  flowId: string
): Promise<OnboardingFlowDetail | null> {
  const { data, error } = await supabase
    .from("onboarding_flows")
    .select(
      "id, tenant_id, library_id, template_id, name, status, created_as_blank, builder_draft, created_by, updated_by, created_at, updated_at"
    )
    .eq("id", flowId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as OnboardingFlowRow;
  const builderDraft = await loadFlowBuilderDraft(supabase, flowId, row.builder_draft);
  return { ...toDetail(row), builderDraft };
}

export async function createOnboardingFlow(
  supabase: OnboardingDbClient,
  tenantId: string,
  input: {
    name: string;
    libraryId?: string | null;
    templateId?: string | null;
    createAsBlank?: boolean;
    status?: OnboardingFlowStatus;
    createdBy: string;
  }
): Promise<OnboardingFlowDetail> {
  const duplicate = await findDuplicateOnboardingFlowName(supabase, tenantId, input.name);
  if (duplicate) throw new Error(duplicate);

  let libraryId = input.libraryId ?? null;
  if (!libraryId) {
    const library = await resolveOnboardingLibraryForFlows(supabase, tenantId, {
      librarySlug: "onboarding",
    });
    libraryId = library?.id ?? null;
  }

  let builderDraft: SerializableWorkflowState = { nodes: [], edges: [] };
  let templateId: string | null = input.templateId ?? null;
  const createAsBlank = input.createAsBlank === true || !templateId;

  if (!createAsBlank && templateId) {
    const template = await getWorkflowTemplateById(supabase, tenantId, templateId);
    if (!template) throw new Error("Template not found");
    builderDraft = await workflowTemplateDraft(supabase, template);
  }

  const status: OnboardingFlowStatus = input.status ?? "unpublished";

  let sortOrder = 0;
  if (libraryId) {
    const { data: maxRow } = await supabase
      .from("onboarding_flows")
      .select("sort_order")
      .eq("tenant_id", tenantId)
      .eq("library_id", libraryId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (maxRow?.sort_order ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from("onboarding_flows")
    .insert({
      tenant_id: tenantId,
      library_id: libraryId,
      template_id: templateId,
      name: input.name.trim(),
      status,
      created_as_blank: createAsBlank,
      builder_draft: builderDraft,
      sort_order: sortOrder,
      created_by: input.createdBy,
      updated_by: input.createdBy,
    })
    .select(
      "id, tenant_id, library_id, template_id, name, status, created_as_blank, builder_draft, created_by, updated_by, created_at, updated_at"
    )
    .single();

  if (error) throw error;

  const detail = toDetail(data as OnboardingFlowRow);
  if (builderDraft.nodes.length) {
    await replaceFlowStepsFromDraft(supabase, detail.id, builderDraft);
  }
  return { ...detail, builderDraft };
}

export async function updateOnboardingFlow(
  supabase: OnboardingDbClient,
  tenantId: string,
  flowId: string,
  input: {
    name?: string;
    status?: OnboardingFlowStatus;
    libraryId?: string | null;
    builderDraft?: SerializableWorkflowState;
    updatedBy: string;
  }
): Promise<OnboardingFlowDetail> {
  const existing = await getOnboardingFlowById(supabase, tenantId, flowId);
  if (!existing) throw new Error("Flow not found");

  if (input.name !== undefined) {
    const duplicate = await findDuplicateOnboardingFlowName(supabase, tenantId, input.name, {
      excludeFlowId: flowId,
    });
    if (duplicate) throw new Error(duplicate);
  }

  const patch: Record<string, unknown> = {
    updated_by: input.updatedBy,
  };

  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.status !== undefined) patch.status = input.status;
  if (input.libraryId !== undefined) patch.library_id = input.libraryId;
  if (input.builderDraft !== undefined) patch.builder_draft = input.builderDraft;

  const { data, error } = await supabase
    .from("onboarding_flows")
    .update(patch)
    .eq("id", flowId)
    .eq("tenant_id", tenantId)
    .select(
      "id, tenant_id, library_id, template_id, name, status, created_as_blank, builder_draft, created_by, updated_by, created_at, updated_at"
    )
    .single();

  if (error) {
    throw new Error(
      [error.message, error.details, error.hint].filter(Boolean).join(" — ") ||
        "Failed to update onboarding flow"
    );
  }

  const detail = toDetail(data as OnboardingFlowRow);
  if (input.builderDraft) {
    await replaceFlowStepsFromDraft(supabase, flowId, input.builderDraft);
    detail.builderDraft = input.builderDraft;
  } else {
    detail.builderDraft = await loadFlowBuilderDraft(
      supabase,
      flowId,
      detail.builderDraft
    );
  }
  return detail;
}

export async function deleteOnboardingFlow(
  supabase: OnboardingDbClient,
  tenantId: string,
  flowId: string
): Promise<void> {
  const { error } = await supabase
    .from("onboarding_flows")
    .delete()
    .eq("id", flowId)
    .eq("tenant_id", tenantId);

  if (error) throw error;
}

export async function saveOnboardingFlowAsTemplate(
  supabase: OnboardingDbClient,
  tenantId: string,
  flowId: string,
  input: { templateName: string; createdBy: string }
): Promise<{ templateId: string }> {
  const flow = await getOnboardingFlowById(supabase, tenantId, flowId);
  if (!flow) throw new Error("Flow not found");

  const { createWorkflowTemplate } = await import("@/lib/onboarding/workflow-templates");
  const template = await createWorkflowTemplate(supabase, tenantId, {
    name: input.templateName,
    folder: "saved-templates",
    builderDraft: flow.builderDraft,
    flowName: flow.name,
    createdBy: input.createdBy,
  });

  return { templateId: template.id };
}
