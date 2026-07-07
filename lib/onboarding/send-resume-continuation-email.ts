import type { SupabaseClient } from "@supabase/supabase-js";
import { writeActivityLog } from "@/lib/audit/activity-log";
import {
  buildApplicantEmailContext,
  contextToTemplateVariables,
} from "@/lib/email/applicant-email-context";
import { SendEmailError } from "@/lib/email/errors";
import { sendTemplatedEmail } from "@/lib/email/send-templated-email";
import { EMAIL_TEMPLATE_TYPE } from "@/lib/email-templates/template-keys";
import { extractEmailFromResumeText } from "@/lib/onboarding/extract-email-from-resume-text";
import {
  isDeliverableApplicantEmail,
  isValidStep1Email,
} from "@/lib/onboardingStep1Validation";
import { normalizeParsedResume } from "@/lib/resumeParseQuality";

export { extractEmailFromResumeText } from "@/lib/onboarding/extract-email-from-resume-text";

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

export function resolveResumeContinuationRecipientEmail(params: {
  workerEmail?: string | null;
  extractedText?: string | null;
  parsedResume?: Record<string, unknown> | null;
  override?: string | null;
  authUserEmail?: string | null;
}): string | null {
  const override = params.override?.trim().toLowerCase();
  if (override && isDeliverableApplicantEmail(override)) return override;

  const workerEmail = params.workerEmail?.trim().toLowerCase();
  if (workerEmail && isDeliverableApplicantEmail(workerEmail)) return workerEmail;

  const authUserEmail = params.authUserEmail?.trim().toLowerCase();
  if (authUserEmail && isDeliverableApplicantEmail(authUserEmail)) return authUserEmail;

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
      .select("id, tenant_id, email, user_id")
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

    let authUserEmail: string | null = null;
    const applicantUserId =
      worker.user_id != null ? String(worker.user_id).trim() : "";
    if (applicantUserId) {
      const { data: authData, error: authErr } =
        await supabase.auth.admin.getUserById(applicantUserId);
      if (!authErr) {
        authUserEmail = authData?.user?.email?.trim().toLowerCase() ?? null;
      }
    }

    const recipientEmail = resolveResumeContinuationRecipientEmail({
      workerEmail: worker.email != null ? String(worker.email) : null,
      authUserEmail,
      extractedText: params.extractedText,
      parsedResume: params.parsedResume,
      override: params.recipientEmailOverride,
    });

    console.info("[resume-continuation-email] recipient resolved", {
      workerId,
      resumeId,
      trigger: params.trigger,
      hasWorkerEmail: Boolean(worker.email?.toString().trim()),
      hasAuthUserEmail: Boolean(authUserEmail),
      hasExtractedText: Boolean(params.extractedText?.trim()),
      hasParsedResume: Boolean(params.parsedResume && Object.keys(params.parsedResume).length > 0),
      recipientFound: Boolean(recipientEmail),
    });

    if (!recipientEmail) {
      const result: ResumeContinuationEmailResult = {
        outcome: "skipped",
        reason: "NO_EMAIL",
      };
      await logResumeContinuationOutcome(params, result);
      return result;
    }

    if (
      authUserEmail &&
      recipientEmail === authUserEmail.toLowerCase() &&
      !worker.email?.toString().trim()
    ) {
      await supabase
        .from("worker")
        .update({ email: recipientEmail, updated_at: new Date().toISOString() })
        .eq("id", workerId);
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

    console.info("[resume-continuation-email] status link generated", {
      workerId,
      resumeId,
      continuationLinkId: ctx.continuationLinkId ?? null,
      statusLink: ctx.applicantContinuationLink,
    });

    const sendResult = await sendTemplatedEmail(supabase, {
      to: recipientEmail,
      tenantId,
      templateKey: EMAIL_TEMPLATE_TYPE.RESUME_CONTINUATION,
      variables: contextToTemplateVariables(ctx),
    });

    if (!sendResult.sent) {
      console.warn("[resume-continuation-email] template send skipped", {
        workerId,
        resumeId,
        reason: sendResult.reason ?? "NOT_SENT",
      });
      const result: ResumeContinuationEmailResult = {
        outcome: sendResult.skipped ? "skipped" : "failed",
        reason: sendResult.reason ?? "NOT_SENT",
      };
      await logResumeContinuationOutcome(params, result);
      return result;
    }

    console.info("[resume-continuation-email] email sent", {
      workerId,
      resumeId,
      messageId: sendResult.messageId ?? null,
      to: recipientEmail,
    });

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
