import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";
import {
  isSerializableWorkflowState,
  type SerializableWorkflowState,
} from "@/lib/onboarding/workflow-builder-serialization";
import { loadTemplateBuilderDraft } from "@/lib/onboarding/flow-steps-sync";

export type WorkflowTemplateFolder = "presets" | "saved-templates";

export type WorkflowTemplateRow = {
  id: string;
  tenant_id: string | null;
  name: string;
  type: "preset" | "saved";
  status: string;
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

const TEMPLATE_SELECT =
  "id, tenant_id, name, type, status, builder_draft, flow_name, created_by, updated_by, created_at, updated_at";

function rowToFolder(type: "preset" | "saved"): WorkflowTemplateFolder {
  return type === "preset" ? "presets" : "saved-templates";
}

function folderToType(folder: WorkflowTemplateFolder): "preset" | "saved" {
  return folder === "presets" ? "preset" : "saved";
}

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "New Template";
  return trimmed.endsWith(".tpl") ? trimmed : `${trimmed}.tpl`;
}

function toListItem(row: WorkflowTemplateRow): WorkflowTemplateListItem {
  return {
    id: row.id,
    name: row.name,
    folder: rowToFolder(row.type),
    isPreset: row.type === "preset",
    flowName: row.flow_name,
    updatedAt: row.updated_at,
  };
}

function parseDraft(raw: unknown): SerializableWorkflowState {
  if (isSerializableWorkflowState(raw)) return raw;
  return { nodes: [], edges: [] };
}

async function syncTemplateSteps(
  supabase: OnboardingDbClient,
  templateId: string,
  draft: SerializableWorkflowState
): Promise<void> {
  await supabase.from("onboarding_template_steps").delete().eq("template_id", templateId);
  if (!draft.nodes.length) return;

  const inserts = draft.nodes.map((node, index) => ({
    template_id: templateId,
    step_type: node.stepId,
    title: node.label,
    description: node.description ?? null,
    position: index + 1,
    day: node.day,
    is_required: node.required,
    settings: node.settings,
    metadata: { library_step_key: node.stepId },
    canvas_node_id: node.id,
  }));

  const { error } = await supabase.from("onboarding_template_steps").insert(inserts);
  if (error) throw error;
}

export async function listWorkflowTemplates(
  supabase: OnboardingDbClient,
  tenantId: string
): Promise<{ presets: WorkflowTemplateListItem[]; savedTemplates: WorkflowTemplateListItem[] }> {
  const { data: presetRows, error: presetError } = await supabase
    .from("onboarding_templates")
    .select(TEMPLATE_SELECT)
    .eq("type", "preset")
    .order("name", { ascending: true });

  if (presetError) throw presetError;

  const { data: savedRows, error: savedError } = await supabase
    .from("onboarding_templates")
    .select(TEMPLATE_SELECT)
    .eq("tenant_id", tenantId)
    .eq("type", "saved")
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
    .from("onboarding_templates")
    .select(TEMPLATE_SELECT)
    .eq("id", templateId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as WorkflowTemplateRow;
  if (row.type === "preset") return row;
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
  const type = input.isPreset === true ? "preset" : folderToType(folder);

  const { data, error } = await supabase
    .from("onboarding_templates")
    .insert({
      tenant_id: type === "preset" ? null : tenantId,
      name: normalizeName(input.name),
      type,
      status: "draft",
      builder_draft: input.builderDraft,
      flow_name: input.flowName?.trim() || null,
      created_by: input.createdBy,
      updated_by: input.createdBy,
    })
    .select(TEMPLATE_SELECT)
    .single();

  if (error) throw error;

  const row = data as WorkflowTemplateRow;
  await syncTemplateSteps(supabase, row.id, input.builderDraft);
  return toListItem(row);
}

function assertTemplateWritable(existing: WorkflowTemplateRow, tenantId: string): void {
  if (existing.type === "preset" && existing.tenant_id === null) {
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

  if (input.name !== undefined) patch.name = normalizeName(input.name);
  if (input.flowName !== undefined) patch.flow_name = input.flowName.trim() || null;
  if (input.builderDraft !== undefined) patch.builder_draft = input.builderDraft;

  const { data, error } = await supabase
    .from("onboarding_templates")
    .update(patch)
    .eq("id", templateId)
    .select(TEMPLATE_SELECT)
    .single();

  if (error) throw error;

  if (input.builderDraft) {
    await syncTemplateSteps(supabase, templateId, input.builderDraft);
  }

  return toListItem(data as WorkflowTemplateRow);
}

export async function updateWorkflowTemplateName(
  supabase: OnboardingDbClient,
  tenantId: string,
  templateId: string,
  name: string,
  updatedBy: string
): Promise<void> {
  await updateWorkflowTemplate(supabase, tenantId, templateId, { name, updatedBy });
}

export async function deleteWorkflowTemplate(
  supabase: OnboardingDbClient,
  tenantId: string,
  templateId: string
): Promise<void> {
  const existing = await getWorkflowTemplateById(supabase, tenantId, templateId);
  if (!existing) throw new Error("Template not found");
  assertTemplateWritable(existing, tenantId);

  const { error } = await supabase.from("onboarding_templates").delete().eq("id", templateId);
  if (error) throw error;
}

export async function workflowTemplateDraft(
  supabase: OnboardingDbClient,
  row: WorkflowTemplateRow
): Promise<SerializableWorkflowState> {
  return loadTemplateBuilderDraft(supabase, row.id, row.builder_draft);
}

export function workflowTemplateDraftSync(row: WorkflowTemplateRow): SerializableWorkflowState {
  return parseDraft(row.builder_draft);
}
