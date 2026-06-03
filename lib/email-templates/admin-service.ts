import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { EmailTemplateError } from "@/lib/email-templates/errors";
import {
  validatePlaceholdersAllowed,
  validateVariableDefinitions,
} from "@/lib/email-templates/interpolation";
import { mapEmailTemplateRow } from "@/lib/email-templates/mapper";
import {
  fetchTenantEditableTemplate,
  resolveEmailTemplate,
} from "@/lib/email-templates/resolver";
import { normalizeStoredFromEmailLocalPart } from "@/lib/email-templates/from-local-part";
import { assertSafeEmailHtml, sanitizeEmailHtml } from "@/lib/email-templates/sanitize-html";
import { ONBOARDING_EMAIL_TEMPLATE_KEYS } from "@/lib/email-templates/template-keys";
import {
  isEmailTemplateActive,
  type AdminEmailTemplateItem,
  type EmailTemplateRow,
} from "@/lib/email-templates/types";
import {
  buildCacheKey,
  CACHE_TTL_SECONDS,
  getOrSetCache,
  invalidateTableCache,
  invalidateTenantCache,
} from "@/lib/cache";

const MANAGED_TEMPLATE_KEYS = ONBOARDING_EMAIL_TEMPLATE_KEYS;

const optionalEmail = z
  .string()
  .trim()
  .max(320)
  .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid email")
  .optional();

export const adminSaveEmailTemplateSchema = z.object({
  template_key: z.enum(MANAGED_TEMPLATE_KEYS),
  locale: z.string().trim().default("en"),
  name: z.string().trim().min(1).max(200).optional(),
  subject: z.string().trim().min(1).max(500),
  body_html: z.string().min(1).max(200_000),
  body_text: z.string().max(200_000).nullable().optional(),
  from_email_local_part: z.string().trim().max(64).optional(),
  reply_to_email: optionalEmail,
});

export type AdminSaveEmailTemplateInput = z.infer<typeof adminSaveEmailTemplateSchema>;

async function listGlobalKeys(
  supabase: SupabaseClient,
  locale: string
): Promise<EmailTemplateRow[]> {
  return getOrSetCache(
    buildCacheKey("email_templates", ["global", "managed"], { locale, keys: MANAGED_TEMPLATE_KEYS }),
    () => listGlobalKeysUncached(supabase, locale),
    CACHE_TTL_SECONDS.tenantConfig
  );
}

async function listGlobalKeysUncached(
  supabase: SupabaseClient,
  locale: string
): Promise<EmailTemplateRow[]> {
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .is("tenant_id", null)
    .eq("locale", locale)
    .eq("status", "active")
    .eq("is_active_version", true)
    .in("template_key", [...MANAGED_TEMPLATE_KEYS]);

  if (error) {
    throw new EmailTemplateError("INTERNAL_ERROR", "Failed to load global templates", 500, {
      detail: error.message,
    });
  }
  return (data ?? []).map((r) => mapEmailTemplateRow(r as Record<string, unknown>));
}

function toAdminItem(
  templateKey: string,
  resolved: EmailTemplateRow,
  resolvedFrom: "tenant" | "global",
  tenantRow: EmailTemplateRow | null
): AdminEmailTemplateItem {
  const display = tenantRow ?? resolved;
  return {
    template_key: templateKey,
    name: display.name,
    locale: display.locale,
    variables: resolved.variables,
    resolved_from: resolvedFrom,
    tenant_template_id: tenantRow?.id ?? null,
    is_tenant_override: Boolean(tenantRow),
    subject: display.subject,
    body_html: display.body_html,
    body_text: display.body_text,
    from_email_local_part: display.from_email_local_part,
    reply_to_email: display.reply_to_email ?? resolved.reply_to_email,
    version: display.version,
    status: display.status,
    is_active: isEmailTemplateActive(display),
  };
}

export async function listAdminEmailTemplates(
  supabase: SupabaseClient,
  tenantId: string,
  locale = "en"
): Promise<AdminEmailTemplateItem[]> {
  const globals = await listGlobalKeys(supabase, locale);
  const globalByKey = new Map(globals.map((g) => [g.template_key, g]));

  const items: AdminEmailTemplateItem[] = [];

  for (const key of MANAGED_TEMPLATE_KEYS) {
    const tenantRow = await fetchTenantEditableTemplate(supabase, tenantId, key, locale);
    try {
      const resolved = await resolveEmailTemplate(supabase, {
        tenantId,
        templateKey: key,
        locale,
      });
      items.push(toAdminItem(key, resolved.template, resolved.resolved_from, tenantRow));
    } catch (e) {
      if (e instanceof EmailTemplateError && e.code === "NOT_FOUND") {
        const g = globalByKey.get(key);
        if (g) {
          items.push(toAdminItem(key, g, "global", tenantRow));
        }
        continue;
      }
      throw e;
    }
  }

  return items;
}

async function nextVersion(
  supabase: SupabaseClient,
  tenantId: string,
  templateKey: string,
  locale: string
): Promise<number> {
  const { data } = await supabase
    .from("email_templates")
    .select("version")
    .eq("tenant_id", tenantId)
    .eq("template_key", templateKey)
    .eq("locale", locale)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? Number((data as { version: number }).version) + 1 : 1;
}

async function deactivateTenantActive(
  supabase: SupabaseClient,
  tenantId: string,
  templateKey: string,
  locale: string
) {
  await supabase
    .from("email_templates")
    .update({ is_active_version: false })
    .eq("tenant_id", tenantId)
    .eq("template_key", templateKey)
    .eq("locale", locale)
    .eq("is_active_version", true);
}

export async function saveAdminTenantEmailTemplate(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  input: AdminSaveEmailTemplateInput
): Promise<AdminEmailTemplateItem> {
  const resolved = await resolveEmailTemplate(supabase, {
    tenantId,
    templateKey: input.template_key,
    locale: input.locale,
  });

  const variables = resolved.template.variables;
  validateVariableDefinitions(variables);
  const allowed = new Set(variables.map((v) => v.key));

  for (const field of [input.subject, input.body_html, input.body_text ?? ""]) {
    if (field) validatePlaceholdersAllowed(field, allowed);
  }

  try {
    assertSafeEmailHtml(input.body_html);
  } catch {
    throw new EmailTemplateError("UNSAFE_CONTENT", "Unsafe HTML in email body", 400);
  }

  const body_html = sanitizeEmailHtml(input.body_html);
  const body_text =
    input.body_text === undefined
      ? resolved.template.body_text
      : input.body_text === null
        ? null
        : input.body_text.trim();

  const from_email_local_part =
    input.from_email_local_part === undefined
      ? resolved.template.from_email_local_part
      : normalizeStoredFromEmailLocalPart(input.from_email_local_part);
  const reply_to_email =
    input.reply_to_email === undefined
      ? resolved.template.reply_to_email
      : input.reply_to_email?.trim() || null;

  const existing = await fetchTenantEditableTemplate(
    supabase,
    tenantId,
    input.template_key,
    input.locale
  );

  if (existing) {
    const { data, error } = await supabase
      .from("email_templates")
      .update({
        name: input.name ?? existing.name,
        subject: input.subject,
        body_html,
        body_text,
        from_email_local_part,
        reply_to_email,
        updated_by: userId,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      throw new EmailTemplateError("INTERNAL_ERROR", "Failed to update template", 500, {
        detail: error.message,
      });
    }

    const row = mapEmailTemplateRow(data as Record<string, unknown>);
    await invalidateTenantCache("email_templates", tenantId);
    return toAdminItem(input.template_key, row, "tenant", row);
  }

  const version = await nextVersion(supabase, tenantId, input.template_key, input.locale);
  await deactivateTenantActive(supabase, tenantId, input.template_key, input.locale);

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      tenant_id: tenantId,
      template_key: input.template_key,
      name: input.name ?? resolved.template.name,
      subject: input.subject,
      body_html,
      body_text,
      from_email_local_part,
      reply_to_email,
      variables,
      locale: input.locale,
      status: "active",
      version,
      is_active_version: true,
      source_global_template_id:
        resolved.resolved_from === "global" ? resolved.template.id : null,
      created_by: userId,
      updated_by: userId,
    })
    .select("*")
    .single();

  if (error) {
    throw new EmailTemplateError("INTERNAL_ERROR", "Failed to create tenant template", 500, {
      detail: error.message,
    });
  }

  const row = mapEmailTemplateRow(data as Record<string, unknown>);
  await invalidateTenantCache("email_templates", tenantId);
  await invalidateTableCache("email_templates");
  return toAdminItem(input.template_key, row, "tenant", row);
}
