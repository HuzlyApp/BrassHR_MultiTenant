import type { SupabaseClient } from "@supabase/supabase-js";
import { extractBareEmailAddress } from "@/lib/email/email-domain";
import { requireResendConfig } from "@/lib/communication/env";
import { sendCalendarEmail } from "@/lib/communication/send-calendar-email";
import { formatInterviewDate, formatInterviewTimeRange } from "@/lib/interviews/format";
import {
  buildInterviewIcs,
  formatTimezoneLabel,
  type IcsMethod,
} from "@/lib/interviews/ics";
import { isValidStep1Email } from "@/lib/onboardingStep1Validation";

export type InterviewAttendeeInput = {
  userId?: string | null;
  email: string;
  name: string;
  attendeeType?: "candidate" | "interviewer" | "organizer" | "optional";
};

export type InterviewScheduleRecord = {
  id: string;
  tenant_id: string;
  applicant_id: string;
  worker_id: string | null;
  application_id: string | null;
  job_id: string | null;
  title: string;
  description: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  status: string;
  meeting_link: string | null;
  location: string | null;
  meeting_type: string | null;
  notes: string | null;
  calendar_uid: string;
  calendar_sequence: number;
  organizer_email: string | null;
};

export type SendInterviewInvitationsResult = {
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  invitationStatus: "sent" | "partial" | "failed" | "pending";
  deliveries: Array<{ email: string; status: "sent" | "failed" | "skipped"; error?: string }>;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function uniqueAttendees(attendees: InterviewAttendeeInput[]): InterviewAttendeeInput[] {
  const map = new Map<string, InterviewAttendeeInput>();
  for (const attendee of attendees) {
    const email = normalizeEmail(attendee.email);
    if (!email || !isValidStep1Email(email)) continue;
    if (!map.has(email)) {
      map.set(email, {
        ...attendee,
        email,
        name: attendee.name.trim() || email,
      });
    }
  }
  return Array.from(map.values());
}

async function resolveOrganizer(
  supabase: SupabaseClient,
  tenantId: string,
  schedulerUserId: string | null,
  existingOrganizerEmail: string | null
): Promise<{ name: string; email: string }> {
  if (schedulerUserId) {
    const { data: user } = await supabase
      .from("users")
      .select("email, first_name, last_name")
      .eq("id", schedulerUserId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const email = user?.email ? normalizeEmail(String(user.email)) : "";
    if (email && isValidStep1Email(email)) {
      const name = `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() || "Recruiting Team";
      return { name, email };
    }
  }

  const configured = existingOrganizerEmail?.trim() || requireResendConfig().replyTo || "";
  const email = extractBareEmailAddress(configured);
  if (email && isValidStep1Email(email)) {
    return { name: "Recruiting Team", email };
  }

  const fromHeader = requireResendConfig().fromHeader;
  const fromEmail = extractBareEmailAddress(fromHeader);
  return { name: "Recruiting Team", email: fromEmail };
}

async function resolveCandidateEmail(
  supabase: SupabaseClient,
  tenantId: string,
  workerId: string | null,
  applicationId: string | null
): Promise<{ email: string; name: string } | null> {
  if (workerId) {
    const { data: worker } = await supabase
      .from("worker")
      .select("email, first_name, last_name")
      .eq("id", workerId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const email = worker?.email ? normalizeEmail(String(worker.email)) : "";
    if (email && isValidStep1Email(email)) {
      return {
        email,
        name: `${worker?.first_name ?? ""} ${worker?.last_name ?? ""}`.trim() || "Candidate",
      };
    }
  }

  if (applicationId?.trim()) {
    const { data: application } = await supabase
      .from("job_applications")
      .select("applicant_profiles(email, first_name, last_name)")
      .eq("id", applicationId.trim())
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const profileRaw = application?.applicant_profiles as
      | { email?: string | null; first_name?: string | null; last_name?: string | null }
      | Array<{ email?: string | null; first_name?: string | null; last_name?: string | null }>
      | null;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
    const email = profile?.email ? normalizeEmail(String(profile.email)) : "";
    if (email && isValidStep1Email(email)) {
      return {
        email,
        name: `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "Candidate",
      };
    }
  }

  return null;
}

function buildInvitationEmailBody(args: {
  recipientName: string;
  interviewTitle: string;
  jobTitle: string | null;
  candidateName: string;
  dateLabel: string;
  timeLabel: string;
  timezone: string;
  meetingLink: string | null;
  location: string | null;
  interviewerNames: string[];
  notes: string | null;
  companyName: string;
  isInterviewer: boolean;
  isCancellation: boolean;
  isUpdate: boolean;
}): { subject: string; body: string } {
  const timezoneLabel = formatTimezoneLabel(args.timezone);
  const jobLine = args.jobTitle?.trim() ? args.jobTitle.trim() : "Open role";
  const interviewerBlock =
    args.interviewerNames.length > 0
      ? `\nInterviewers\n${args.interviewerNames.map((name) => `- ${name}`).join("\n")}`
      : "";
  const notesBlock = args.notes?.trim() ? `\n\nNotes\n${args.notes.trim()}` : "";
  const meetingBlock = args.meetingLink?.trim()
    ? `\n\nJoin meeting\n${args.meetingLink.trim()}`
    : args.location?.trim()
      ? `\n\nLocation\n${args.location.trim()}`
      : "";

  if (args.isCancellation) {
    const subject = `Interview cancelled — ${args.interviewTitle}`;
    const body = `Hi ${args.recipientName},

The following interview has been cancelled:

${args.interviewTitle}
${jobLine}

${args.dateLabel}
${args.timeLabel}
${timezoneLabel}
${interviewerBlock}${notesBlock}

Regards,
${args.companyName} Recruiting Team`;
    return { subject, body };
  }

  if (args.isUpdate) {
    const subject = `Interview rescheduled — ${args.dateLabel}`;
    const intro = args.isInterviewer
      ? `The interview with ${args.candidateName} for ${jobLine} has been rescheduled.`
      : `Your interview for ${jobLine} has been rescheduled. Please review the updated details below.`;

    const body = `Hi ${args.recipientName},

${intro}

${args.interviewTitle}

Updated date
${args.dateLabel}

Updated time
${args.timeLabel}
${timezoneLabel}
${interviewerBlock}${meetingBlock}${notesBlock}

An updated calendar invitation is attached. Please replace any previous invite on your calendar.

Regards,
${args.companyName} Recruiting Team`;
    return { subject, body };
  }

  const subject = `${args.isInterviewer ? "Interview scheduled" : "Interview invitation"} — ${args.dateLabel}`;
  const intro = args.isInterviewer
    ? `You have been invited to interview ${args.candidateName} for ${jobLine}.`
    : `You have been invited to an interview for ${jobLine}.`;

  const body = `Hi ${args.recipientName},

${intro}

${args.interviewTitle}

Date
${args.dateLabel}

Time
${args.timeLabel}
${timezoneLabel}
${interviewerBlock}${meetingBlock}${notesBlock}

The calendar invitation is attached so you can add this interview to your calendar.

Regards,
${args.companyName} Recruiting Team`;

  return { subject, body };
}

export async function syncInterviewAttendees(
  supabase: SupabaseClient,
  args: {
    tenantId: string;
    interviewId: string;
    organizer: InterviewAttendeeInput;
    candidate: InterviewAttendeeInput | null;
    interviewers: InterviewAttendeeInput[];
  }
): Promise<void> {
  const desired = uniqueAttendees([
    { ...args.organizer, attendeeType: "organizer" },
    ...(args.candidate ? [{ ...args.candidate, attendeeType: "candidate" as const }] : []),
    ...args.interviewers.map((item) => ({ ...item, attendeeType: "interviewer" as const })),
  ]);

  const { data: existing, error: existingError } = await supabase
    .from("interview_attendees")
    .select("id, email")
    .eq("tenant_id", args.tenantId)
    .eq("interview_id", args.interviewId);
  if (existingError) throw existingError;

  const desiredEmails = new Set(desired.map((item) => normalizeEmail(item.email)));
  for (const row of existing ?? []) {
    if (!desiredEmails.has(normalizeEmail(String(row.email)))) {
      await supabase.from("interview_attendees").delete().eq("id", row.id);
    }
  }

  const existingByEmail = new Map(
    (existing ?? []).map((row) => [normalizeEmail(String(row.email)), row.id as string])
  );

  for (const attendee of desired) {
    const payload = {
      tenant_id: args.tenantId,
      interview_id: args.interviewId,
      user_id: attendee.userId ?? null,
      email: attendee.email,
      name: attendee.name,
      attendee_type: attendee.attendeeType ?? "interviewer",
    };
    const existingId = existingByEmail.get(attendee.email);
    if (existingId) {
      const { error } = await supabase.from("interview_attendees").update(payload).eq("id", existingId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("interview_attendees").insert(payload);
      if (error) throw error;
    }
  }
}

export async function sendInterviewInvitations(args: {
  supabase: SupabaseClient;
  tenantId: string;
  interview: InterviewScheduleRecord;
  schedulerUserId: string | null;
  candidateName: string;
  jobTitle?: string | null;
  interviewers: InterviewAttendeeInput[];
  deliveryType?: "request" | "update" | "cancel";
  candidateFacingNotes?: string | null;
}): Promise<SendInterviewInvitationsResult> {
  const deliveryType = args.deliveryType ?? "request";
  const method: IcsMethod = deliveryType === "cancel" ? "CANCEL" : "REQUEST";
  const icsStatus = deliveryType === "cancel" ? "CANCELLED" : "CONFIRMED";

  const { data: tenant } = await args.supabase
    .from("tenants")
    .select("name")
    .eq("id", args.tenantId)
    .maybeSingle();
  const companyName = tenant?.name?.trim() || "Our team";

  const organizer = await resolveOrganizer(
    args.supabase,
    args.tenantId,
    args.schedulerUserId,
    args.interview.organizer_email
  );

  const candidate = await resolveCandidateEmail(
    args.supabase,
    args.tenantId,
    args.interview.worker_id,
    args.interview.application_id
  );

  await syncInterviewAttendees(args.supabase, {
    tenantId: args.tenantId,
    interviewId: args.interview.id,
    organizer: { email: organizer.email, name: organizer.name, attendeeType: "organizer" },
    candidate: candidate
      ? { email: candidate.email, name: candidate.name, attendeeType: "candidate" }
      : null,
    interviewers: args.interviewers,
  });

  const { data: attendeeRows } = await args.supabase
    .from("interview_attendees")
    .select("id, email, name, attendee_type")
    .eq("tenant_id", args.tenantId)
    .eq("interview_id", args.interview.id);

  const interviewerNames = (attendeeRows ?? [])
    .filter((row) => row.attendee_type === "interviewer" || row.attendee_type === "organizer")
    .map((row) => String(row.name ?? row.email));

  const { startsAt, endsAt } = {
    startsAt: `${args.interview.scheduled_date}T${args.interview.start_time}`,
    endsAt: `${args.interview.scheduled_date}T${args.interview.end_time}`,
  };
  const dateLabel = formatInterviewDate(startsAt);
  const timeLabel = formatInterviewTimeRange(startsAt, endsAt);
  const location =
    args.interview.meeting_type === "in_person"
      ? args.interview.location
      : args.interview.meeting_link;

  const ics = buildInterviewIcs({
    uid: args.interview.calendar_uid,
    sequence: args.interview.calendar_sequence,
    method,
    status: icsStatus,
    startDate: args.interview.scheduled_date,
    startTime: args.interview.start_time,
    endDate: args.interview.scheduled_date,
    endTime: args.interview.end_time,
    timezone: args.interview.timezone,
    summary: args.interview.title,
    description: args.interview.description?.trim() || args.interview.title,
    location,
    organizer,
    attendees: (attendeeRows ?? []).map((row) => ({
      name: String(row.name ?? row.email),
      email: String(row.email),
      role: row.attendee_type === "optional" ? "OPT-PARTICIPANT" : "REQ-PARTICIPANT",
    })),
  });

  const deliveries: SendInterviewInvitationsResult["deliveries"] = [];
  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const attendee of attendeeRows ?? []) {
    const email = normalizeEmail(String(attendee.email));
    if (!email || !isValidStep1Email(email)) {
      skippedCount += 1;
      deliveries.push({ email, status: "skipped", error: "Invalid email" });
      continue;
    }

    const isInterviewer =
      attendee.attendee_type === "interviewer" || attendee.attendee_type === "organizer";

    const { subject, body } = buildInvitationEmailBody({
      recipientName: String(attendee.name ?? "there"),
      interviewTitle: args.interview.title,
      jobTitle: args.jobTitle ?? null,
      candidateName: args.candidateName,
      dateLabel,
      timeLabel,
      timezone: args.interview.timezone,
      meetingLink: args.interview.meeting_link,
      location: args.interview.location,
      interviewerNames,
      notes: isInterviewer ? args.interview.notes : args.candidateFacingNotes ?? null,
      companyName,
      isInterviewer,
      isCancellation: deliveryType === "cancel",
      isUpdate: deliveryType === "update",
    });

    const { data: deliveryRow, error: deliveryInsertError } = await args.supabase
      .from("interview_invitation_deliveries")
      .insert({
        tenant_id: args.tenantId,
        interview_id: args.interview.id,
        attendee_id: attendee.id,
        recipient_email: email,
        recipient_name: attendee.name,
        delivery_type: deliveryType,
        status: "pending",
      })
      .select("id")
      .single();
    if (deliveryInsertError) throw deliveryInsertError;

    const sendResult = await sendCalendarEmail({
      to: email,
      subject,
      body,
      calendarAttachment: {
        filename: deliveryType === "cancel" ? "cancel.ics" : "invite.ics",
        content: ics,
        method,
      },
    });

    if (sendResult.ok) {
      sentCount += 1;
      deliveries.push({ email, status: "sent" });
      await args.supabase
        .from("interview_invitation_deliveries")
        .update({
          status: "sent",
          provider_message_id: sendResult.messageId,
          sent_at: new Date().toISOString(),
        })
        .eq("id", deliveryRow.id);
    } else {
      failedCount += 1;
      deliveries.push({ email, status: "failed", error: sendResult.error });
      await args.supabase
        .from("interview_invitation_deliveries")
        .update({
          status: "failed",
          error_message: sendResult.error,
        })
        .eq("id", deliveryRow.id);
    }
  }

  const invitationStatus =
    sentCount === 0 && failedCount > 0
      ? "failed"
      : failedCount > 0
        ? "partial"
        : sentCount > 0
          ? "sent"
          : "pending";

  await args.supabase
    .from("interview_schedules")
    .update({
      invitation_status: invitationStatus,
      last_invitation_sent_at: sentCount > 0 ? new Date().toISOString() : null,
      organizer_email: organizer.email,
    })
    .eq("id", args.interview.id)
    .eq("tenant_id", args.tenantId);

  return {
    sentCount,
    failedCount,
    skippedCount,
    invitationStatus,
    deliveries,
  };
}
