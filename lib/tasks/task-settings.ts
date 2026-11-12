import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_ASSIGN_ONLY_MANAGER_HR } from "@/lib/tasks/assigner-roles";

export type TenantTaskSettings = {
  tenantId: string;
  assignOnlyManagerHr: boolean;
  updatedAt: string | null;
};

type TaskSettingsRow = {
  tenant_id: string;
  assign_only_manager_hr: boolean;
  updated_at: string | null;
};

export async function loadTenantTaskSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantTaskSettings> {
  const { data, error } = await supabase
    .from("tenant_task_settings")
    .select("tenant_id, assign_only_manager_hr, updated_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const { data: inserted, error: insertError } = await supabase
      .from("tenant_task_settings")
      .insert({
        tenant_id: tenantId,
        assign_only_manager_hr: DEFAULT_ASSIGN_ONLY_MANAGER_HR,
      })
      .select("tenant_id, assign_only_manager_hr, updated_at")
      .single();
    if (insertError) throw insertError;
    return mapRow(inserted as TaskSettingsRow);
  }

  return mapRow(data as TaskSettingsRow);
}

export async function saveTenantTaskSettings(
  supabase: SupabaseClient,
  tenantId: string,
  input: { assignOnlyManagerHr: boolean }
): Promise<TenantTaskSettings> {
  const { data, error } = await supabase
    .from("tenant_task_settings")
    .upsert(
      {
        tenant_id: tenantId,
        assign_only_manager_hr: input.assignOnlyManagerHr,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" }
    )
    .select("tenant_id, assign_only_manager_hr, updated_at")
    .single();

  if (error) throw error;
  return mapRow(data as TaskSettingsRow);
}

function mapRow(row: TaskSettingsRow): TenantTaskSettings {
  return {
    tenantId: row.tenant_id,
    assignOnlyManagerHr: Boolean(row.assign_only_manager_hr),
    updatedAt: row.updated_at ?? null,
  };
}
