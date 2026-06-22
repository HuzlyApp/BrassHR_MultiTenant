import type { ApplicantMessage } from "@/app/application/components/applicant-portal/types";

const SESSION_RESET_KEY = "applicant-chat-session-reset";

export function markApplicantChatSessionReset(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_RESET_KEY, new Date().toISOString());
}

export function getApplicantChatSessionResetAt(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(SESSION_RESET_KEY);
}

export function isSupportTicketCreatedMessage(message: ApplicantMessage): boolean {
  return message.metadata?.type === "support_ticket_created";
}

/** Hide legacy ticket confirmations and messages from before the latest chat reset. */
export function filterApplicantMessagesForActiveSession(
  messages: ApplicantMessage[]
): ApplicantMessage[] {
  const resetAt = getApplicantChatSessionResetAt();
  const resetMs = resetAt ? new Date(resetAt).getTime() : NaN;

  return messages.filter((message) => {
    if (isSupportTicketCreatedMessage(message)) return false;
    if (!Number.isNaN(resetMs)) {
      const createdMs = new Date(message.created_at).getTime();
      if (!Number.isNaN(createdMs) && createdMs < resetMs) return false;
    }
    return true;
  });
}
