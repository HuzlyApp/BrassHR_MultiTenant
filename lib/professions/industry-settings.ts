import type { SupabaseClient } from "@supabase/supabase-js";
import { bindTenantIndustries } from "@/lib/ai-catalog/bind-tenant";
export class IndustrySettingsError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}
export function parseIndustryMetadata(input: { description?: unknown; iconId?: unknown }) {
  if (input.description != null && typeof input.description !== "string") throw new IndustrySettingsError("Description must be text.");
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (description.length > 100) throw new IndustrySettingsError("Industry description must be 100 characters or fewer.");
  const iconId = input.iconId == null || input.iconId === "" ? null : input.iconId;
  if (iconId !== null && (typeof iconId !== "string" || !["medical", "logistics", "care", "science", "access", "person", "code", "clinical"].includes(iconId))) throw new IndustrySettingsError("Choose a valid industry icon.");
  return { description: description || null, icon_id: iconId as string | null };
}
export async function saveIndustryMetadata(supabase: SupabaseClient, tenantId: string, industryKey: string, input: { description?: unknown; iconId?: unknown }) {
  const metadata = parseIndustryMetadata(input);
  const { data, error } = await supabase.from("tenant_industry").update(metadata).eq("tenant_id", tenantId).eq("industry_key", industryKey).select("industry_key, description, icon_id").maybeSingle();
  if (error) throw error;
  if (!data) throw new IndustrySettingsError("Industry not found in this organization.", 404);
  return data;
}

export async function removeTenantIndustry(supabase: SupabaseClient, tenantId: string, industryKey: string) {
  const [{ data: rows, error }, { data: tenant, error: tenantError }] = await Promise.all([
    supabase.from("tenant_industry").select("industry_key, is_primary").eq("tenant_id", tenantId),
    supabase.from("tenants").select("primary_industry_key").eq("id", tenantId).maybeSingle(),
  ]);
  if (error || tenantError) throw error || tenantError;
  if (!rows?.some(row => row.industry_key === industryKey)) throw new IndustrySettingsError("Industry not found in this organization.", 404);
  const primary = tenant?.primary_industry_key || rows.find(row => row.is_primary)?.industry_key || null;
  if (primary === industryKey) throw new IndustrySettingsError("The primary industry cannot be deleted.", 409);
  const { count, error: countError } = await supabase.from("tenant_professions").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("industry_key", industryKey);
  if (countError) throw countError;
  if (count) throw new IndustrySettingsError("Remove or move the industry's professions before deleting it.", 409);
  await bindTenantIndustries(supabase, { tenantId, industryKeys: rows.map(row => row.industry_key).filter(key => key !== industryKey), primaryIndustryKey: primary });
}
