"use client";

import type { ReactNode } from "react";
import { Loader2, Send } from "lucide-react";
import { communicationDirectionFromRow } from "@/lib/communication/direction";

type CommunicationRow = {
  id: string;
  channel: "email" | "sms";
  subject: string | null;
  body: string;
  status: "sent" | "failed" | "received";
  from_email?: string | null;
  error_message: string | null;
  created_at: string;
};

type ContactInfo = {
  name: string;
  email: string | null;
  phone: string | null;
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function senderDisplay(
  row: CommunicationRow,
  contact: ContactInfo | null,
  inbound: boolean
): string {
  if (row.channel === "email") {
    if (inbound) return row.from_email?.trim() || contact?.email || contact?.name || "Applicant";
    return row.from_email?.trim() || "notifications@brasshr.com";
  }
  return inbound ? contact?.name ?? contact?.phone ?? "Applicant" : "You";
}

export function CommunicationMessageBubble({
  row,
  contact,
}: {
  row: CommunicationRow;
  contact: ContactInfo | null;
}) {
  const inbound = communicationDirectionFromRow(row) === "inbound";

  return (
    <div className={`flex ${inbound ? "justify-start" : "justify-end"}`}>
      <div className={`flex w-fit max-w-[85%] flex-col ${inbound ? "items-start" : "items-end"}`}>
        <div
          className={`inline-block w-fit max-w-full rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
            inbound
              ? "rounded-bl-md border border-[#E5E7EB] bg-white text-[#1F2937]"
              : "rounded-br-md bg-(--brand-primary) text-white"
          }`}
        >
          {row.channel === "email" && row.subject ? (
            <p className={`mb-1.5 text-xs font-semibold ${inbound ? "text-[#111827]" : "text-white"}`}>
              {row.subject}
            </p>
          ) : null}
          <p className="whitespace-pre-wrap leading-relaxed">{row.body}</p>
        </div>
        <div
          className={`mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-[11px] ${
            inbound ? "text-[#94A3B8]" : "justify-end text-[#94A3B8]"
          }`}
        >
          <span className="font-medium text-[#64748B]">{senderDisplay(row, contact, inbound)}</span>
          <span>·</span>
          <span>{formatWhen(row.created_at)}</span>
          {row.status === "failed" ? (
            <>
              <span>·</span>
              <span className="text-red-500">Failed</span>
            </>
          ) : row.status === "sent" ? (
            <>
              <span>·</span>
              <span className="text-emerald-600">Sent</span>
            </>
          ) : null}
        </div>
        {row.error_message ? (
          <p className="mt-1 px-1 text-[11px] leading-snug text-red-600">{row.error_message}</p>
        ) : null}
      </div>
    </div>
  );
}

export function EmailComposeForm({
  toName,
  toEmail,
  subject,
  body,
  sending,
  sendError,
  sendSuccess,
  onSubjectChange,
  onBodyChange,
  onSend,
  leadingRow,
  templateRow,
  hideToRow = false,
  emptyHint,
}: {
  toName: string;
  toEmail: string | null;
  subject: string;
  body: string;
  sending: boolean;
  sendError: string | null;
  sendSuccess: string | null;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSend: () => void;
  leadingRow?: ReactNode;
  templateRow?: ReactNode;
  hideToRow?: boolean;
  emptyHint?: string;
}) {
  const canSend = Boolean(toEmail?.trim()) && subject.trim().length > 0 && body.trim().length > 0 && !sending;
  const fieldLabelWidth = leadingRow || templateRow ? "w-20" : "w-12";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-sm">
          {leadingRow || templateRow ? (
            <div className="relative z-20 grid gap-3 border-b border-[#E5E7EB] bg-[#FAFBFC] px-4 py-3 md:grid-cols-2">
              {leadingRow ? <div className="min-w-0">{leadingRow}</div> : null}
              {templateRow ? <div className="min-w-0">{templateRow}</div> : null}
            </div>
          ) : null}

          {!toEmail ? (
            <p className="px-4 py-8 text-center text-sm text-[#6B7280]">
              {emptyHint ?? "This candidate does not have an email address on file."}
            </p>
          ) : (
            <>
              {!hideToRow ? (
                <div className="flex items-center gap-3 border-b border-[#E5E7EB] bg-[#FAFBFC] px-4 py-2.5">
                  <span className={`${fieldLabelWidth} shrink-0 text-xs font-medium text-[#64748B]`}>To</span>
                  <p className="min-w-0 truncate text-sm text-[#111827]">
                    <span className="font-medium">{toName}</span>
                    <span className="text-[#64748B]"> · {toEmail}</span>
                  </p>
                </div>
              ) : null}

              <div className="flex items-center gap-3 border-b border-[#E5E7EB] px-4 py-2">
                <span className={`${fieldLabelWidth} shrink-0 text-xs font-medium text-[#64748B]`}>
                  Subject
                </span>
                <input
                  type="text"
                  value={subject}
                  onChange={(event) => onSubjectChange(event.target.value)}
                  disabled={sending}
                  placeholder="Email subject"
                  className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm text-[#111827] outline-none placeholder:text-[#94A3B8] focus:ring-0"
                />
              </div>

              <textarea
                value={body}
                onChange={(event) => onBodyChange(event.target.value)}
                disabled={sending}
                rows={14}
                placeholder="Write your message..."
                className="min-h-[300px] w-full resize-y border-0 bg-white px-4 py-3 text-sm leading-relaxed text-[#111827] outline-none placeholder:text-[#94A3B8] focus:ring-0"
              />
            </>
          )}
        </div>
      </div>

      <div className="border-t border-[#E5E7EB] bg-white px-5 py-3">
        <div className="flex flex-wrap items-center justify-end gap-3">
          {sendError ? (
            <p className="mr-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {sendError}
            </p>
          ) : null}
          {sendSuccess ? (
            <p className="mr-auto rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {sendSuccess}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-(--brand-primary) px-5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CommunicationThreadComposer({
  channel,
  replyBody,
  replySubject,
  sendingReply,
  sendError,
  sendSuccess,
  onBodyChange,
  onSubjectChange,
  onSend,
}: {
  channel: "sms" | "email";
  replyBody: string;
  replySubject: string;
  sendingReply: boolean;
  sendError: string | null;
  sendSuccess: string | null;
  onBodyChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onSend: () => void;
}) {
  const isEmail = channel === "email";

  if (isEmail) {
    return (
      <div className="border-t border-[#E5E7EB] bg-[#FAFBFC] px-5 py-3">
        <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
          <div className="flex items-center gap-3 border-b border-[#E5E7EB] px-3 py-2">
            <span className="w-12 shrink-0 text-xs font-medium text-[#64748B]">Subject</span>
            <input
              type="text"
              value={replySubject}
              onChange={(event) => onSubjectChange(event.target.value)}
              disabled={sendingReply}
              placeholder="Email subject"
              className="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm text-[#111827] outline-none placeholder:text-[#94A3B8] focus:ring-0"
            />
          </div>
          <textarea
            value={replyBody}
            onChange={(event) => onBodyChange(event.target.value)}
            disabled={sendingReply}
            rows={4}
            placeholder="Write an email reply..."
            className="min-h-[100px] w-full resize-y border-0 bg-white px-3 py-2.5 text-sm leading-relaxed text-[#111827] outline-none placeholder:text-[#94A3B8] focus:ring-0"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
          {sendError ? (
            <p className="mr-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {sendError}
            </p>
          ) : null}
          {sendSuccess ? (
            <p className="mr-auto rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {sendSuccess}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onSend}
            disabled={sendingReply || !replyBody.trim() || !replySubject.trim()}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-(--brand-primary) px-5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sendingReply ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Reply message</span>
          <textarea
            value={replyBody}
            onChange={(event) => onBodyChange(event.target.value)}
            disabled={sendingReply}
            rows={2}
            placeholder="Write an SMS reply..."
            className="max-h-32 w-full resize-none rounded-xl border border-[#CBD5E1] bg-[#FAFBFC] px-3 py-2.5 text-sm focus:border-(--brand-primary) focus:bg-white focus:outline-none focus:ring-1 focus:ring-(--brand-primary)"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSend();
              }
            }}
          />
        </label>
        <button
          type="button"
          onClick={onSend}
          disabled={sendingReply || !replyBody.trim()}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-(--brand-primary) px-4 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send
        </button>
      </div>
      {sendError ? (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {sendError}
        </p>
      ) : null}
      {sendSuccess ? (
        <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {sendSuccess}
        </p>
      ) : null}
    </div>
  );
}
