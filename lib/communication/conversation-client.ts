import type {
  CandidateCommunicationRow,
  CommunicationChannel,
  CommunicationStatus,
} from "@/lib/communication/record";

export type CommunicationThread = {
  conversationId: string;
  channel: CommunicationChannel;
  contactId: string;
  contactEmail: string | null;
  contactPhone: string | null;
  messageCount: number;
  latestAt: string;
  latestStatus: CommunicationStatus;
  latestSubject: string | null;
  rootSubject: string | null;
  latestPreview: string;
  unreadCount: number;
  messages: CandidateCommunicationRow[];
};

export function defaultReplySubject(thread: CommunicationThread): string {
  if (thread.channel !== "email") return "";
  const latest = thread.messages[thread.messages.length - 1];
  const subject = latest?.subject?.trim() || thread.rootSubject || "Application status";
  return subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`;
}
