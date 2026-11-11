"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronRight, Circle, Paperclip } from "lucide-react";
import { CreateSupportTicketModal } from "@/app/application/components/applicant-portal/CreateSupportTicketModal";
import { WorkerTicketDetailModal } from "@/app/application/components/applicant-portal/WorkerTicketDetailModal";
import { WorkerTicketsSubNav } from "@/app/application/components/applicant-portal/WorkerTicketsSubNav";
import { useApplicantPortalAuthHeaders } from "@/app/application/components/applicant-portal/useApplicantPortalSession";
import { safeFetchJson } from "@/lib/api/safe-fetch-json";
import { descriptionPreview } from "@/lib/support-tickets/support-ticket-display";
import type { SupportTicketConversationItem, SupportTicketStatus } from "@/lib/support-tickets/types";
import {
  WORKER_PORTAL_PAGE_PAD_CLASS,
  WORKER_SCHEDULE_SUBTITLE_CLASS,
  WORKER_SCHEDULE_SUBTITLE_STYLE,
  WORKER_SCHEDULE_TITLE_CLASS,
  WORKER_SCHEDULE_TITLE_STYLE,
} from "@/app/application/components/applicant-portal/worker-schedule-typography";

type SidebarFilter = "open" | "closed" | "archived";

const PAGE_SIZE = 10;

function formatLastUpdated(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCategory(value: string | null | undefined): string {
  const text = (value ?? "general").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function shortTicketId(id: string): string {
  return `#${id.slice(0, 2).toUpperCase()}-${id.slice(2, 7).toUpperCase()}`;
}

function statusTone(status: SupportTicketStatus | string): string {
  const normalized = status.toLowerCase();
  if (normalized === "closed") return "text-[#64748B]";
  if (normalized === "resolved") return "text-[#6366F1]";
  if (normalized === "in progress") return "text-[#2563EB]";
  return "text-[#16A34A]";
}

function matchesSidebarFilter(ticket: SupportTicketConversationItem, filter: SidebarFilter): boolean {
  const status = ticket.status.toLowerCase();
  if (filter === "open") return !["closed", "resolved"].includes(status);
  if (filter === "closed") return status === "closed";
  return status === "resolved";
}

function SidebarFilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 w-full items-center justify-between rounded-lg border px-3 py-3 text-left transition ${
        active
          ? "border-[#E5E7EB] bg-[#F4F4F4] text-[color:var(--brand-primary)]"
          : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#FAFBFC]"
      }`}
    >
      <span className="text-xs font-semibold">{label}</span>
      <ChevronRight className="h-3.5 w-3.5 text-[#94A3B8]" aria-hidden />
    </button>
  );
}

export function ApplicantTicketsClient() {
  return (
    <Suspense fallback={null}>
      <ApplicantTicketsClientContent />
    </Suspense>
  );
}

function ApplicantTicketsClientContent() {
  const authHeaders = useApplicantPortalAuthHeaders();
  const searchParams = useSearchParams();
  const ticketFromUrl = searchParams.get("ticket")?.trim() ?? "";
  const [tickets, setTickets] = useState<SupportTicketConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>("open");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketConversationItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [defaultCategory, setDefaultCategory] = useState("general");
  const [page, setPage] = useState(1);

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
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load tickets.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadTickets]);

  useEffect(() => {
    if (!ticketFromUrl || tickets.length === 0) return;
    const match = tickets.find((ticket) => ticket.id === ticketFromUrl);
    if (!match) return;
    setSelectedTicket(match);
    setDetailOpen(true);
    const status = match.status.toLowerCase();
    if (status === "closed") setSidebarFilter("closed");
    else if (status === "resolved") setSidebarFilter("archived");
    else setSidebarFilter("open");
  }, [searchParams, ticketFromUrl, tickets]);

  const filteredTickets = useMemo(
    () => tickets.filter((ticket) => matchesSidebarFilter(ticket, sidebarFilter)),
    [sidebarFilter, tickets]
  );

  useEffect(() => {
    setPage(1);
  }, [sidebarFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedTickets = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredTickets.slice(start, start + PAGE_SIZE);
  }, [filteredTickets, safePage]);

  function openTicketDetail(ticket: SupportTicketConversationItem) {
    setSelectedTicket(ticket);
    setDetailOpen(true);
  }

  function openCreate(category = "general") {
    setDefaultCategory(category);
    setCreateOpen(true);
  }

  const openTicketAction = (
    <button
      type="button"
      onClick={() => openCreate("general")}
      className="min-h-11 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white"
      style={{
        background: "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
      }}
    >
      Open a Ticket
    </button>
  );

  return (
    <div className={WORKER_PORTAL_PAGE_PAD_CLASS}>
      <div className="mb-1">
        <h1 className={WORKER_SCHEDULE_TITLE_CLASS} style={WORKER_SCHEDULE_TITLE_STYLE}>
          Support Tickets
        </h1>
        <p className={WORKER_SCHEDULE_SUBTITLE_CLASS} style={WORKER_SCHEDULE_SUBTITLE_STYLE}>
          Manage your help tickets
        </p>
      </div>

      <WorkerTicketsSubNav action={openTicketAction} />

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center text-sm text-[#64748B]">
            Loading support tickets...
          </div>
        ) : (
          <div className="grid min-h-[520px] lg:grid-cols-[290px_minmax(0,1fr)]">
            <aside className="border-b border-[#E5E7EB] p-5 lg:border-b-0 lg:border-r">
              <div className="space-y-3">
                <SidebarFilterButton
                  label="Open Ticket"
                  active={sidebarFilter === "open"}
                  onClick={() => setSidebarFilter("open")}
                />
                <SidebarFilterButton
                  label="Closed"
                  active={sidebarFilter === "closed"}
                  onClick={() => setSidebarFilter("closed")}
                />
                <SidebarFilterButton
                  label="Archived"
                  active={sidebarFilter === "archived"}
                  onClick={() => setSidebarFilter("archived")}
                />
              </div>
            </aside>

            <section className="min-w-0">
              {filteredTickets.length === 0 ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center px-6 py-12 text-center">
                  <p className="text-base font-medium text-[#0F172A]">No tickets in this view</p>
                  <p className="mt-2 max-w-md text-sm text-[#64748B]">
                    Open a ticket from Help & Support or use the button above to contact the team.
                  </p>
                  {sidebarFilter === "open" ? (
                    <button
                      type="button"
                      onClick={() => openCreate("general")}
                      className="mt-4 min-h-11 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
                      }}
                    >
                      Open a Ticket
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left">
                      <thead>
                        <tr className="border-b border-[#E5E7EB] bg-[#FAFBFC] text-xs font-medium text-[#64748B]">
                          <th className="px-3 py-3 font-medium">Department</th>
                          <th className="px-3 py-3 font-medium">Subject</th>
                          <th className="px-3 py-3 font-medium">Status</th>
                          <th className="px-3 py-3 font-medium">Last Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTickets.map((ticket) => (
                          <tr
                            key={ticket.id}
                            className="cursor-pointer border-b border-[#F1F5F9] transition hover:bg-[#FAFBFC]"
                            onClick={() => openTicketDetail(ticket)}
                          >
                            <td className="px-3 py-4 text-sm text-[#0F172A]">
                              {formatCategory(ticket.category)}
                            </td>
                            <td className="px-3 py-4">
                              <div className="flex items-start gap-2">
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium text-[#0F172A]">
                                    {shortTicketId(ticket.id)} {ticket.subject ?? "Support request"}
                                  </span>
                                  <span className="mt-0.5 block truncate text-xs text-[#64748B]">
                                    {descriptionPreview(ticket.description ?? ticket.lastMessagePreview, 60)}
                                  </span>
                                </span>
                                {ticket.lastMessagePreview ? (
                                  <Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#94A3B8]" aria-hidden />
                                ) : null}
                              </div>
                            </td>
                            <td className="px-3 py-4">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full bg-[#EEF2FF] px-2.5 py-1 text-sm ${statusTone(ticket.status)}`}
                              >
                                <Circle className="h-2.5 w-2.5 fill-current" aria-hidden />
                                {ticket.status === "Resolved" ? "Completed" : ticket.status}
                              </span>
                            </td>
                            <td className="px-3 py-4 text-sm text-[#334155]">
                              {formatLastUpdated(ticket.updated_at ?? ticket.lastMessageAt ?? ticket.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] px-4 py-3 text-sm text-[#64748B]">
                    <p>
                      Showing {(safePage - 1) * PAGE_SIZE + 1}–
                      {Math.min(safePage * PAGE_SIZE, filteredTickets.length)} of {filteredTickets.length}{" "}
                      results
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={safePage <= 1}
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        className="min-h-11 rounded-lg border border-[#E2E8F0] px-3 py-1.5 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span>
                        Page {safePage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={safePage >= totalPages}
                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        className="min-h-11 rounded-lg border border-[#E2E8F0] px-3 py-1.5 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>

      <WorkerTicketDetailModal
        ticket={selectedTicket}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedTicket(null);
        }}
        authHeaders={authHeaders}
      />

      <CreateSupportTicketModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultCategory={defaultCategory}
        submitEndpoint="/api/support-tickets"
        authHeaders={authHeaders}
        successActionLabel="View Ticket"
        onSuccess={async (payload) => {
          const ticketId = payload.ticketId ?? null;
          const items = await loadTickets();
          setTickets(items);
          setSidebarFilter("open");
          if (ticketId) {
            const match = items.find((ticket) => ticket.id === ticketId) ?? null;
            setSelectedTicket(match);
          }
        }}
        onSuccessAction={async (ticketId) => {
          try {
            const items = await loadTickets();
            setTickets(items);
            const match = items.find((ticket) => ticket.id === ticketId) ?? null;
            if (match) {
              setSelectedTicket(match);
              setDetailOpen(true);
            }
          } catch {
            if (selectedTicket?.id === ticketId) setDetailOpen(true);
          }
        }}
      />
    </div>
  );
}
