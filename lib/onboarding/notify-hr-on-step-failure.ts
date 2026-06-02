import type { SupabaseClient } from "@supabase/supabase-js";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { sendCandidateEmail } from "@/lib/communication/send-candidate-email";
import { getWorkflowSettings } from "@/lib/onboarding/workflow-settings";
import { evaluateConditionalLogic } from "@/lib/onboarding/evaluate-conditional-logic";
import { resolveHrNotifyEmails } from "@/lib/onboarding/resolve-hr-notify-emails";
import type { TenantOnboardingStep } from "@/lib/onboarding/types";

export type HrFailureNotifyResult = {
  auditLogged: boolean;
  emailsAttempted: number;
  emailsSent: number;
  emailSkippedReason?: string;
};

/**
 * Durable audit first, then best-effort HR email via Resend (when configured).
 */
export async function notifyHrOnOnboardingStepFailure(params: {
  supabase: SupabaseClient;
  tenantId: string;
  workerId: string;
  applicantId: string;
  step: TenantOnboardingStep;
  failureReason?: string | null;
  request?: Request;
}): Promise<HrFailureNotifyResult> {
  const settings = getWorkflowSettings(params.step);
  if (!settings.notifyHrOnFail) {
    return { auditLogged: false, emailsAttempted: 0, emailsSent: 0 };
  }

  const conditional = evaluateConditionalLogic(settings.conditionalLogic);

  await writeActivityLog({
    actorUserId: null,
    action: "onboarding_step_failed_notify_hr",
    entityType: "onboarding_step",
    entityId: params.step.id,
    tenantId: params.tenantId,
    metadata: {
      tenant_id: params.tenantId,
      worker_id: params.workerId,
      applicant_id: params.applicantId,
      step_key: params.step.step_key,
      step_title: params.step.title,
      provider: settings.provider,
      notify_hr_on_fail: true,
      failure_reason: params.failureReason ?? null,
      pause_flow_on_fail: conditional.pauseFlowOnFail,
    },
    request: params.request,
  });

  const recipients = await resolveHrNotifyEmails(params.supabase, params.tenantId);
  if (!recipients.length) {
    return {
      auditLogged: true,
      emailsAttempted: 0,
      emailsSent: 0,
      emailSkippedReason: "NO_HR_RECIPIENTS",
    };
  }

  const subject = `Onboarding step failed: ${params.step.title}`;
  const body = [
    `A worker onboarding step has failed and requires HR attention.`,
    ``,
    `Step: ${params.step.title} (${params.step.step_key})`,
    `Applicant ID: ${params.applicantId}`,
    `Worker ID: ${params.workerId}`,
    settings.provider ? `Provider: ${settings.provider}` : null,
    params.failureReason ? `Reason: ${params.failureReason}` : null,
    conditional.pauseFlowOnFail ? `Note: Conditional logic requests pausing the flow on failure.` : null,
  ]
    .filter(Boolean)
    .join("\n");

  let emailsSent = 0;
  for (const to of recipients) {
    const result = await sendCandidateEmail({ to, subject, body });
    if (result.ok) emailsSent += 1;
  }

  if (emailsSent > 0) {
    await writeActivityLog({
      actorUserId: null,
      action: "onboarding_step_failed_hr_email_sent",
      entityType: "onboarding_step",
      entityId: params.step.id,
      tenantId: params.tenantId,
      metadata: {
        tenant_id: params.tenantId,
        recipients,
        emails_sent: emailsSent,
        step_key: params.step.step_key,
      },
      request: params.request,
    });
  }

  return {
    auditLogged: true,
    emailsAttempted: recipients.length,
    emailsSent,
    emailSkippedReason: emailsSent === 0 ? "SEND_FAILED_OR_RESEND_NOT_CONFIGURED" : undefined,
  };
}
