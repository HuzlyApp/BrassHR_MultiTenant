"use client";

import { Loader2, X } from "lucide-react";
import type { SupportTicketListItem } from "@/lib/support-tickets/types";
import { descriptionPreview } from "@/lib/support-tickets/support-ticket-service";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortTicketId(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

type Props = {
  ticket: SupportTicketListItem | null;
  open: boolean;
  closing: boolean;
  onClose: () => void;
  onCloseTicket: () => void;
};

export function SupportTicketDetailModal({ ticket, open, closing, onClose, onCloseTicket }: Props) {
  if (!open || !ticket) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-detail-title"
        className="flex max-h-[90vh] w-full max-w-[600px] flex-col overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white shadow-xl"
      >
        <div className="flex items-center justify-end border-b border-[#E5E7EB] px-3.5 py-3">
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black text-white"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F4F4F4] text-[#012352]">
              <span className="text-xs font-bold">{shortTicketId(ticket.id)}</span>
            </div>
            <div>
              <h2 id="ticket-detail-title" className="text-2xl font-semibold text-[#0F172A]">
                {ticket.subject ?? "Support request"}
              </h2>
              <p className="text-sm text-[#64748B]">
                {ticket.applicant_name ?? "Applicant"}
                {ticket.applicant_email ? ` · ${ticket.applicant_email}` : ""}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-[#E5E7EB] p-5">
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Status</p>
                <p className="mt-1 text-sm font-medium text-[#0F172A]">{ticket.status}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Department</p>
                <p className="mt-1 text-sm font-medium capitalize text-[#0F172A]">{ticket.category ?? "general"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Priority</p>
                <p className="mt-1 text-sm font-medium capitalize text-[#0F172A]">{ticket.priority}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Created</p>
                <p className="mt-1 text-sm text-[#0F172A]">{formatDateTime(ticket.created_at)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Last updated</p>
                <p className="mt-1 text-sm text-[#0F172A]">{formatDateTime(ticket.updated_at)}</p>
              </div>
              {ticket.closed_at ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Closed</p>
                  <p className="mt-1 text-sm text-[#0F172A]">{formatDateTime(ticket.closed_at)}</p>
                </div>
              ) : null}
            </div>

            <h3 className="text-sm font-semibold text-[#0F172A]">Request details</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#334155]">
              {ticket.description ?? "—"}
            </p>
            <p className="mt-4 text-xs text-[#64748B]">Preview: {descriptionPreview(ticket.description, 160)}</p>
          </div>

          <div className="mt-5 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[#E2E8F0] px-3.5 py-2.5 text-sm font-semibold text-[#012352] hover:bg-[#F8FAFC]"
            >
              Cancel
            </button>
            {ticket.status !== "Closed" ? (
              <button
                type="button"
                onClick={onCloseTicket}
                disabled={closing}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{
                  background:
                    "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
                }}
              >
                {closing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Close Ticket
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
