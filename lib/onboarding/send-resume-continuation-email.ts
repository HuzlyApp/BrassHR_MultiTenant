import type { SupabaseClient } from "@supabase/supabase-js";
import { writeActivityLog } from "@/lib/audit/activity-log";
import {
  buildApplicantEmailContext,
  contextToTemplateVariables,
} from "@/lib/email/applicant-email-context";
import { SendEmailError } from "@/lib/email/errors";
import { sendTemplatedEmail } from "@/lib/email/send-templated-email";
import { EMAIL_TEMPLATE_TYPE } from "@/lib/email-templates/template-keys";
import { isValidStep1Email } from "@/lib/onboardingStep1Validation";
import { normalizeParsedResume } from "@/lib/resumeParseQuality";

const EMAIL_FROM_TEXT_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

export type ResumeContinuationEmailTrigger =
  | "resume_upload"
  | "resume_parse"
  | "profile_save";

export type ResumeContinuationEmailResult = {
  outcome: "sent" | "skipped" | "failed";
  reason?: string;
  messageId?: string;
};

export type SendResumeContinuationEmailParams = {
  workerId: string;
  tenantId: string;
  resumeId: string;
  origin: string;
  tenantSlug?: string | null;
  trigger: ResumeContinuationEmailTrigger;
  extractedText?: string | null;
  parsedResume?: Record<string, unknown> | null;
  recipientEmailOverride?: string | null;
  request?: Request;
};

export function extractEmailFromResumeText(text: string | null | undefined): string | null {
  const raw = text?.trim();
  if (!raw) return null;
  const match = raw.match(EMAIL_FROM_TEXT_RE);
  if (!match?.[0]) return null;
  const candidate = match[0].trim().toLowerCase();
  return isValidStep1Email(candidate) ? candidate : null;
}

export function resolveResumeContinuationRecipientEmail(params: {
  workerEmail?: string | null;
  extractedText?: string | null;
  parsedResume?: Record<string, unknown> | null;
  override?: string | null;
}): string | null {
  const override = params.override?.trim().toLowerCase();
  if (override && isValidStep1Email(override)) return override;

  const workerEmail = params.workerEmail?.trim().toLowerCase();
  if (workerEmail && isValidStep1Email(workerEmail)) return workerEmail;

  if (params.parsedResume && Object.keys(params.parsedResume).length > 0) {
    const parsed = normalizeParsedResume(params.parsedResume);
    const parsedEmail = parsed.email.trim().toLowerCase();
    if (isValidStep1Email(parsedEmail)) return parsedEmail;
  }

  return extractEmailFromResumeText(params.extractedText);
}

export async function hasResumeContinuationEmailBeenSent(
  supabase: SupabaseClient,
  workerId: string,
  resumeId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("applicant_continuation_links")
    .select("id")
    .eq("worker_id", workerId)
    .eq("reason", "resume_continuation")
    .not("sent_at", "is", null)
    .filter("metadata->>resume_id", "eq", resumeId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.id);
}

async function logResumeContinuationOutcome(
  params: SendResumeContinuationEmailParams,
  result: ResumeContinuationEmailResult
): Promise<void> {
  const action =
    result.outcome === "sent"
      ? "onboarding.resume_continuation_email.sent"
      : result.outcome === "skipped"
        ? "onboarding.resume_continuation_email.skipped"
        : "onboarding.resume_continuation_email.failed";

  console.info(`[resume-continuation-email] ${result.outcome}`, {
    workerId: params.workerId,
    tenantId: params.tenantId,
    resumeId: params.resumeId,
    trigger: params.trigger,
    reason: result.reason ?? null,
    messageId: result.messageId ?? null,
  });

  await writeActivityLog({
    actorUserId: null,
    tenantId: params.tenantId,
    action,
    entityType: "worker",
    entityId: params.workerId,
    metadata: {
      resume_id: params.resumeId,
      trigger: params.trigger,
      outcome: result.outcome,
      reason: result.reason ?? null,
      message_id: result.messageId ?? null,
    },
    request: params.request,
  });
}

/**
 * Sends the resume-upload continuation email with a secure applicant continuation link.
 * Idempotent per worker + resume record (retries/reprocesses do not resend).
 */
export async function sendResumeContinuationEmail(
  supabase: SupabaseClient,
  params: SendResumeContinuationEmailParams
): Promise<ResumeContinuationEmailResult> {
  const workerId = params.workerId.trim();
  const tenantId = params.tenantId.trim();
  const resumeId = params.resumeId.trim();
  const origin = params.origin.trim();

  if (!workerId || !tenantId || !resumeId || !origin) {
    const result: ResumeContinuationEmailResult = {
      outcome: "skipped",
      reason: "MISSING_CONTEXT",
    };
    await logResumeContinuationOutcome(params, result);
    return result;
  }

  try {
    if (await hasResumeContinuationEmailBeenSent(supabase, workerId, resumeId)) {
      const result: ResumeContinuationEmailResult = {
        outcome: "skipped",
        reason: "ALREADY_SENT",
      };
      await logResumeContinuationOutcome(params, result);
      return result;
    }

    const { data: worker, error: workerError } = await supabase
      .from("worker")
      .select("id, tenant_id, email")
      .eq("id", workerId)
      .maybeSingle();

    if (workerError) throw workerError;
    if (!worker?.id || String(worker.tenant_id) !== tenantId) {
      const result: ResumeContinuationEmailResult = {
        outcome: "skipped",
        reason: "WORKER_NOT_FOUND",
      };
      await logResumeContinuationOutcome(params, result);
      return result;
    }

    const recipientEmail = resolveResumeContinuationRecipientEmail({
      workerEmail: worker.email != null ? String(worker.email) : null,
      extractedText: params.extractedText,
      parsedResume: params.parsedResume,
      override: params.recipientEmailOverride,
    });

    if (!recipientEmail) {
      const result: ResumeContinuationEmailResult = {
        outcome: "skipped",
        reason: "NO_EMAIL",
      };
      await logResumeContinuationOutcome(params, result);
      return result;
    }

    const ctx = await buildApplicantEmailContext(supabase, {
      tenantId,
      workerId,
      origin,
      continuationReason: "resume_continuation",
      recipientEmailOverride: recipientEmail,
      markContinuationSent: false,
      continuationMetadata: {
        resume_id: resumeId,
        trigger: params.trigger,
      },
    });

    if (!ctx) {
      const result: ResumeContinuationEmailResult = {
        outcome: "skipped",
        reason: "EMAIL_CONTEXT_UNAVAILABLE",
      };
      await logResumeContinuationOutcome(params, result);
      return result;
    }

    const sendResult = await sendTemplatedEmail(supabase, {
      to: recipientEmail,
      tenantId,
      templateKey: EMAIL_TEMPLATE_TYPE.RESUME_CONTINUATION,
      variables: contextToTemplateVariables(ctx),
    });

    if (!sendResult.sent) {
      const result: ResumeContinuationEmailResult = {
        outcome: "skipped",
        reason: sendResult.reason ?? "NOT_SENT",
      };
      await logResumeContinuationOutcome(params, result);
      return result;
    }

    if (ctx.continuationLinkId) {
      await supabase
        .from("applicant_continuation_links")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", ctx.continuationLinkId);
    }

    const result: ResumeContinuationEmailResult = {
      outcome: "sent",
      messageId: sendResult.messageId,
    };
    await logResumeContinuationOutcome(params, result);
    return result;
  } catch (e) {
    const reason =
      e instanceof SendEmailError
        ? e.code
        : e instanceof Error
          ? e.message
          : "UNKNOWN_ERROR";
    console.error("[resume-continuation-email] failed", {
      workerId,
      tenantId,
      resumeId,
      trigger: params.trigger,
      reason,
    });
    const result: ResumeContinuationEmailResult = {
      outcome: "failed",
      reason,
    };
    await logResumeContinuationOutcome(params, result);
    return result;
  }
}
