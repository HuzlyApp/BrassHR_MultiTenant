"use client";

import { useEffect } from "react";
import { Circle, Ticket, X } from "lucide-react";
import SupportConversationClient from "@/app/admin_recruiter/messages/SupportConversationClient";
import type { SupportTicketConversationItem } from "@/lib/support-tickets/types";

type Props = {
  ticket: SupportTicketConversationItem | null;
  open: boolean;
  onClose: () => void;
  authHeaders: () => Promise<Record<string, string> | null>;
};

function statusTone(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "closed" || normalized === "resolved") return "text-[#64748B]";
  if (normalized === "in progress") return "text-[#2563EB]";
  return "text-[#16A34A]";
}

export function WorkerTicketDetailModal({ ticket, open, onClose, authHeaders }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !ticket) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="worker-ticket-detail-title"
        className="flex max-h-[90vh] w-full max-w-[600px] flex-col overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-3">
          <h2 id="worker-ticket-detail-title" className="text-lg font-semibold text-[#0F172A]">
            My Ticket
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black text-white"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-[#E5E7EB] px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F4F4F4] text-[#012352]">
                <Ticket className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-base font-semibold text-[#0F172A]">
                    {ticket.subject ?? "Support request"}
                  </p>
                  <span
                    className={`inline-flex items-center gap-1.5 text-sm font-medium ${statusTone(ticket.status)}`}
                  >
                    <Circle className="h-2.5 w-2.5 fill-current" aria-hidden />
                    {ticket.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#64748B]">
                  {(ticket.category ?? "general").replace(/^\w/, (c) => c.toUpperCase())}
                  {" · "}
                  {ticket.priority} priority
                </p>
              </div>
            </div>
            {ticket.description ? (
              <p className="mt-4 whitespace-pre-wrap rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] px-4 py-3 text-sm leading-6 text-[#334155]">
                {ticket.description}
              </p>
            ) : null}
          </div>

          <div className="min-h-[320px] flex-1 overflow-hidden">
            <SupportConversationClient
              ticketId={ticket.id}
              viewerRole="applicant"
              counterpartyLabel="Support team"
              authHeaders={authHeaders}
              compact
              ticketStatus={ticket.status}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
