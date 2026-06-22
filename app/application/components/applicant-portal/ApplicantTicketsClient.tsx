"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search, Ticket } from "lucide-react";
import DashboardPageLoader from "@/app/admin_recruiter/components/DashboardPageLoader";
import SupportConversationClient from "@/app/admin_recruiter/messages/SupportConversationClient";
import { CreateSupportTicketModal } from "@/app/application/components/applicant-portal/CreateSupportTicketModal";
import { useApplicantPortalAuthHeaders } from "@/app/application/components/applicant-portal/useApplicantPortalSession";
import { formatChatTime } from "@/app/admin_recruiter/messages/chat-ui";
import { safeFetchJson } from "@/lib/api/safe-fetch-json";
import type { SupportTicketConversationItem, SupportTicketStatus } from "@/lib/support-tickets/types";
import {
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_SECTION_TITLE_CLASS,
  WORKER_SECTION_TITLE_STYLE,
} from "@/app/application/components/applicant-portal/worker-schedule-typography";

const STATUS_COLORS: Record<SupportTicketStatus, string> = {
  Open: "bg-[#DBEAFE] text-[#1D4ED8]",
  Pending: "bg-[#FEF3C7] text-[#B45309]",
  "In Progress": "bg-[#E0E7FF] text-[#4338CA]",
  Resolved: "bg-[#D1FAE5] text-[#047857]",
  Closed: "bg-[#F1F5F9] text-[#64748B]",
};

export function ApplicantTicketsClient() {
  return (
    <Suspense fallback={<DashboardPageLoader label="Loading support tickets..." />}>
      <ApplicantTicketsClientContent />
    </Suspense>
  );
}

function ApplicantTicketsClientContent() {
  const authHeaders = useApplicantPortalAuthHeaders();
  const searchParams = useSearchParams();
  const ticketFromUrl = searchParams.get("ticket")?.trim() ?? "";
  const [tickets, setTickets] = useState<SupportTicketConversationItem[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const loadTickets = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) throw new Error("You need to sign in again.");

    const result = await safeFetchJson<{ tickets?: SupportTicketConversationItem[] }>(
      "/api/support-tickets",
      { headers, cache: "no-store" }
    );
    if (!result.ok) throw new Error(result.error);
    return result.data.tickets ?? [];
  }, [authHeaders]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const items = await loadTickets();
        if (!alive) return;
        setTickets(items);
        const preferredId =
          ticketFromUrl && items.some((ticket) => ticket.id === ticketFromUrl)
            ? ticketFromUrl
            : items[0]?.id ?? null;
        setSelectedTicketId((current) => {
          if (ticketFromUrl && items.some((ticket) => ticket.id === ticketFromUrl)) {
            return ticketFromUrl;
          }
          return current ?? preferredId;
        });
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load tickets.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadTickets, ticketFromUrl]);

  const filteredTickets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return tickets;
    return tickets.filter(
      (ticket) =>
        (ticket.subject ?? "").toLowerCase().includes(query) ||
        ticket.lastMessagePreview.toLowerCase().includes(query) ||
        (ticket.category ?? "").toLowerCase().includes(query)
    );
  }, [searchQuery, tickets]);

  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;

  if (loading) {
    return <DashboardPageLoader label="Loading support tickets..." />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={WORKER_SECTION_TITLE_CLASS} style={WORKER_SECTION_TITLE_STYLE}>
            Support Tickets
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Create a ticket or follow up on an existing support conversation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          style={{
            background:
              "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
          }}
        >
          <Plus className="h-4 w-4" />
          New ticket
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <div className={`grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)] ${WORKER_SCHEDULE_CARD_CLASS}`}>
        <aside className="flex min-h-[360px] flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
          <div className="border-b border-[#E8EDF2] p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search tickets..."
                className="h-10 w-full rounded-lg border border-[#D8E0EA] bg-[#F8FAFC] py-2 pl-9 pr-3 text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-(--brand-primary)"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {filteredTickets.length === 0 ? (
              <p className="px-2 py-6 text-sm text-[#64748B]">
                {searchQuery.trim() ? "No tickets match your search." : "No support tickets yet."}
              </p>
            ) : (
              filteredTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={`mb-2 w-full rounded-lg border p-3 text-left transition ${
                    ticket.id === selectedTicketId
                      ? "border-(--brand-primary) bg-[#F8FAFC]"
                      : "border-[#E2E8F0] bg-white hover:border-(--brand-primary)"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-[#0F172A]">
                      {ticket.subject ?? "Support request"}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[ticket.status]}`}
                    >
                      {ticket.status}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-[#64748B]">{ticket.lastMessagePreview}</p>
                  <p className="mt-1 text-[10px] text-[#94A3B8]">{formatChatTime(ticket.lastMessageAt)}</p>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="flex min-h-[480px] flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
          {selectedTicket ? (
            <>
              <div className="border-b border-[#E8EDF2] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECF1F9] text-[#0F2F62]">
                    <Ticket className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-[#0F172A]">
                      {selectedTicket.subject ?? "Support request"}
                    </h2>
                    <p className="text-xs text-[#64748B]">
                      {selectedTicket.category ?? "general"} · {selectedTicket.priority} priority
                    </p>
                  </div>
                </div>
              </div>
              <SupportConversationClient
                ticketId={selectedTicket.id}
                viewerRole="applicant"
                counterpartyLabel="Support team"
                authHeaders={authHeaders}
                compact
                ticketStatus={selectedTicket.status}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-[#64748B]">
              Select a ticket to view the conversation.
            </div>
          )}
        </section>
      </div>

      <CreateSupportTicketModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        submitEndpoint="/api/support-tickets"
        authHeaders={authHeaders}
        onSuccess={async (payload) => {
          const items = await loadTickets();
          setTickets(items);
          setSelectedTicketId(payload.ticketId ?? items[0]?.id ?? null);
        }}
      />
    </div>
  );
}
