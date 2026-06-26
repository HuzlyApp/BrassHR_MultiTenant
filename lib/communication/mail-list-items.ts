import { communicationDirectionFromRow } from "@/lib/communication/direction";
import type { TenantMailInboxItem } from "@/lib/communication/list-tenant-mail-inbox";

export type MailInboxListItem = {
  workerId: string;
  candidateName: string;
  contactEmail: string | null;
  profilePhotoUrl: string | null;
  subject: string;
  preview: string;
  latestAt: string;
  inboundCount: number;
};

export type MailSentListItem = {
  id: string;
  workerId: string;
  candidateName: string;
  contactEmail: string | null;
  profilePhotoUrl: string | null;
  subject: string;
  preview: string;
  sentAt: string;
};

function messagePreview(body: string): string {
  return body.replace(/\s+/g, " ").trim().slice(0, 140);
}

export function buildMailInboxListItems(items: TenantMailInboxItem[]): MailInboxListItem[] {
  const rows: MailInboxListItem[] = [];

  for (const item of items) {
    const inboundMessages = item.thread.messages.filter(
      (message) => communicationDirectionFromRow(message) === "inbound"
    );
    if (inboundMessages.length === 0) continue;

    const latestInbound = inboundMessages[inboundMessages.length - 1];
    rows.push({
      workerId: item.workerId,
      candidateName: item.candidateName,
      contactEmail: item.contactEmail,
      profilePhotoUrl: item.profilePhotoUrl,
      subject:
        latestInbound.subject?.trim() ||
        item.thread.rootSubject ||
        item.thread.latestSubject ||
        "No subject",
      preview: messagePreview(latestInbound.body),
      latestAt: latestInbound.created_at,
      inboundCount: inboundMessages.length,
    });
  }

  return rows.sort(
    (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
  );
}

export function buildMailSentListItems(items: TenantMailInboxItem[]): MailSentListItem[] {
  const rows: MailSentListItem[] = [];

  for (const item of items) {
    for (const message of item.thread.messages) {
      if (communicationDirectionFromRow(message) !== "outbound") continue;
      rows.push({
        id: message.id,
        workerId: item.workerId,
        candidateName: item.candidateName,
        contactEmail: item.contactEmail,
        profilePhotoUrl: item.profilePhotoUrl,
        subject: message.subject?.trim() || "No subject",
        preview: messagePreview(message.body),
        sentAt: message.created_at,
      });
    }
  }

  return rows.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
}

export function countInboundMessages(items: TenantMailInboxItem[]): number {
  return items.reduce(
    (sum, item) =>
      sum +
      item.thread.messages.filter((message) => communicationDirectionFromRow(message) === "inbound")
        .length,
    0
  );
}

export function countOutboundMessages(items: TenantMailInboxItem[]): number {
  return items.reduce(
    (sum, item) =>
      sum +
      item.thread.messages.filter((message) => communicationDirectionFromRow(message) === "outbound")
        .length,
    0
  );
}
