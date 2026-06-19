"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Circle, ExternalLink } from "lucide-react";
import DashboardPageLoader from "@/app/admin_recruiter/components/DashboardPageLoader";
import {
  CANDIDATES_PAGE_SUBTITLE_CLASS,
  CANDIDATES_PAGE_SUBTITLE_STYLE,
  CANDIDATES_PAGE_TITLE_CLASS,
  CANDIDATES_PAGE_TITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";
import { TicketsSubNav } from "@/app/admin_recruiter/tickets/TicketsSubNav";
import { SupportTicketDetailModal } from "@/app/admin_recruiter/tickets/support/SupportTicketDetailModal";
import { descriptionPreview } from "@/lib/support-tickets/support-ticket-service";
import type { SupportTicketListItem } from "@/lib/support-tickets/types";

type SidebarFilter = "open" | "closed" | "archived";

const PAGE_SIZE = 10;

function formatLastUpdated(value: string | null | undefined): string {
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

function formatCategory(value: string | null | undefined): string {
  const text = (value ?? "general").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function statusTone(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "closed" || normalized === "resolved") return "text-[#64748B]";
  if (normalized === "in progress") return "text-[#2563EB]";
  return "text-[#16A34A]";
}

function matchesSidebarFilter(ticket: SupportTicketListItem, filter: SidebarFilter): boolean {
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
      className={`flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left transition ${
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

export default function SupportTicketsClient() {
  const [tickets, setTickets] = useState<SupportTicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>("open");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketListItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [page, setPage] = useState(1);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/support-tickets", { cache: "no-store" });
      const payload = (await res.json().catch(() => ({}))) as {
        tickets?: SupportTicketListItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not load support tickets.");
      setTickets(payload.tickets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load support tickets.");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

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

  function openTicketDetail(ticket: SupportTicketListItem) {
    setSelectedTicket(ticket);
    setDetailOpen(true);
  }

  async function handleCloseTicket() {
    if (!selectedTicket || selectedTicket.status === "Closed") return;
    setClosing(true);
    setError(null);
    try {
      const res = await fetch(`/api/support-tickets/${encodeURIComponent(selectedTicket.id)}/close`, {
        method: "PATCH",
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ticket?: SupportTicketListItem;
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not close ticket.");
      const updated = payload.ticket;
      if (updated) {
        setTickets((current) => current.map((ticket) => (ticket.id === updated.id ? updated : ticket)));
        setSelectedTicket(updated);
      } else {
        await loadTickets();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not close ticket.");
    } finally {
      setClosing(false);
    }
  }

  const openTicketAction = (
    <button
      type="button"
      onClick={() => setSidebarFilter("open")}
      className="rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white"
      style={{
        background: "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
      }}
    >
      Open a Ticket
    </button>
  );

  return (
    <div className="pb-8">
      <div className="px-8 pt-6">
        <h1 className={CANDIDATES_PAGE_TITLE_CLASS} style={CANDIDATES_PAGE_TITLE_STYLE}>
          Support Tickets
        </h1>
        <p className={CANDIDATES_PAGE_SUBTITLE_CLASS} style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
          Manage your help tickets
        </p>
      </div>

      <TicketsSubNav action={openTicketAction} />

      <div className="px-8">
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
          {loading ? (
            <DashboardPageLoader label="Loading support tickets..." className="min-h-[480px]" />
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
                      Applicant tickets from Messages or Help & Support appear here once submitted.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left">
                        <thead>
                          <tr className="border-b border-[#E5E7EB] bg-[#FAFBFC] text-xs font-medium uppercase tracking-wide text-[#64748B]">
                            <th className="px-3 py-3 font-medium normal-case">Department</th>
                            <th className="px-3 py-3 font-medium normal-case">Subject</th>
                            <th className="px-3 py-3 font-medium normal-case">Applicant</th>
                            <th className="px-3 py-3 font-medium normal-case">Status</th>
                            <th className="px-3 py-3 font-medium normal-case">Last Updated</th>
                            <th className="px-3 py-3" aria-hidden />
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedTickets.map((ticket) => (
                            <tr
                              key={ticket.id}
                              className="border-b border-[#F1F5F9] transition hover:bg-[#FAFBFC]"
                            >
                              <td className="px-3 py-4 text-sm text-[#0F172A]">{formatCategory(ticket.category)}</td>
                              <td className="px-3 py-4">
                                <button
                                  type="button"
                                  onClick={() => openTicketDetail(ticket)}
                                  className="group flex w-full items-start justify-between gap-3 text-left"
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium text-[#0F172A]">
                                      {ticket.subject ?? "Support request"}
                                    </span>
                                    <span className="mt-0.5 block truncate text-xs text-[#64748B]">
                                      {descriptionPreview(ticket.description, 60)}
                                    </span>
                                  </span>
                                  <ExternalLink
                                    className="mt-0.5 h-4 w-4 shrink-0 text-[#94A3B8] opacity-0 transition group-hover:opacity-100"
                                    aria-hidden
                                  />
                                </button>
                              </td>
                              <td className="px-3 py-4">
                                <p className="truncate text-sm text-[#0F172A]">{ticket.applicant_name ?? "Applicant"}</p>
                                <p className="truncate text-xs text-[#64748B]">{ticket.applicant_email ?? "—"}</p>
                              </td>
                              <td className="px-3 py-4">
                                <span className={`inline-flex items-center gap-1.5 text-sm ${statusTone(ticket.status)}`}>
                                  <Circle className="h-2.5 w-2.5 fill-current" aria-hidden />
                                  {ticket.status}
                                </span>
                              </td>
                              <td className="px-3 py-4 text-sm text-[#334155]">
                                {formatLastUpdated(ticket.updated_at ?? ticket.created_at)}
                              </td>
                              <td className="px-3 py-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => openTicketDetail(ticket)}
                                  className="text-sm font-medium text-[#012352] hover:text-[color:var(--brand-primary)]"
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] px-4 py-3 text-sm text-[#64748B]">
                      <p>
                        Showing {(safePage - 1) * PAGE_SIZE + 1}–
                        {Math.min(safePage * PAGE_SIZE, filteredTickets.length)} of {filteredTickets.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={safePage <= 1}
                          onClick={() => setPage((current) => Math.max(1, current - 1))}
                          className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 disabled:opacity-50"
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
                          className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 disabled:opacity-50"
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
      </div>

      <SupportTicketDetailModal
        ticket={selectedTicket}
        open={detailOpen}
        closing={closing}
        onClose={() => {
          setDetailOpen(false);
          setSelectedTicket(null);
        }}
        onCloseTicket={() => void handleCloseTicket()}
      />
    </div>
  );
}
