"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Link2 } from "lucide-react";
import DashboardPageLoader from "@/app/admin_recruiter/components/DashboardPageLoader";
import {
  ListPaginationControls,
  ListPaginationShowLabel,
} from "@/app/admin_recruiter/components/ListPaginationControls";
import { TicketsSubNav } from "@/app/admin_recruiter/tickets/TicketsSubNav";
import { OpenTicketDepartmentMenu } from "@/app/components/support/OpenTicketDepartmentMenu";
import { SupportTicketDetailModal } from "@/app/admin_recruiter/tickets/support/SupportTicketDetailModal";
import { StaffCreateSupportTicketModal } from "@/app/admin_recruiter/tickets/support/StaffCreateSupportTicketModal";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  BRAND_FONT_BODY_STYLE,
  BRAND_FONT_HEADING_STYLE,
} from "@/lib/tenant/branding-typography-styles";
import { getSupportDepartmentByCategory } from "@/lib/support-tickets/support-departments";
import { descriptionPreview } from "@/lib/support-tickets/support-ticket-display";
import { formatSupportTicketNumber } from "@/lib/support-tickets/ticket-number";
import type { SupportTicketListItem } from "@/lib/support-tickets/types";

type SidebarFilter = "open" | "closed" | "archived";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function formatCategory(value: string | null | undefined): string {
  const text = (value ?? "general").trim();
  const dept = getSupportDepartmentByCategory(text);
  if (dept) return dept.title;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatLastUpdatedParts(value: string | null | undefined): { date: string; time: string } {
  if (!value) return { date: "—", time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "—", time: "" };
  const dateLabel = date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const weekday = date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
  });
  const time = date.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { date: dateLabel, time: `${weekday} at ${time}` };
}

function statusBadgeClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "closed" || normalized === "resolved") {
    return "bg-[rgba(37,99,235,0.15)] text-[#2563EB]";
  }
  if (normalized === "in progress" || normalized === "pending") {
    return "bg-[rgba(37,99,235,0.12)] text-[#2563EB]";
  }
  return "bg-[rgba(22,163,74,0.12)] text-[#16A34A]";
}

function statusLabel(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "resolved" || normalized === "closed") return "Completed";
  return status;
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
      className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-3 text-left transition ${
        active
          ? "bg-[color:var(--brand-secondary,#012352)] text-white"
          : "bg-transparent text-[#374151] hover:bg-[#F9FAFB]"
      }`}
    >
      <span className="text-xs font-normal leading-4">{label}</span>
      <ChevronRight
        className={`h-3.5 w-3.5 ${active ? "text-white" : "text-[#94A3B8]"}`}
        aria-hidden
      />
    </button>
  );
}

export default function SupportTicketsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const branding = useTenantBranding();
  const secondaryColor = branding.secondaryHex || "#012352";
  const [tickets, setTickets] = useState<SupportTicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>("open");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketListItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [defaultCategory, setDefaultCategory] = useState("general");
  const [closing, setClosing] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/support-tickets", { cache: "no-store", credentials: "include" });
      const payload = (await res.json().catch(() => ({}))) as {
        tickets?: SupportTicketListItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not load support tickets.");
      setTickets(payload.tickets ?? []);
      return payload.tickets ?? [];
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load support tickets.");
      setTickets([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    const ticketId = searchParams.get("ticket")?.trim();
    if (!ticketId || tickets.length === 0) return;
    const match = tickets.find((ticket) => ticket.id === ticketId);
    if (!match) return;
    setSelectedTicket(match);
    setDetailOpen(true);
    const status = match.status.toLowerCase();
    if (status === "closed") setSidebarFilter("closed");
    else if (status === "resolved") setSidebarFilter("archived");
    else setSidebarFilter("open");
  }, [searchParams, tickets]);

  const filteredTickets = useMemo(
    () => tickets.filter((ticket) => matchesSidebarFilter(ticket, sidebarFilter)),
    [sidebarFilter, tickets]
  );

  useEffect(() => {
    setPage(1);
  }, [sidebarFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = filteredTickets.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, filteredTickets.length);
  const paginatedTickets = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredTickets.slice(start, start + pageSize);
  }, [filteredTickets, safePage, pageSize]);

  function openTicketDetail(ticket: SupportTicketListItem) {
    setSelectedTicket(ticket);
    setDetailOpen(true);
  }

  function openTicketChat(ticket: SupportTicketListItem) {
    router.push(
      `/admin_recruiter/messages?tab=support&ticket=${encodeURIComponent(ticket.id)}`
    );
  }

  function handleCreated(ticket: SupportTicketListItem) {
    setTickets((current) => [ticket, ...current.filter((item) => item.id !== ticket.id)]);
    setSidebarFilter("open");
    setSelectedTicket(ticket);
    setDetailOpen(true);
    setCreateOpen(false);
  }

  async function handleCloseTicket() {
    if (!selectedTicket || selectedTicket.status === "Closed") return;
    setClosing(true);
    setError(null);
    try {
      const res = await fetch(`/api/support-tickets/${encodeURIComponent(selectedTicket.id)}/close`, {
        method: "PATCH",
        credentials: "include",
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

  async function handleArchiveTicket() {
    if (!selectedTicket || selectedTicket.status === "Resolved") return;
    setClosing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/support-tickets/${encodeURIComponent(selectedTicket.id)}/archive`,
        { method: "PATCH", credentials: "include" }
      );
      const payload = (await res.json().catch(() => ({}))) as {
        ticket?: SupportTicketListItem;
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not archive ticket.");
      const updated = payload.ticket;
      if (updated) {
        setTickets((current) => current.map((ticket) => (ticket.id === updated.id ? updated : ticket)));
        setSelectedTicket(updated);
        setSidebarFilter("archived");
      } else {
        await loadTickets();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not archive ticket.");
    } finally {
      setClosing(false);
    }
  }

  async function handleReopenTicket() {
    if (!selectedTicket) return;
    setClosing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/support-tickets/${encodeURIComponent(selectedTicket.id)}/reopen`,
        { method: "PATCH", credentials: "include" }
      );
      const payload = (await res.json().catch(() => ({}))) as {
        ticket?: SupportTicketListItem;
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not reopen ticket.");
      const updated = payload.ticket;
      if (updated) {
        setTickets((current) => current.map((ticket) => (ticket.id === updated.id ? updated : ticket)));
        setSelectedTicket(updated);
        setSidebarFilter("open");
      } else {
        await loadTickets();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reopen ticket.");
    } finally {
      setClosing(false);
    }
  }

  function openCreate(category: string) {
    setDefaultCategory(category);
    setCreateOpen(true);
  }

  const openTicketAction = (
    <OpenTicketDepartmentMenu
      onSelectDepartment={openCreate}
      buttonStyle={{ backgroundColor: secondaryColor }}
    />
  );

  return (
    <div className="pb-8">
      <div className="px-8 pt-6">
        <h1
          className="m-0 text-2xl font-semibold leading-8 tracking-normal text-[color:var(--brand-secondary,#012352)]"
          style={BRAND_FONT_HEADING_STYLE}
        >
          Support Tickets
        </h1>
        <p
          className="m-0 mt-0.5 text-xs font-normal leading-4 tracking-normal text-[#6B7280]"
          style={BRAND_FONT_BODY_STYLE}
        >
          Manage your help tickets.
        </p>
      </div>

      <TicketsSubNav action={openTicketAction} />

      <div className="px-8">
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
          {loading ? (
            <DashboardPageLoader label="Loading support tickets..." className="min-h-[480px]" />
          ) : (
            <div className="grid min-h-[520px] gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
              <aside className="rounded-lg border border-[#E5E7EB] p-5">
                <div className="space-y-3.5">
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

              <section className="flex min-w-0 flex-col justify-between">
                {filteredTickets.length === 0 ? (
                  <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-[#E5E7EB] px-6 py-12 text-center">
                    <p className="text-base font-medium text-[color:var(--brand-secondary,#012352)]">
                      No tickets in this view
                    </p>
                    <p className="mt-2 max-w-md text-sm text-[#6B7280]">
                      Create a ticket on behalf of a worker, or wait for applicant submissions from
                      Help & Support.
                    </p>
                    {sidebarFilter === "open" ? (
                      <div className="mt-4">
                        <OpenTicketDepartmentMenu
                          onSelectDepartment={openCreate}
                          buttonClassName="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold text-white transition hover:brightness-95"
                          buttonStyle={{ backgroundColor: secondaryColor }}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left">
                          <thead>
                            <tr className="border-b border-[#E5E7EB] text-[10px] font-normal leading-[15px] text-black">
                              <th className="px-3 py-2 font-normal">Department</th>
                              <th className="px-3 py-2 font-normal">Subject</th>
                              <th className="w-[130px] px-3 py-2 font-normal">Status</th>
                              <th className="px-3 py-2 font-normal">Last Updated</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedTickets.map((ticket) => {
                              const updated = formatLastUpdatedParts(
                                ticket.updated_at ?? ticket.created_at
                              );
                              return (
                                <tr
                                  key={ticket.id}
                                  className="border-b border-[#E5E7EB] transition hover:bg-[#FAFBFC]"
                                >
                                  <td className="px-3 py-3 text-xs leading-4 text-black">
                                    {formatCategory(ticket.category)}
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <button
                                        type="button"
                                        onClick={() => openTicketDetail(ticket)}
                                        className="min-w-0 flex-1 text-left"
                                      >
                                        <span
                                          className="block truncate text-xs leading-4"
                                          style={{ color: secondaryColor }}
                                        >
                                          {formatSupportTicketNumber(ticket.ticket_number, ticket.id)}
                                        </span>
                                        <span className="mt-0.5 block truncate text-[10px] leading-[15px] text-[#6B7280]">
                                          {ticket.subject?.trim() ||
                                            descriptionPreview(ticket.description, 60) ||
                                            "Support request"}
                                        </span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openTicketChat(ticket)}
                                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#94A3B8] transition hover:bg-[#F8FAFC] hover:text-[color:var(--brand-secondary,#012352)]"
                                        aria-label={`Open chat for ${formatSupportTicketNumber(ticket.ticket_number, ticket.id)}`}
                                        title="Open support chat"
                                      >
                                        <Link2 className="h-[18px] w-[18px]" aria-hidden />
                                      </button>
                                    </div>
                                  </td>
                                  <td className="w-[130px] px-3 py-3">
                                    <span
                                      className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] leading-[15px] ${statusBadgeClass(ticket.status)}`}
                                    >
                                      {statusLabel(ticket.status)}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="text-[10px] leading-[15px] text-[#6B7280]">
                                      <p>{updated.date}</p>
                                      {updated.time ? <p>{updated.time}</p> : null}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs text-[#6B7280]">
                      <p className="whitespace-nowrap">
                        Showing{" "}
                        <span className="text-black">
                          {pageStart}-{pageEnd}
                        </span>{" "}
                        of {filteredTickets.length} results
                      </p>
                      <div className="flex flex-wrap items-center gap-3.5">
                        <ListPaginationShowLabel
                          pageSize={pageSize}
                          options={PAGE_SIZE_OPTIONS}
                          onPageSizeChange={(size) => {
                            setPageSize(size);
                            setPage(1);
                          }}
                        />
                        <ListPaginationControls
                          currentPage={safePage}
                          totalPages={totalPages}
                          onPageChange={setPage}
                          activeStyle={{
                            backgroundColor: secondaryColor,
                            borderColor: secondaryColor,
                          }}
                        />
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
        onArchiveTicket={() => void handleArchiveTicket()}
        onReopenTicket={() => void handleReopenTicket()}
      />

      <StaffCreateSupportTicketModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={handleCreated}
        defaultCategory={defaultCategory}
        requireWorker={false}
      />
    </div>
  );
}
