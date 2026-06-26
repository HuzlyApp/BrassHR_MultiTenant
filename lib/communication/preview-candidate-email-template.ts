import type { SupabaseClient } from "@supabase/supabase-js";
import { buildApplicationStatusUrl } from "@/lib/email/application-status-url";
import {
  buildApplicantEmailContext,
  contextToTemplateVariables,
} from "@/lib/email/applicant-email-context";
import { interpolateTemplate } from "@/lib/email-templates/interpolation";
import { resolveEmailTemplate } from "@/lib/email-templates/resolver";
import { sanitizeEmailHtml } from "@/lib/email-templates/sanitize-html";
import {
  isOnboardingEmailTemplateKey,
  type OnboardingEmailTemplateKey,
} from "@/lib/email-templates/template-keys";
import { htmlToPlainText } from "@/lib/communication/html-to-plain-text";
import { resolveWorkerContact } from "@/lib/communication/resolve-worker";
import { createApplicantContinuationLink } from "@/lib/onboarding/applicant-continuation-link";

export type CandidateEmailTemplatePreview = {
  template_key: OnboardingEmailTemplateKey;
  template_name: string;
  subject: string;
  body_html: string;
  body_text: string;
};

function applicantNameFromContact(contact: {
  firstName: string | null;
  lastName: string | null;
}): string {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  return name || "Applicant";
}

function resolveSupportEmail(tenantSlug: string): string {
  const configured = process.env.DEFAULT_SUPPORT_EMAIL?.trim();
  if (configured) return configured;
  const fromDomain = process.env.RESEND_FROM_EMAIL?.trim().split("@")[1];
  if (fromDomain) return `support@${fromDomain}`;
  return `support@${tenantSlug || "brasshr"}.com`;
}

async function buildTemplateVariables(
  supabase: SupabaseClient,
  workerId: string,
  tenantId: string,
  origin: string
): Promise<Record<string, string>> {
  const ctx = await buildApplicantEmailContext(supabase, {
    tenantId,
    workerId,
    origin,
    continuationReason: "manual_notification",
    markContinuationSent: false,
  });
  if (ctx) return contextToTemplateVariables(ctx);

  const contact = await resolveWorkerContact(supabase, workerId);
  if (!contact) {
    throw new Error("Candidate not found");
  }

  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("id, name, slug")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!tenant?.slug) throw new Error("Tenant not found");

  const slug = String(tenant.slug);
  const normalizedOrigin = origin.trim().replace(/\/+$/, "");
  const applicationStatusUrl = buildApplicationStatusUrl({
    origin: normalizedOrigin,
    tenantSlug: slug,
  });
  const applicantPortalUrl = `${normalizedOrigin}/?tenant=${encodeURIComponent(slug)}`;

  let applicantContinuationLink = applicationStatusUrl;
  try {
    const continuation = await createApplicantContinuationLink(supabase, {
      tenantId,
      workerId,
      origin: normalizedOrigin,
      tenantSlug: slug,
      reason: "manual_notification",
      markSent: false,
    });
    if (continuation?.url) applicantContinuationLink = continuation.url;
  } catch {
    /* use status URL fallback */
  }

  return {
    applicantName: applicantNameFromContact(contact),
    tenantName: String(tenant.name ?? slug),
    applicationStatusUrl,
    applicantPortalUrl,
    applicantContinuationLink,
    supportEmail: resolveSupportEmail(slug),
  };
}

export async function previewCandidateEmailTemplate(
  supabase: SupabaseClient,
  params: {
    workerId: string;
    templateKey: string;
    origin: string;
    locale?: string;
  }
): Promise<CandidateEmailTemplatePreview | null> {
  if (!isOnboardingEmailTemplateKey(params.templateKey)) {
    throw new Error("Invalid template key");
  }

  const contact = await resolveWorkerContact(supabase, params.workerId);
  if (!contact?.tenantId) return null;

  const locale = params.locale?.trim() || "en";
  const resolved = await resolveEmailTemplate(supabase, {
    tenantId: contact.tenantId,
    templateKey: params.templateKey,
    locale,
  });

  const variables = await buildTemplateVariables(
    supabase,
    params.workerId,
    contact.tenantId,
    params.origin
  );

  const tpl = resolved.template;
  const subject = interpolateTemplate(tpl.subject, variables, { escapeForHtml: false });
  const body_html = sanitizeEmailHtml(
    interpolateTemplate(tpl.body_html, variables, { escapeForHtml: true })
  );
  const body_text = tpl.body_text?.trim()
    ? interpolateTemplate(tpl.body_text, variables, { escapeForHtml: false })
    : htmlToPlainText(body_html);

  return {
    template_key: params.templateKey,
    template_name: tpl.name,
    subject,
    body_html,
    body_text,
  };
}
