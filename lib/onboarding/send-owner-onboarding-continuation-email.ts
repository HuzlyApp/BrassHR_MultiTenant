import type { SupabaseClient } from "@supabase/supabase-js";
import { writeActivityLog } from "@/lib/audit/activity-log";
import {
  createOwnerOnboardingContinuationLink,
  hasOwnerSignupContinuationBeenSent,
  revokeActiveOwnerContinuationLinks,
} from "@/lib/onboarding/owner-onboarding-continuation-link";
import { sendTemplatedEmail } from "@/lib/email/send-templated-email";
import { EMAIL_TEMPLATE_TYPE_PLATFORM } from "@/lib/email-templates/template-keys";
import { PLATFORM_DEFAULT_TENANT_SLUG } from "@/lib/tenant/tenant-branding";

export const TENANT_ONBOARDING_CONTINUATION_TEMPLATE_KEY =
  EMAIL_TEMPLATE_TYPE_PLATFORM.TENANT_ONBOARDING_CONTINUATION;

export type OwnerOnboardingEmailResult = {
  outcome: "sent" | "skipped" | "failed";
  reason?: string;
  messageId?: string;
};

export type SendOwnerOnboardingContinuationEmailParams = {
  userId: string;
  email: string;
  tenantAdminName: string;
  origin: string;
  resend?: boolean;
  request?: Request;
};

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e && typeof e.message === "string") {
    return e.message;
  }
  return "UNKNOWN_ERROR";
}

function resolveSupportEmail(): string {
  const configured = process.env.DEFAULT_SUPPORT_EMAIL?.trim();
  if (configured) return configured;
  const fromDomain = process.env.RESEND_FROM_EMAIL?.trim().split("@")[1];
  if (fromDomain) return `support@${fromDomain}`;
  return "support@brasshr.com";
}

async function logOwnerOnboardingEmailOutcome(
  params: SendOwnerOnboardingContinuationEmailParams,
  result: OwnerOnboardingEmailResult
): Promise<void> {
  const action =
    result.outcome === "sent"
      ? "owner.signup_continuation_email.sent"
      : result.outcome === "skipped"
        ? "owner.signup_continuation_email.skipped"
        : "owner.signup_continuation_email.failed";

  console.info(`[owner-onboarding-email] ${result.outcome}`, {
    userId: params.userId,
    email: params.email,
    resend: params.resend ?? false,
    reason: result.reason ?? null,
    messageId: result.messageId ?? null,
  });

  await writeActivityLog({
    actorUserId: params.userId,
    action,
    entityType: "user",
    entityId: params.userId,
    metadata: {
      email: params.email,
      resend: params.resend ?? false,
      outcome: result.outcome,
      reason: result.reason ?? null,
      message_id: result.messageId ?? null,
    },
    request: params.request,
  });
}

/**
 * Sends the tenant onboarding continuation email with a secure setup link.
 * Idempotent for initial signup (skips if already sent unless resend=true).
 */
export async function sendOwnerOnboardingContinuationEmail(
  supabase: SupabaseClient,
  params: SendOwnerOnboardingContinuationEmailParams
): Promise<OwnerOnboardingEmailResult> {
  const userId = params.userId.trim();
  const email = params.email.trim().toLowerCase();
  const origin = params.origin.trim();

  if (!userId || !email || !origin) {
    const result: OwnerOnboardingEmailResult = { outcome: "skipped", reason: "MISSING_CONTEXT" };
    await logOwnerOnboardingEmailOutcome(params, result);
    return result;
  }

  try {
    if (!params.resend && (await hasOwnerSignupContinuationBeenSent(supabase, userId))) {
      const result: OwnerOnboardingEmailResult = { outcome: "skipped", reason: "ALREADY_SENT" };
      await logOwnerOnboardingEmailOutcome(params, result);
      return result;
    }

    if (params.resend) {
      await revokeActiveOwnerContinuationLinks(supabase, userId);
    }

    const continuation = await createOwnerOnboardingContinuationLink(supabase, {
      userId,
      email,
      origin,
      reason: params.resend ? "resend" : "signup_continuation",
      markSent: false,
      metadata: { trigger: params.resend ? "resend" : "signup" },
    });

    if (!continuation?.url) {
      const result: OwnerOnboardingEmailResult = {
        outcome: "failed",
        reason: "LINK_CREATE_FAILED",
      };
      await logOwnerOnboardingEmailOutcome(params, result);
      return result;
    }

    const variables = {
      tenantAdminName: params.tenantAdminName.trim() || "there",
      tenantName: PLATFORM_DEFAULT_TENANT_SLUG,
      tenantOnboardingStatusLink: continuation.url,
      tenantEmail: email,
      supportEmail: resolveSupportEmail(),
    };

    const { data: platformTenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("slug", PLATFORM_DEFAULT_TENANT_SLUG)
      .maybeSingle();

    const tenantIdForTemplate =
      platformTenant?.id != null ? String(platformTenant.id) : "00000000-0000-0000-0000-000000000000";

    const sendResult = await sendTemplatedEmail(supabase, {
      to: email,
      tenantId: tenantIdForTemplate,
      templateKey: EMAIL_TEMPLATE_TYPE_PLATFORM.TENANT_ONBOARDING_CONTINUATION,
      variables,
    });

    if (!sendResult.sent) {
      const result: OwnerOnboardingEmailResult = {
        outcome: "skipped",
        reason: sendResult.reason ?? "NOT_SENT",
      };
      await logOwnerOnboardingEmailOutcome(params, result);
      return result;
    }

    await supabase
      .from("owner_onboarding_continuation_links")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", continuation.id);

    const result: OwnerOnboardingEmailResult = {
      outcome: "sent",
      messageId: sendResult.messageId,
    };
    await logOwnerOnboardingEmailOutcome(params, result);
    return result;
  } catch (e) {
    const reason = errorMessage(e);
    console.error("[owner-onboarding-email] failed", {
      userId,
      email,
      reason,
      error: e,
    });
    const result: OwnerOnboardingEmailResult = { outcome: "failed", reason };
    await logOwnerOnboardingEmailOutcome(params, result);
    return result;
  }
}
