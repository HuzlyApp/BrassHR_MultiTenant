import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildApplicantEmailContext,
  contextToTemplateVariables,
  type SendOnboardingEmailParams,
} from "@/lib/email/applicant-email-context";
import { SendEmailError } from "@/lib/email/errors";
import { EmailTemplateError } from "@/lib/email-templates/errors";
import {
  assertNonEmptyEmailContent,
  interpolateTemplate,
  validateRequiredTemplateVariables,
} from "@/lib/email-templates/interpolation";
import { resolveEmailTemplate } from "@/lib/email-templates/resolver";
import { sanitizeEmailHtml } from "@/lib/email-templates/sanitize-html";
import type { OnboardingEmailTemplateKey } from "@/lib/email-templates/template-keys";
import { isEmailTemplateActive } from "@/lib/email-templates/types";
import { buildResendFromHeader } from "@/lib/email/from-address";

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export type SendTemplatedEmailResult = {
  sent: boolean;
  messageId?: string;
  skipped?: boolean;
  reason?: string;
};

export type SendTemplatedEmailOptions = {
  to: string;
  tenantId: string;
  templateKey: OnboardingEmailTemplateKey;
  variables: Record<string, string>;
  locale?: string;
};

/**
 * Resolves the active tenant (or global fallback) template, renders placeholders, and sends via Resend.
 */
export async function sendTemplatedEmail(
  supabase: SupabaseClient,
  options: SendTemplatedEmailOptions
): Promise<SendTemplatedEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not configured; skipping send", {
      templateKey: options.templateKey,
      tenantId: options.tenantId,
    });
    return { sent: false, skipped: true, reason: "RESEND_NOT_CONFIGURED" };
  }

  const locale = options.locale?.trim() || "en";
  const resolved = await resolveEmailTemplate(supabase, {
    tenantId: options.tenantId,
    templateKey: options.templateKey,
    locale,
  });

  const tpl = resolved.template;
  if (!isEmailTemplateActive(tpl)) {
    throw new SendEmailError("NOT_FOUND", "Email template is not active", 404);
  }

  validateRequiredTemplateVariables(tpl.variables, options.variables, {
    subject: tpl.subject,
    body_html: tpl.body_html,
    body_text: tpl.body_text,
  });

  const subject = interpolateTemplate(tpl.subject, options.variables, { escapeForHtml: false });
  const html = sanitizeEmailHtml(
    interpolateTemplate(tpl.body_html, options.variables, { escapeForHtml: true })
  );
  const textBody = tpl.body_text
    ? interpolateTemplate(tpl.body_text, options.variables, { escapeForHtml: false })
    : undefined;

  assertNonEmptyEmailContent(subject, html);

  let from: string;
  try {
    from = buildResendFromHeader(tpl);
  } catch (e) {
    if (e instanceof SendEmailError) throw e;
    throw new SendEmailError("NOT_CONFIGURED", "Could not build From address", 503);
  }

  const replyTo = tpl.reply_to_email?.trim() || undefined;

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: options.to,
      subject,
      html,
      ...(textBody ? { text: textBody } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
    });

    if (error) {
      console.error("[email] Resend send failed", {
        templateKey: options.templateKey,
        tenantId: options.tenantId,
        code: error.name,
      });
      throw new SendEmailError("SEND_FAILED", "Failed to send email", 502);
    }

    return { sent: true, messageId: data?.id };
  } catch (e) {
    if (e instanceof SendEmailError || e instanceof EmailTemplateError) throw e;
    console.error("[email] Unexpected send error", {
      templateKey: options.templateKey,
      tenantId: options.tenantId,
    });
    throw new SendEmailError("INTERNAL_ERROR", "Failed to send email", 500);
  }
}

export async function sendOnboardingApplicantEmail(
  supabase: SupabaseClient,
  params: SendOnboardingEmailParams
): Promise<SendTemplatedEmailResult> {
  const ctx = await buildApplicantEmailContext(supabase, {
    tenantId: params.tenantId,
    workerId: params.workerId,
    origin: params.origin,
    reason: params.reason,
  });

  if (!ctx) {
    throw new SendEmailError("NOT_FOUND", "Applicant or tenant not found", 404);
  }

  if (ctx.tenantId !== params.tenantId) {
    throw new SendEmailError("VALIDATION_ERROR", "Worker does not belong to tenant", 403);
  }

  return sendTemplatedEmail(supabase, {
    to: ctx.applicantEmail,
    tenantId: params.tenantId,
    templateKey: params.templateKey,
    variables: contextToTemplateVariables(ctx),
    locale: params.locale,
  });
}
