"use client";

import { FormEvent } from "react";
import type { ApplicantMessage } from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  messages: ApplicantMessage[];
  messageBody: string;
  sending: boolean;
  onMessageBodyChange: (value: string) => void;
  onSendMessage: () => Promise<void>;
};

export function ApplicantMessagesPanel({
  open,
  onClose,
  messages,
  messageBody,
  sending,
  onMessageBodyChange,
  onSendMessage,
}: Props) {
  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSendMessage();
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close messages"
        className="fixed inset-0 z-50 bg-black/30"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[#E2E8F0] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div>
            <h2 className="text-[18px] font-semibold text-[#012352]">Messages</h2>
            <p className="text-[13px] text-[#64748B]">Chat with your recruiter</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-[14px] text-[#64748B] hover:bg-[#F8FAFC]"
          >
            Close
          </button>
        </div>

        <div className="flex max-h-[calc(100vh-220px)] flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <p className="rounded-lg bg-[#F8FAFC] px-4 py-3 text-[14px] text-[#64748B]">
              No messages yet. Send your first question to the recruiter.
            </p>
          ) : null}
          {messages.map((message) => {
            const isApplicant = message.sender_role === "applicant";
            return (
              <div
                key={message.id}
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-[14px] leading-5 ${
                  isApplicant ? "ml-auto bg-[#BC8B41] text-white" : "mr-auto bg-[#F1F5F9] text-[#374151]"
                }`}
              >
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] opacity-75">
                  {isApplicant ? "You" : "Recruiter"}
                </p>
                <p>{message.body}</p>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-[#E2E8F0] p-4">
          <textarea
            value={messageBody}
            onChange={(event) => onMessageBodyChange(event.target.value)}
            placeholder="Ask about your application status or required documents."
            rows={3}
            className="w-full resize-none rounded-lg border border-[#E5E7EB] px-4 py-3 text-[14px] text-[#012352] outline-none placeholder:text-[#94A3B8] focus:border-[#BC8B41]"
          />
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={sending || !messageBody.trim()}
              className="inline-flex h-10 min-w-[120px] items-center justify-center rounded-lg bg-[#BC8B41] px-4 text-[14px] font-semibold text-white transition hover:bg-[#a67a38] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
