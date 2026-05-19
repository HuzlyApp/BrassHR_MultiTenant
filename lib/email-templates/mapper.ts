import type { EmailTemplateRow, EmailTemplateVariable } from "@/lib/email-templates/types";

export function mapEmailTemplateRow(raw: Record<string, unknown>): EmailTemplateRow {
  const variablesRaw = raw.variables;
  let variables: EmailTemplateVariable[] = [];
  if (Array.isArray(variablesRaw)) {
    variables = variablesRaw
      .filter((v): v is Record<string, unknown> => v !== null && typeof v === "object")
      .map((v) => ({
        key: String(v.key ?? ""),
        required: v.required === true,
        description: typeof v.description === "string" ? v.description : undefined,
        sample: typeof v.sample === "string" ? v.sample : undefined,
      }))
      .filter((v) => v.key.length > 0);
  }

  return {
    id: String(raw.id),
    tenant_id: raw.tenant_id == null ? null : String(raw.tenant_id),
    template_key: String(raw.template_key),
    name: String(raw.name),
    subject: String(raw.subject),
    body_html: String(raw.body_html ?? ""),
    body_text: raw.body_text == null ? null : String(raw.body_text),
    variables,
    locale: String(raw.locale ?? "en"),
    status: raw.status as EmailTemplateRow["status"],
    version: Number(raw.version ?? 1),
    is_active_version: raw.is_active_version === true,
    source_global_template_id:
      raw.source_global_template_id == null ? null : String(raw.source_global_template_id),
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
    created_by: raw.created_by == null ? null : String(raw.created_by),
    updated_by: raw.updated_by == null ? null : String(raw.updated_by),
  };
}
