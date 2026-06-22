"use client";

import { Download, FileText, Loader2 } from "lucide-react";
import type { SupportTicketAttachmentRow } from "@/lib/support-tickets/types";

function attachmentUrl(attachmentId: string): string {
  return `/api/support-tickets/attachment?attachmentId=${encodeURIComponent(attachmentId)}`;
}

function isImageAttachment(attachment: SupportTicketAttachmentRow): boolean {
  return (attachment.file_type ?? "").toLowerCase().startsWith("image/");
}

function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SupportTicketAttachmentsList({
  attachments,
  loading = false,
  emptyLabel = "No files attached to this ticket.",
}: {
  attachments: SupportTicketAttachmentRow[];
  loading?: boolean;
  emptyLabel?: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-[#64748B]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading attachments...
      </div>
    );
  }

  if (attachments.length === 0) {
    return <p className="text-sm text-[#64748B]">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-2">
      {attachments.map((attachment) => (
        <li key={attachment.id}>
          <a
            href={attachmentUrl(attachment.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0F172A] transition hover:border-(--brand-primary) hover:bg-white"
          >
            {isImageAttachment(attachment) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={attachmentUrl(attachment.id)}
                alt=""
                className="h-10 w-10 shrink-0 rounded object-cover"
              />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[#ECF1F9] text-[#0F2F62]">
                <FileText className="h-5 w-5" aria-hidden />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{attachment.file_name}</span>
              {attachment.file_size ? (
                <span className="text-xs text-[#64748B]">{formatFileSize(attachment.file_size)}</span>
              ) : null}
            </span>
            <Download className="h-4 w-4 shrink-0 text-[#64748B]" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function flattenTicketAttachments(
  messages: { attachments?: SupportTicketAttachmentRow[] }[]
): SupportTicketAttachmentRow[] {
  const seen = new Set<string>();
  const flat: SupportTicketAttachmentRow[] = [];
  for (const message of messages) {
    for (const attachment of message.attachments ?? []) {
      if (seen.has(attachment.id)) continue;
      seen.add(attachment.id);
      flat.push(attachment);
    }
  }
  return flat;
}
