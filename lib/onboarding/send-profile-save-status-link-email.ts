import type { SupabaseClient } from "@supabase/supabase-js";
import { writeActivityLog } from "@/lib/audit/activity-log";
import {
  buildApplicantEmailContext,
  contextToTemplateVariables,
} from "@/lib/email/applicant-email-context";
import { SendEmailError } from "@/lib/email/errors";
import { sendTemplatedEmail } from "@/lib/email/send-templated-email";
import { EMAIL_TEMPLATE_TYPE } from "@/lib/email-templates/template-keys";
import { isDeliverableApplicantEmail } from "@/lib/onboardingStep1Validation";
import { normalizeTenantEmail } from "@/lib/tenant/tenant-email-uniqueness";

export const PROFILE_STATUS_LINK_DEDUP_MS = Number(
  process.env.PROFILE_STATUS_LINK_DEDUP_MS ?? 60 * 60 * 1000
);

export type ProfileStatusLinkEmailResult = {
  outcome: "sent" | "skipped" | "failed";
  reason?: string;
  messageId?: string;
};

export type SendProfileSaveStatusLinkEmailParams = {
  workerId: string;
  tenantId: string;
  recipientEmail: string;
  origin: string;
  tenantSlug?: string | null;
  request?: Request;
};

type WorkerStatusLinkRow = {
  id: string;
  tenant_id: string;
  status_link_sent_at: string | null;
  status_link_email: string | null;
};

export function shouldSkipProfileStatusLinkResend(params: {
  lastSentAt: string | null | undefined;
  lastSentEmail: string | null | undefined;
  recipientEmail: string;
  now?: Date;
}): { skip: boolean; reason?: string } {
  const email = normalizeTenantEmail(params.recipientEmail);
  if (!isDeliverableApplicantEmail(email)) {
    return { skip: true, reason: "INVALID_EMAIL" };
  }

  const lastEmail = params.lastSentEmail?.trim().toLowerCase() ?? null;
  if (!lastEmail || lastEmail !== email) {
    return { skip: false };
  }

  const lastSentAt = params.lastSentAt?.trim();
  if (!lastSentAt) return { skip: false };

  const sentAtMs = new Date(lastSentAt).getTime();
  if (!Number.isFinite(sentAtMs)) return { skip: false };

  const nowMs = params.now?.getTime() ?? Date.now();
  if (nowMs - sentAtMs < PROFILE_STATUS_LINK_DEDUP_MS) {
    return { skip: true, reason: "ALREADY_SENT_RECENTLY" };
  }

  return { skip: false };
}

async function persistWorkerStatusLinkTracking(
  supabase: SupabaseClient,
  workerId: string,
  patch: {
    status_link_sent_at?: string | null;
    status_link_email?: string | null;
    status_link_last_error?: string | null;
  }
): Promise<void> {
  const { error } = await supabase
    .from("worker")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workerId);

  if (error) throw error;
}

async function logProfileStatusLinkOutcome(
  params: SendProfileSaveStatusLinkEmailParams,
  result: ProfileStatusLinkEmailResult
): Promise<void> {
  const action =
    result.outcome === "sent"
      ? "onboarding.profile_status_link_email.sent"
      : result.outcome === "skipped"
        ? "onboarding.profile_status_link_email.skipped"
        : "onboarding.profile_status_link_email.failed";

  console.info(`[profile-status-link-email] ${result.outcome}`, {
    workerId: params.workerId,
    tenantId: params.tenantId,
    recipientEmail: normalizeTenantEmail(params.recipientEmail),
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
      trigger: "profile_save",
      recipient_email: normalizeTenantEmail(params.recipientEmail),
      outcome: result.outcome,
      reason: result.reason ?? null,
      message_id: result.messageId ?? null,
    },
    request: params.request,
  });
}

/**
 * Sends the tenant-scoped application continuation/status link after profile details save.
 * Idempotent per worker + recipient email within PROFILE_STATUS_LINK_DEDUP_MS; resends when email changes.
 */
export async function sendProfileSaveStatusLinkEmail(
  supabase: SupabaseClient,
  params: SendProfileSaveStatusLinkEmailParams
): Promise<ProfileStatusLinkEmailResult> {
  const workerId = params.workerId.trim();
  const tenantId = params.tenantId.trim();
  const origin = params.origin.trim();
  const recipientEmail = normalizeTenantEmail(params.recipientEmail);

  if (!workerId || !tenantId || !origin) {
    const result: ProfileStatusLinkEmailResult = {
      outcome: "skipped",
      reason: "MISSING_CONTEXT",
    };
    await logProfileStatusLinkOutcome(params, result);
    return result;
  }

  if (!isDeliverableApplicantEmail(recipientEmail)) {
    const result: ProfileStatusLinkEmailResult = {
      outcome: "skipped",
      reason: "INVALID_EMAIL",
    };
    await logProfileStatusLinkOutcome(params, result);
    return result;
  }

  try {
    const { data: worker, error: workerError } = await supabase
      .from("worker")
      .select("id, tenant_id, status_link_sent_at, status_link_email")
      .eq("id", workerId)
      .maybeSingle();

    if (workerError) throw workerError;

    const row = worker as WorkerStatusLinkRow | null;
    if (!row?.id || String(row.tenant_id) !== tenantId) {
      const result: ProfileStatusLinkEmailResult = {
        outcome: "skipped",
        reason: "WORKER_NOT_FOUND",
      };
      await logProfileStatusLinkOutcome(params, result);
      return result;
    }

    const dedup = shouldSkipProfileStatusLinkResend({
      lastSentAt: row.status_link_sent_at,
      lastSentEmail: row.status_link_email,
      recipientEmail,
    });

    if (dedup.skip) {
      const result: ProfileStatusLinkEmailResult = {
        outcome: "skipped",
        reason: dedup.reason ?? "ALREADY_SENT_RECENTLY",
      };
      await logProfileStatusLinkOutcome(params, result);
      return result;
    }

    const ctx = await buildApplicantEmailContext(supabase, {
      tenantId,
      workerId,
      origin,
      continuationReason: "application_status",
      recipientEmailOverride: recipientEmail,
      markContinuationSent: false,
      continuationMetadata: {
        trigger: "profile_save",
        recipient_email: recipientEmail,
      },
    });

    if (!ctx) {
      const result: ProfileStatusLinkEmailResult = {
        outcome: "skipped",
        reason: "EMAIL_CONTEXT_UNAVAILABLE",
      };
      await persistWorkerStatusLinkTracking(supabase, workerId, {
        status_link_last_error: result.reason,
      });
      await logProfileStatusLinkOutcome(params, result);
      return result;
    }

    console.info("[profile-status-link-email] continuation link generated", {
      workerId,
      continuationLinkId: ctx.continuationLinkId ?? null,
      statusLink: ctx.applicantContinuationLink,
    });

    const sendResult = await sendTemplatedEmail(supabase, {
      to: recipientEmail,
      tenantId,
      templateKey: EMAIL_TEMPLATE_TYPE.APPLICATION_STATUS,
      variables: contextToTemplateVariables(ctx),
    });

    if (!sendResult.sent) {
      const reason = sendResult.reason ?? "NOT_SENT";
      await persistWorkerStatusLinkTracking(supabase, workerId, {
        status_link_last_error: reason,
      });
      const result: ProfileStatusLinkEmailResult = {
        outcome: sendResult.skipped ? "skipped" : "failed",
        reason,
      };
      await logProfileStatusLinkOutcome(params, result);
      return result;
    }

    if (ctx.continuationLinkId) {
      await supabase
        .from("applicant_continuation_links")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", ctx.continuationLinkId);
    }

    await persistWorkerStatusLinkTracking(supabase, workerId, {
      status_link_sent_at: new Date().toISOString(),
      status_link_email: recipientEmail,
      status_link_last_error: null,
    });

    const result: ProfileStatusLinkEmailResult = {
      outcome: "sent",
      messageId: sendResult.messageId,
    };
    await logProfileStatusLinkOutcome(params, result);
    return result;
  } catch (e) {
    const reason =
      e instanceof SendEmailError
        ? e.code
        : e instanceof Error
          ? e.message
          : "UNKNOWN_ERROR";

    console.error("[profile-status-link-email] failed", {
      workerId,
      tenantId,
      recipientEmail,
      reason,
    });

    try {
      await persistWorkerStatusLinkTracking(supabase, workerId, {
        status_link_last_error: reason,
      });
    } catch (trackingError) {
      console.error("[profile-status-link-email] tracking update failed", trackingError);
    }

    const result: ProfileStatusLinkEmailResult = {
      outcome: "failed",
      reason,
    };
    await logProfileStatusLinkOutcome(params, result);
    return result;
  }
}
