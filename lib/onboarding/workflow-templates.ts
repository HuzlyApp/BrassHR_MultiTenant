import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";
import {
  isSerializableWorkflowState,
  type SerializableWorkflowState,
} from "@/lib/onboarding/workflow-builder-serialization";

export type WorkflowTemplateFolder = "presets" | "saved-templates";

export type WorkflowTemplateRow = {
  id: string;
  tenant_id: string | null;
  name: string;
  folder: WorkflowTemplateFolder;
  is_preset: boolean;
  builder_draft: SerializableWorkflowState;
  flow_name: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkflowTemplateListItem = {
  id: string;
  name: string;
  folder: WorkflowTemplateFolder;
  isPreset: boolean;
  flowName: string | null;
  updatedAt: string;
};

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "New Template";
  return trimmed.endsWith(".tpl") ? trimmed : `${trimmed}.tpl`;
}

function toListItem(row: WorkflowTemplateRow): WorkflowTemplateListItem {
  return {
    id: row.id,
    name: row.name,
    folder: row.folder,
    isPreset: row.is_preset,
    flowName: row.flow_name,
    updatedAt: row.updated_at,
  };
}

function parseDraft(raw: unknown): SerializableWorkflowState {
  if (isSerializableWorkflowState(raw)) return raw;
  return { nodes: [], edges: [] };
}

export async function listWorkflowTemplates(
  supabase: OnboardingDbClient,
  tenantId: string
): Promise<{ presets: WorkflowTemplateListItem[]; savedTemplates: WorkflowTemplateListItem[] }> {
  const { data: presetRows, error: presetError } = await supabase
    .from("workflow_templates")
    .select("id, tenant_id, name, folder, is_preset, builder_draft, flow_name, created_by, updated_by, created_at, updated_at")
    .eq("folder", "presets")
    .or(`is_preset.eq.true,tenant_id.eq.${tenantId}`)
    .order("name", { ascending: true });

  if (presetError) throw presetError;

  const { data: savedRows, error: savedError } = await supabase
    .from("workflow_templates")
    .select("id, tenant_id, name, folder, is_preset, builder_draft, flow_name, created_by, updated_by, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("is_preset", false)
    .eq("folder", "saved-templates")
    .order("updated_at", { ascending: false });

  if (savedError) throw savedError;

  return {
    presets: (presetRows ?? []).map((row) => toListItem(row as WorkflowTemplateRow)),
    savedTemplates: (savedRows ?? []).map((row) => toListItem(row as WorkflowTemplateRow)),
  };
}

export async function getWorkflowTemplateById(
  supabase: OnboardingDbClient,
  tenantId: string,
  templateId: string
): Promise<WorkflowTemplateRow | null> {
  const { data, error } = await supabase
    .from("workflow_templates")
    .select("id, tenant_id, name, folder, is_preset, builder_draft, flow_name, created_by, updated_by, created_at, updated_at")
    .eq("id", templateId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as WorkflowTemplateRow;
  if (row.is_preset) return row;
  if (row.tenant_id !== tenantId) return null;
  return row;
}

export async function createWorkflowTemplate(
  supabase: OnboardingDbClient,
  tenantId: string,
  input: {
    name: string;
    folder?: WorkflowTemplateFolder;
    builderDraft: SerializableWorkflowState;
    flowName?: string;
    createdBy: string;
    isPreset?: boolean;
  }
): Promise<WorkflowTemplateListItem> {
  const folder = input.folder ?? "saved-templates";
  const isPreset = input.isPreset === true;

  const { data, error } = await supabase
    .from("workflow_templates")
    .insert({
      tenant_id: isPreset ? null : tenantId,
      name: normalizeName(input.name),
      folder,
      is_preset: isPreset,
      builder_draft: input.builderDraft,
      flow_name: input.flowName?.trim() || null,
      created_by: input.createdBy,
      updated_by: input.createdBy,
    })
    .select("id, tenant_id, name, folder, is_preset, builder_draft, flow_name, created_by, updated_by, created_at, updated_at")
    .single();

  if (error) throw error;
  return toListItem(data as WorkflowTemplateRow);
}

function assertTemplateWritable(
  existing: WorkflowTemplateRow,
  tenantId: string
): void {
  if (existing.is_preset && existing.tenant_id === null) {
    throw new Error("Cannot modify system preset");
  }
  if (existing.tenant_id !== null && existing.tenant_id !== tenantId) {
    throw new Error("Template not found");
  }
}

export async function updateWorkflowTemplate(
  supabase: OnboardingDbClient,
  tenantId: string,
  templateId: string,
  input: {
    name?: string;
    flowName?: string;
    builderDraft?: SerializableWorkflowState;
    updatedBy: string;
  }
): Promise<WorkflowTemplateListItem> {
  const existing = await getWorkflowTemplateById(supabase, tenantId, templateId);
  if (!existing) throw new Error("Template not found");
  assertTemplateWritable(existing, tenantId);

  const patch: {
    name?: string;
    flow_name?: string | null;
    builder_draft?: SerializableWorkflowState;
    updated_by: string;
  } = {
    updated_by: input.updatedBy,
  };

  if (input.name !== undefined) {
    patch.name = normalizeName(input.name);
  }
  if (input.flowName !== undefined) {
    patch.flow_name = input.flowName.trim() || null;
  }
  if (input.builderDraft !== undefined) {
    patch.builder_draft = input.builderDraft;
  }

  const { data, error } = await supabase
    .from("workflow_templates")
    .update(patch)
    .eq("id", templateId)
    .select(
      "id, tenant_id, name, folder, is_preset, builder_draft, flow_name, created_by, updated_by, created_at, updated_at"
    )
    .single();

  if (error) throw error;
  return toListItem(data as WorkflowTemplateRow);
}

export async function updateWorkflowTemplateName(
  supabase: OnboardingDbClient,
  tenantId: string,
  templateId: string,
  name: string,
  updatedBy: string
): Promise<void> {
  await updateWorkflowTemplate(supabase, tenantId, templateId, {
    name,
    updatedBy,
  });
}

export async function deleteWorkflowTemplate(
  supabase: OnboardingDbClient,
  tenantId: string,
  templateId: string
): Promise<void> {
  const existing = await getWorkflowTemplateById(supabase, tenantId, templateId);
  if (!existing) throw new Error("Template not found");
  assertTemplateWritable(existing, tenantId);

  const { error } = await supabase.from("workflow_templates").delete().eq("id", templateId);
  if (error) throw error;
}

export function workflowTemplateDraft(row: WorkflowTemplateRow): SerializableWorkflowState {
  return parseDraft(row.builder_draft);
}
