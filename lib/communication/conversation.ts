import { createHash } from "node:crypto";
import { extractBareEmailAddress } from "@/lib/email/email-domain";
import { buildFromEmailAddress, DEFAULT_FROM_EMAIL_LOCAL_PART } from "@/lib/email/from-address";
import { normalizePhoneToE164 } from "@/lib/communication/phone";
import type {
  CandidateCommunicationRow,
  CommunicationChannel,
} from "@/lib/communication/record";
import {
  type CommunicationThread,
  defaultReplySubject,
} from "@/lib/communication/conversation-client";

export type { CommunicationThread };
export { defaultReplySubject };

/** Stable conversation id per worker + channel (one email thread per contact). */
export function buildConversationId(workerId: string, channel: CommunicationChannel): string {
  const digest = createHash("sha256").update(`brasshr:conversation:${workerId}:${channel}`).digest("hex");
  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `4${digest.slice(13, 16)}`,
    `8${digest.slice(17, 20)}`,
    digest.slice(20, 32),
  ].join("-");
}

export function getCompanyNotificationEmail(): string {
  try {
    return buildFromEmailAddress(DEFAULT_FROM_EMAIL_LOCAL_PART);
  } catch {
    return "notifications@brasshr.com";
  }
}

/** Strip Re:/Fwd: prefixes for thread grouping. */
export function normalizeEmailSubject(subject: string | null | undefined): string {
  if (!subject?.trim()) return "";
  let s = subject.trim();
  for (let i = 0; i < 5; i++) {
    const next = s.replace(/^(re|fwd|fw):\s*/i, "").trim();
    if (next === s) break;
    s = next;
  }
  return s.toLowerCase();
}

export function contactEmailFromRow(row: Pick<CandidateCommunicationRow, "direction" | "contact_email" | "from_email" | "to_email" | "recipient" | "channel">): string | null {
  if (row.channel !== "email") return null;
  if (row.contact_email?.trim()) return row.contact_email.trim().toLowerCase();
  if (row.direction === "inbound" && row.from_email?.trim()) {
    return extractBareEmailAddress(row.from_email);
  }
  if (row.direction === "outbound" && row.to_email?.trim()) {
    return extractBareEmailAddress(row.to_email);
  }
  return extractBareEmailAddress(row.recipient);
}

export function senderLabel(
  row: Pick<CandidateCommunicationRow, "direction" | "channel" | "from_email" | "to_email">,
  contactName: string
): string {
  if (row.channel === "sms") {
    return row.direction === "inbound" ? contactName : "Recruiter";
  }
  if (row.direction === "inbound") {
    return row.from_email?.trim() || contactName;
  }
  return row.from_email?.trim() || "Recruiter";
}

export function contactPhoneFromRow(
  row: Pick<CandidateCommunicationRow, "direction" | "recipient" | "channel">
): string | null {
  if (row.channel !== "sms") return null;
  const raw = row.recipient?.trim();
  if (!raw) return null;
  return normalizePhoneToE164(raw) ?? raw;
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  const na = normalizePhoneToE164(a) ?? a.trim();
  const nb = normalizePhoneToE164(b) ?? b.trim();
  return na === nb;
}

function rowBelongsToContact(
  row: CandidateCommunicationRow,
  contact: { email?: string | null; phone?: string | null }
): boolean {
  if (row.channel === "email") {
    const contactEmail = contact.email?.trim().toLowerCase();
    if (!contactEmail) return true;
    return contactEmailFromRow(row) === contactEmail;
  }
  if (row.channel === "sms") {
    const contactPhone = contact.phone?.trim();
    if (!contactPhone) return true;
    return phonesMatch(contactPhoneFromRow(row), contactPhone);
  }
  return true;
}

export function buildCommunicationThreads(
  rows: CandidateCommunicationRow[],
  workerId: string,
  contact: { email?: string | null; phone?: string | null }
): CommunicationThread[] {
  const scopedRows = rows.filter((row) => rowBelongsToContact(row, contact));
  const byChannel = new Map<CommunicationChannel, CandidateCommunicationRow[]>();
  for (const row of scopedRows) {
    const list = byChannel.get(row.channel) ?? [];
    list.push(row);
    byChannel.set(row.channel, list);
  }

  const threads: CommunicationThread[] = [];

  for (const channel of ["email", "sms"] as const) {
    const messages = (byChannel.get(channel) ?? []).slice().sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    if (messages.length === 0) continue;

    const latest = messages[messages.length - 1];
    const emailSubjects = messages
      .filter((m) => m.channel === "email" && m.subject)
      .map((m) => normalizeEmailSubject(m.subject));
    const rootSubject =
      emailSubjects.find((s) => s.length > 0) ??
      (latest.subject ? normalizeEmailSubject(latest.subject) : null);
    const contactPhone =
      contact.phone?.trim() ??
      (channel === "sms" ? contactPhoneFromRow(messages[0]) : null);

    threads.push({
      conversationId: buildConversationId(workerId, channel),
      channel,
      contactId: workerId,
      contactEmail: contact.email?.trim().toLowerCase() ?? contactEmailFromRow(messages[0]) ?? null,
      contactPhone: contactPhone ? normalizePhoneToE164(contactPhone) ?? contactPhone : null,
      messageCount: messages.length,
      latestAt: latest.created_at,
      latestStatus: latest.status,
      latestSubject: channel === "email" ? latest.subject : null,
      rootSubject: rootSubject || latest.subject,
      latestPreview: latest.body.replace(/\s+/g, " ").trim().slice(0, 140),
      unreadCount: messages.filter(
        (m) => m.direction === "inbound" && m.status === "received"
      ).length,
      messages,
    });
  }

  return threads.sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
}
