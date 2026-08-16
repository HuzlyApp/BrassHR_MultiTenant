import type { SupabaseClient } from "@supabase/supabase-js";
import { sendCandidateEmail } from "@/lib/communication/send-candidate-email";
import { formatInterviewDate, formatInterviewTimeRange } from "@/lib/interviews/format";
import { isValidStep1Email } from "@/lib/onboardingStep1Validation";

export type SendScheduledInterviewEmailParams = {
  supabase: SupabaseClient;
  tenantId: string;
  workerId: string;
  applicationId?: string | null;
  applicantName: string;
  interviewTitle: string;
  startsAt: string;
  endsAt: string | null;
  meetingLink?: string | null;
  jobTitle?: string | null;
};

export type SendScheduledInterviewEmailResult = {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
};

async function resolveRecipientEmail(
  supabase: SupabaseClient,
  tenantId: string,
  workerId: string,
  applicationId?: string | null
): Promise<string | null> {
  const { data: worker, error: workerError } = await supabase
    .from("worker")
    .select("email")
    .eq("id", workerId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (workerError) throw workerError;

  const workerEmail = worker?.email != null ? String(worker.email).trim().toLowerCase() : "";
  if (workerEmail && isValidStep1Email(workerEmail)) return workerEmail;

  if (applicationId?.trim()) {
    const { data: application, error: appError } = await supabase
      .from("job_applications")
      .select("applicant_profiles(email)")
      .eq("id", applicationId.trim())
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (appError) throw appError;

    const profileRaw = application?.applicant_profiles as
      | { email?: string | null }
      | { email?: string | null }[]
      | null;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
    const profileEmail = profile?.email != null ? String(profile.email).trim().toLowerCase() : "";
    if (profileEmail && isValidStep1Email(profileEmail)) return profileEmail;
  }

  const { data: profileRow, error: profileError } = await supabase
    .from("applicant_profiles")
    .select("email")
    .eq("tenant_id", tenantId)
    .eq("worker_id", workerId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (profileError) throw profileError;

  const fallbackEmail =
    profileRow?.email != null ? String(profileRow.email).trim().toLowerCase() : "";
  if (fallbackEmail && isValidStep1Email(fallbackEmail)) return fallbackEmail;

  return null;
}

export async function sendScheduledInterviewEmail(
  params: SendScheduledInterviewEmailParams
): Promise<SendScheduledInterviewEmailResult> {
  const recipient = await resolveRecipientEmail(
    params.supabase,
    params.tenantId,
    params.workerId,
    params.applicationId
  );

  if (!recipient) {
    return { sent: false, skipped: true, reason: "NO_RECIPIENT_EMAIL" };
  }

  const { data: tenant, error: tenantError } = await params.supabase
    .from("tenants")
    .select("name")
    .eq("id", params.tenantId)
    .maybeSingle();

  if (tenantError) throw tenantError;

  const companyName = tenant?.name?.trim() || "Our team";
  const dateLabel = formatInterviewDate(params.startsAt);
  const timeLabel = formatInterviewTimeRange(params.startsAt, params.endsAt);
  const jobLine = params.jobTitle?.trim()
    ? ` for the ${params.jobTitle.trim()} position`
    : "";

  const meetingLink = params.meetingLink?.trim() || "";
  const meetingLine = meetingLink
    ? `\n\nJoin the interview: ${meetingLink}`
    : "\n\nWe will share meeting details separately if needed.";

  const subject = `Interview scheduled — ${dateLabel}`;
  const body = `Hi ${params.applicantName.trim() || "there"},

Your ${params.interviewTitle}${jobLine} has been scheduled with ${companyName}.

Date: ${dateLabel}
Time: ${timeLabel}${meetingLine}

If you need to reschedule, reply to this email.

Thank you,
${companyName}`;

  const result = await sendCandidateEmail({
    to: recipient,
    subject,
    body,
  });

  if (!result.ok) {
    console.warn("[interviews/email] failed to send scheduled interview email", {
      workerId: params.workerId,
      error: result.error,
    });
    return { sent: false, skipped: true, reason: result.error };
  }

  return { sent: true };
}
