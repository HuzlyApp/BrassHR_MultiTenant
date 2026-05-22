import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveTenantBySubdomainOrName } from "@/lib/email/resolve-tenant-by-subdomain";
import { EMAIL_TEMPLATE_TYPE } from "@/lib/email-templates/template-keys";
import {
  assertNonEmptyEmailContent,
  interpolateTemplate,
} from "@/lib/email-templates/interpolation";
import { resolveTenantOnlyEmailTemplate } from "@/lib/email-templates/resolver";
import { sanitizeEmailHtml } from "@/lib/email-templates/sanitize-html";
import type { EmailTemplateRow } from "@/lib/email-templates/types";
import {
  buildFromEmailAddress,
  buildResendFromHeader,
  resolveFromEmailLocalPart,
} from "@/lib/email/from-address";

const FALLBACK_SUBJECT = "View your application status — {{tenantName}}";

const FALLBACK_BODY_HTML = `<p>Hi {{applicantName}},</p>
<p>Thank you for completing your application with {{tenantName}}.</p>
<p>
  <a href="{{applicationStatusUrl}}">
    View your application status
  </a>
</p>
<p>Questions? Contact us at {{supportEmail}}.</p>`;

export type ApplicationStatusTestSendParams = {
  /** Subdomain, slug, or display name (e.g. "subdomain test", "test"). */
  tenantLookup: string | string[];
  to: string;
  variables: {
    applicantName: string;
    tenantName: string;
    applicationStatusUrl: string;
    supportEmail: string;
  };
  locale?: string;
};

export type ApplicationStatusTestSendResult = {
  ok: boolean;
  tenant: { id: string; name: string; slug: string; subdomain: string | null };
  templateType: string;
  templateSource: "tenant" | "fallback";
  recipient: string;
  fromEmailLocalPart?: string;
  fromEmail?: string;
  fromHeader?: string;
  messageId?: string;
  error?: string;
};

function resolveContent(
  tpl: EmailTemplateRow | null,
  variables: Record<string, string>
): { subject: string; html: string; source: "tenant" | "fallback" } {
  const subjectRaw = tpl?.subject?.trim() || FALLBACK_SUBJECT;
  const bodyHtmlRaw = tpl?.body_html?.trim() || FALLBACK_BODY_HTML;

  const subject = interpolateTemplate(subjectRaw, variables, { escapeForHtml: false });
  const html = sanitizeEmailHtml(
    interpolateTemplate(bodyHtmlRaw, variables, { escapeForHtml: true })
  );

  return {
    subject,
    html,
    source: tpl ? "tenant" : "fallback",
  };
}

/**
 * Sends APPLICATION_STATUS email for a tenant identified by subdomain, using only that tenant's template (or built-in fallback).
 */
export async function sendApplicationStatusTestEmail(
  supabase: SupabaseClient,
  params: ApplicationStatusTestSendParams
): Promise<ApplicationStatusTestSendResult> {
  const templateType = EMAIL_TEMPLATE_TYPE.APPLICATION_STATUS;
  const recipient = params.to.trim().toLowerCase();
  const locale = params.locale?.trim() || "en";

  const lookups = Array.isArray(params.tenantLookup)
    ? params.tenantLookup
    : [params.tenantLookup];

  const tenant = await resolveTenantBySubdomainOrName(supabase, lookups);
  if (!tenant) {
    return {
      ok: false,
      tenant: {
        id: "",
        name: lookups[0] ?? "",
        slug: lookups[0] ?? "",
        subdomain: lookups[0] ?? "",
      },
      templateType,
      templateSource: "fallback",
      recipient,
      error: `Tenant not found for: ${lookups.join(", ")}`,
    };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      tenant,
      templateType,
      templateSource: "fallback",
      recipient,
      error: "RESEND_API_KEY is not configured",
    };
  }

  const tpl = await resolveTenantOnlyEmailTemplate(supabase, {
    tenantId: tenant.id,
    templateKey: templateType,
    locale,
  });

  const variables = {
    applicantName: params.variables.applicantName,
    tenantName: params.variables.tenantName,
    applicationStatusUrl: params.variables.applicationStatusUrl,
    supportEmail: params.variables.supportEmail,
  };

  const { subject, html, source } = resolveContent(tpl, variables);

  try {
    assertNonEmptyEmailContent(subject, html);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid email content";
    return {
      ok: false,
      tenant,
      templateType,
      templateSource: source,
      recipient,
      error: msg,
    };
  }

  const fromEmailLocalPart = resolveFromEmailLocalPart(
    tpl ?? { from_email_local_part: "notifications" }
  );

  let fromHeader: string;
  let fromEmail: string;
  try {
    fromHeader = buildResendFromHeader(tpl ?? { from_email_local_part: fromEmailLocalPart });
    fromEmail = buildFromEmailAddress(fromEmailLocalPart);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not build From address";
    return {
      ok: false,
      tenant,
      templateType,
      templateSource: source,
      recipient,
      fromEmailLocalPart,
      error: msg,
    };
  }

  const replyTo = tpl?.reply_to_email?.trim() || undefined;
  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: fromHeader,
      to: recipient,
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    });

    if (error) {
      console.error("[email:test] Resend send failed", {
        tenant: tenant.name,
        templateType,
        code: error.name,
      });
      return {
        ok: false,
        tenant,
        templateType,
        templateSource: source,
        recipient,
        fromEmailLocalPart,
        fromEmail,
        fromHeader,
        error: error.message || "Resend rejected the send",
      };
    }

    console.info("[email:test] Application status email sent", {
      tenant: tenant.name,
      tenantSubdomain: tenant.subdomain ?? tenant.slug,
      tenantId: tenant.id,
      templateType,
      templateSource: source,
      fromEmailLocalPart,
      fromEmail,
      fromHeader,
      recipient,
      messageId: data?.id ?? null,
    });

    return {
      ok: true,
      tenant,
      templateType,
      templateSource: source,
      recipient,
      fromEmailLocalPart,
      fromEmail,
      fromHeader,
      messageId: data?.id,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed";
    console.error("[email:test] Unexpected error", {
      tenant: tenant.name,
      templateType,
    });
    return {
      ok: false,
      tenant,
      templateType,
      templateSource: source,
      recipient,
      fromEmailLocalPart,
      fromEmail,
      fromHeader,
      error: msg,
    };
  }
}
