import { effectiveFromEmailLocalPart } from "@/lib/email-templates/from-local-part";
import type { EmailTemplateRow, EmailTemplateVariable } from "@/lib/email-templates/types";

function legacyFromEmailLocalPart(fromEmail: unknown): string | undefined {
  if (fromEmail == null) return undefined;
  let s = String(fromEmail).trim();
  const angle = s.match(/<([^>]+)>/);
  if (angle?.[1]) s = angle[1].trim();
  const at = s.indexOf("@");
  if (at >= 0) return s.slice(0, at).trim().toLowerCase();
  return s.toLowerCase();
}

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
    from_email_local_part: effectiveFromEmailLocalPart(
      raw.from_email_local_part as string | null | undefined,
      legacyFromEmailLocalPart(raw.from_email)
    ),
    reply_to_email:
      raw.reply_to_email == null ? null : String(raw.reply_to_email).trim() || null,
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
