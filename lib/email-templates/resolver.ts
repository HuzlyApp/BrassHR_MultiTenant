import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLocaleFallbackChain } from "@/lib/email-templates/locale-fallback";
import { mapEmailTemplateRow } from "@/lib/email-templates/mapper";
import { EmailTemplateError } from "@/lib/email-templates/errors";
import type { EmailTemplateRow, ResolvedEmailTemplate } from "@/lib/email-templates/types";

async function fetchActive(
  supabase: SupabaseClient,
  tenantId: string | null,
  templateKey: string,
  locale: string
): Promise<EmailTemplateRow | null> {
  let q = supabase
    .from("email_templates")
    .select("*")
    .eq("template_key", templateKey)
    .eq("locale", locale)
    .eq("status", "active")
    .eq("is_active_version", true)
    .limit(1);

  q = tenantId === null ? q.is("tenant_id", null) : q.eq("tenant_id", tenantId);

  const { data, error } = await q.maybeSingle();
  if (error) {
    throw new EmailTemplateError("INTERNAL_ERROR", "Failed to resolve template", 500, {
      detail: error.message,
    });
  }
  return data ? mapEmailTemplateRow(data as Record<string, unknown>) : null;
}

export async function resolveEmailTemplate(
  supabase: SupabaseClient,
  params: { tenantId: string; templateKey: string; locale: string }
): Promise<ResolvedEmailTemplate> {
  const chain = buildLocaleFallbackChain(params.locale);

  for (const loc of chain) {
    const tenantTpl = await fetchActive(supabase, params.tenantId, params.templateKey, loc);
    if (tenantTpl) {
      return { template: tenantTpl, resolved_from: "tenant", locale_used: loc };
    }
  }

  for (const loc of chain) {
    const globalTpl = await fetchActive(supabase, null, params.templateKey, loc);
    if (globalTpl) {
      return { template: globalTpl, resolved_from: "global", locale_used: loc };
    }
  }

  throw new EmailTemplateError("NOT_FOUND", `Template "${params.templateKey}" not found`, 404);
}

/** Active template for one tenant only (no global fallback). */
export async function resolveTenantOnlyEmailTemplate(
  supabase: SupabaseClient,
  params: { tenantId: string; templateKey: string; locale: string }
): Promise<EmailTemplateRow | null> {
  const chain = buildLocaleFallbackChain(params.locale);
  for (const loc of chain) {
    const row = await fetchActive(supabase, params.tenantId, params.templateKey, loc);
    if (row) return row;
  }
  return null;
}

/** Latest tenant-owned row for editing (draft or active), not global fallback. */
export async function fetchTenantEditableTemplate(
  supabase: SupabaseClient,
  tenantId: string,
  templateKey: string,
  locale: string
): Promise<EmailTemplateRow | null> {
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("template_key", templateKey)
    .eq("locale", locale)
    .neq("status", "archived")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new EmailTemplateError("INTERNAL_ERROR", "Failed to load tenant template", 500, {
      detail: error.message,
    });
  }
  return data ? mapEmailTemplateRow(data as Record<string, unknown>) : null;
}
