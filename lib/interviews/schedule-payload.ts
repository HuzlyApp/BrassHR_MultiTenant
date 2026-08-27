export type InterviewMeetingType = "online" | "phone" | "in_person";

export type ScheduleInterviewInterviewer = {
  userId?: string | null;
  email: string;
  name: string;
};

export type ScheduleInterviewPayload = {
  workerId: string;
  applicationId?: string | null;
  jobId?: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  title: string;
  meetingType: InterviewMeetingType;
  meetingLink?: string | null;
  location?: string | null;
  notes?: string | null;
  candidateNotes?: string | null;
  interviewers: ScheduleInterviewInterviewer[];
};

export type InterviewInvitationSummary = {
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  invitationStatus: "sent" | "partial" | "failed" | "pending";
};

export function invitationSuccessMessage(summary: InterviewInvitationSummary | null | undefined): string {
  if (!summary) return "Interview scheduled.";
  if (summary.invitationStatus === "sent") {
    return "Interview scheduled and invitations sent.";
  }
  if (summary.invitationStatus === "partial") {
    return "Interview scheduled, but one or more invitations could not be delivered.";
  }
  if (summary.invitationStatus === "failed") {
    return "Interview scheduled, but invitations could not be delivered.";
  }
  if (summary.skippedCount > 0 && summary.sentCount === 0) {
    return "Interview scheduled. No valid recipient emails were found.";
  }
  return "Interview scheduled.";
}

export function invitationRescheduleMessage(
  summary: InterviewInvitationSummary | null | undefined
): string {
  if (!summary) return "Interview rescheduled.";
  if (summary.invitationStatus === "sent") {
    return "Interview rescheduled and update emails sent to the applicant and interviewers.";
  }
  if (summary.invitationStatus === "partial") {
    return "Interview rescheduled, but one or more update emails could not be delivered.";
  }
  if (summary.invitationStatus === "failed") {
    return "Interview rescheduled, but update emails could not be delivered.";
  }
  if (summary.skippedCount > 0 && summary.sentCount === 0) {
    return "Interview rescheduled. No valid recipient emails were found.";
  }
  return "Interview rescheduled.";
}
