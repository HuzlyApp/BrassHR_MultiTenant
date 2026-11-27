"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import Link from "next/link";
import { applicationPath } from "@/lib/tenant/with-tenant";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import {
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_DOCUMENTS_PAGE_SECTION_TITLE_CLASS,
  WORKER_DOCUMENTS_PAGE_SECTION_TITLE_STYLE,
} from "./worker-schedule-typography";
import {
  applicationCurrentStageMeta,
  // normalizeApplicationStatus,
} from "@/lib/jobs/application-status";
import type { WorkerJobApplicationListItem } from "@/lib/applicant-portal/list-worker-job-applications";

const FILTER_SELECT_CLASS =
  "h-10 min-w-[148px] appearance-none rounded-lg border border-[#E5E7EB] bg-white py-2 pl-3 pr-9 text-sm font-medium text-[#374151] outline-none transition hover:bg-[#F9FAFB] focus:border-[color:var(--brand-primary)]";

function formatApplicationDate(iso: string | null | undefined): { relative: string; absolute: string } {
  if (!iso) return { relative: "—", absolute: "" };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { relative: "—", absolute: "" };
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  let relative = date.toLocaleDateString("en-US", { timeZone: "America/New_York",  month: "long", day: "numeric", year: "numeric" });
  if (minutes < 1) relative = "Just now";
  else if (minutes < 60) relative = `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  else if (hours < 24) relative = `${hours} hour${hours === 1 ? "" : "s"} ago`;
  else if (days < 7) relative = `${days} day${days === 1 ? "" : "s"} ago`;
  return {
    relative,
    absolute: date.toLocaleDateString("en-US", { timeZone: "America/New_York", 
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  };
}

function workTypeBadgeClass(workType: string): string {
  const value = workType.trim().toUpperCase();
  if (value === "1099") return "bg-[#F3E8FF] text-[#7E22CE]";
  if (value === "W2") return "bg-[#DBEAFE] text-[#1D4ED8]";
  if (value === "CONTRACT") return "bg-[#FFEDD5] text-[#C2410C]";
  return "bg-[#F1F5F9] text-[#475569]";
}

/* function statusBadgeClass(status: string): string {
  switch (normalizeApplicationStatus(status)) {
    case "new":
    case "reviewing":
      return "bg-[#DBEAFE] text-[#2563EB]";
    case "shortlisted":
    case "interviewing":
      return "bg-[#E0F2FE] text-[#0369A1]";
    case "hired":
      return "bg-[#DCFCE7] text-[#15803D]";
    case "rejected":
      return "bg-[#FEE2E2] text-[#B91C1C]";
    case "undecided":
      return "bg-[#F1F5F9] text-[#475569]";
    case "archived":
      return "bg-[#E2E8F0] text-[#475569]";
    default:
      return "bg-[#DBEAFE] text-[#2563EB]";
  }
} */

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function applicationStatusBadge(row: WorkerJobApplicationListItem): { label: string; className: string } {
  const label = row.statusName.trim() || row.status || "Applied";
  const value = `${label} ${row.status}`.toLowerCase();
  if (value.includes("reject") || value.includes("declin") || value.includes("not selected")) {
    return { label: "Not Selected", className: "bg-[#F3F4F6] text-[#6B7280]" };
  }
  if (value.includes("review") || value.includes("interview")) {
    return { label: "In Review", className: "bg-[#FFEDD5] text-[#C2410C]" };
  }
  if (value.includes("hired")) {
    return { label: "Hired", className: "bg-[#DCFCE7] text-[#15803D]" };
  }
  return { label: label || "Applied", className: "bg-[#DCFCE7] text-[#15803D]" };
}

function formatPay(row: WorkerJobApplicationListItem): string {
  return row.agreedPayRate?.trim() || row.billRate?.trim() || "—";
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CandidateApplicationsTab({
  showFiltersAndExport = false,
  portalPage = false,
}: {
  showFiltersAndExport?: boolean;
  portalPage?: boolean;
}) {
  const { sessionReady, authHeaders } = useApplicantPortal();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applications, setApplications] = useState<WorkerJobApplicationListItem[]>([]);
  const [workTypeFilter, setWorkTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openingResumeId, setOpeningResumeId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionReady) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const res = await fetch("/api/applicant-portal/applications", { headers, cache: "no-store" });
      const payload = (await res.json().catch(() => ({}))) as {
        applications?: WorkerJobApplicationListItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not load applications.");
      setApplications(payload.applications ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load applications.");
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, sessionReady]);

  useEffect(() => {
    void load();
  }, [load]);

  const workTypeOptions = useMemo(() => {
    const values = Array.from(
      new Set(applications.map((row) => row.workType.trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    return values;
  }, [applications]);

  const statusOptions = useMemo(() => {
    const byName = new Map<string, string>();
    for (const row of applications) {
      const key = row.statusName.trim() || row.status;
      if (key && !byName.has(key)) byName.set(key, key);
    }
    return Array.from(byName.values()).sort((a, b) => a.localeCompare(b));
  }, [applications]);

  const filtered = useMemo(() => {
    return applications.filter((row) => {
      if (workTypeFilter !== "all" && row.workType !== workTypeFilter) return false;
      if (statusFilter !== "all") {
        const label = row.statusName.trim() || row.status;
        if (label !== statusFilter) return false;
      }
      return true;
    });
  }, [applications, statusFilter, workTypeFilter]);

  async function openResume(resumeId: string) {
    setOpeningResumeId(resumeId);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch(`/api/applicant-portal/resumes/${encodeURIComponent(resumeId)}`, {
        headers,
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !payload.url) throw new Error(payload.error || "Could not open resume.");
      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch {
      // Keep the listing visible if a resume file cannot be opened.
    } finally {
      setOpeningResumeId(null);
    }
  }

  function exportCsv() {
    const header = ["Job Title", "Company", "Work Type", "Application Date", "Current Stage", "Note", "Status", "Resume"];
    const lines = [
      header.join(","),
      ...filtered.map((row) => {
        const applied = formatApplicationDate(row.appliedAt);
        const stage = applicationCurrentStageMeta(row.status, row.statusName);
        return [
          csvEscape(row.jobTitle),
          csvEscape(row.companyName),
          csvEscape(row.workType || "—"),
          csvEscape(applied.absolute || applied.relative),
          csvEscape(stage.label),
          csvEscape(row.statusNote?.trim() || stage.subtitle),
          csvEscape(row.statusName),
          csvEscape(row.resume?.fileName || "—"),
        ].join(",");
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "job-applications.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className={`${portalPage ? "overflow-hidden rounded-xl border border-[#E5E7EB] bg-white" : WORKER_SCHEDULE_CARD_CLASS} w-full`}>
      {portalPage ? null : (
      <div className="flex flex-col gap-4 border-b border-[#E5E7EB] px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            className={WORKER_DOCUMENTS_PAGE_SECTION_TITLE_CLASS}
            style={WORKER_DOCUMENTS_PAGE_SECTION_TITLE_STYLE}
          >
            All applied Job Applications
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            This candidate for multiple jobs for different work types
          </p>
        </div>
        {showFiltersAndExport ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="sr-only">Filter by work type</span>
              <select
                className={FILTER_SELECT_CLASS}
                value={workTypeFilter}
                onChange={(event) => setWorkTypeFilter(event.target.value)}
              >
                <option value="all">All Work Types</option>
                {workTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            </label>
            <label className="relative">
              <span className="sr-only">Filter by status</span>
              <select
                className={FILTER_SELECT_CLASS}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All Status</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            </label>
            <button
              type="button"
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#374151] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        ) : null}
      </div>
      )}

      {loading ? (
        <p className="px-4 py-8 text-sm text-[#64748B]">Loading applications…</p>
      ) : error ? (
        <p className="px-4 py-8 text-sm text-[#B91C1C]">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="px-4 py-8 text-sm text-[#64748B]">You have not applied to any jobs yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs font-medium text-[#6B7280]">
                <th className="px-4 py-3 font-medium">Job Title</th>
                <th className="px-4 py-3 font-medium">Work Type</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Resume</th>
                <th className="px-4 py-3 font-medium">Pay Rate</th>
                <th className="px-4 py-3 font-medium">Applied Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const status = applicationStatusBadge(row);
                return (
                  <tr key={row.id} className="border-b border-[#F3F4F6] last:border-b-0">
                    <td className="px-4 py-4 text-sm font-medium text-[#111827]">
                      <Link className="text-[#012352] hover:underline" href={applicationPath(`/application/candidate/applications?application=${encodeURIComponent(row.id)}`)}>{row.jobTitle}</Link>
                    </td>
                    <td className="px-4 py-4">
                      {row.workType ? (
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${workTypeBadgeClass(row.workType)}`}
                        >
                          {row.workType}
                        </span>
                      ) : (
                        <span className="text-sm text-[#94A3B8]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-[#374151]">{row.location || "—"}</td>
                    <td className="px-4 py-4">
                      {row.resume ? (
                        <button
                          type="button"
                          onClick={() => void openResume(row.resume!.id)}
                          disabled={openingResumeId === row.resume.id}
                          className="text-left text-sm text-[#012352] underline-offset-2 hover:underline"
                        >
                          {row.resume.fileName}
                        </button>
                      ) : (
                        <span className="text-sm text-[#94A3B8]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-[#111827]">{formatPay(row)}</td>
                    <td className="px-4 py-4 text-sm text-[#374151]">{formatShortDate(row.appliedAt)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
                        </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
