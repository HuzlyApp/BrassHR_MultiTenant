"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Briefcase, ChevronDown, ChevronRight, Download, Sparkles } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import AnalyticsChartFrame from "@/app/components/charts/AnalyticsChartFrame";
import { ApplicationPipelineModal } from "@/app/application/components/applicant-portal/ApplicationPipelineModal";
import { useApplicantPortal } from "@/app/application/components/applicant-portal/ApplicantPortalProvider";
import { useWorkerAccountOverview } from "@/app/application/components/applicant-portal/WorkerAccountContext";
import { WORKER_SCHEDULE_CARD_CLASS } from "@/app/application/components/applicant-portal/worker-schedule-typography";
import type { MeApplicationItem, MeApplicationsPayload } from "@/lib/applicant-portal/me-applications-shared";
import { buildApplicationsInsight } from "@/lib/applicant-portal/me-applications-shared";
import { workerApplicationStatusTextClass } from "@/lib/applicant-portal/worker-application-status";

const FILTER_SELECT_CLASS =
  "h-10 min-w-[140px] cursor-pointer appearance-none rounded-lg border border-[#D1D5DB] bg-white pl-3 pr-10 text-sm text-[#374151] outline-none transition hover:border-[#9CA3AF] focus:border-[#D1D5DB] focus:ring-0";

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={FILTER_SELECT_CLASS}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]"
        aria-hidden
      />
    </div>
  );
}

function formatRelativeAppliedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatAppliedDateLine(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function workTypeBadgeClass(type: string): string {
  if (type === "1099") return "bg-[#DCFCE7] text-[#166534]";
  if (type === "Contract") return "bg-[#EDE9FE] text-[#6D28D9]";
  return "bg-[#DBEAFE] text-[#1D4ED8]";
}

function exportApplicationsCsv(applications: MeApplicationItem[]) {
  const header = ["Job Title", "Company", "Work Type", "Applied Date", "Stage", "Status"];
  const rows = applications.map((app) => [
    app.job.title,
    app.tenant.name,
    app.job.employmentTypeLabel,
    formatAppliedDateLine(app.appliedAt),
    `${app.stage.label} - ${app.stage.sublabel}`,
    app.statusLabel,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "my-applications.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function DonutSummaryCard({
  title,
  data,
  centerLabel,
}: {
  title: string;
  data: Array<{ key: string; label: string; count: number; color: string }>;
  centerLabel?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className={`${WORKER_SCHEDULE_CARD_CLASS} flex h-full flex-col`}>
      <div className="border-b border-[#E5E7EB] px-4 py-3 sm:px-5">
        <h3 className="text-[15px] font-semibold text-[#111827]">{title}</h3>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="relative mx-auto h-[140px] w-[140px] shrink-0 sm:mx-0">
          {total > 0 ? (
            <AnalyticsChartFrame className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={42}
                    outerRadius={62}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {data.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </AnalyticsChartFrame>
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-[#F3F4F6] text-sm text-[#94A3B8]">
              No data
            </div>
          )}
          {centerLabel ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="text-center text-xs font-medium text-[#64748B]">{centerLabel}</span>
            </div>
          ) : null}
        </div>
        <ul className="min-w-0 flex-1 space-y-2">
          {data.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate text-[#374151]">{item.label}</span>
              </div>
              <span className="shrink-0 font-medium text-[#111827]">
                {item.count}
                {total > 0 ? ` (${Math.round((item.count / total) * 100)}%)` : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function WorkerAccountApplicationsTab() {
  const overview = useWorkerAccountOverview();
  const { sessionReady, authHeaders } = useApplicantPortal();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<MeApplicationsPayload | null>(null);
  const [workTypeFilter, setWorkTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pipelineApplicationId, setPipelineApplicationId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionReady) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");

      const appsRes = await fetch("/api/me/applications", { headers, cache: "no-store" });
      const appsJson = (await appsRes.json().catch(() => ({}))) as MeApplicationsPayload & {
        error?: string;
      };
      if (!appsRes.ok) throw new Error(appsJson.error || "Could not load applications.");
      setPayload(appsJson);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load applications.");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, sessionReady]);

  useEffect(() => {
    void load();
  }, [load]);

  const applications = payload?.applications ?? [];
  const summary = payload?.summary;

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const workTypeOk =
        workTypeFilter === "all" || app.job.employmentType === workTypeFilter;
      const statusOk = statusFilter === "all" || app.statusKey === statusFilter;
      return workTypeOk && statusOk;
    });
  }, [applications, statusFilter, workTypeFilter]);

  const displayName = overview?.profile.displayName?.trim() || "Applicant";
  const insight = summary
    ? buildApplicationsInsight(displayName, summary).replace(
        displayName,
        displayName === "Applicant" ? "You" : displayName
      )
    : "";

  const statusOptions = useMemo(() => {
    const keys = new Set(applications.map((app) => app.statusKey));
    return [...keys];
  }, [applications]);

  return (
    <div className="space-y-5 pb-8">
      <ApplicationPipelineModal
        open={Boolean(pipelineApplicationId)}
        applicationId={pipelineApplicationId}
        onClose={() => setPipelineApplicationId(null)}
        authHeaders={authHeaders}
      />
      <section className={`${WORKER_SCHEDULE_CARD_CLASS}`}>
        <div className="flex flex-col gap-4 border-b border-[#E5E7EB] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-[18px] font-semibold text-[#111827]">All Job Applications</h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              Track every job you have applied to and your current status.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect value={workTypeFilter} onChange={setWorkTypeFilter}>
              <option value="all">All Work Types</option>
              <option value="W2">W-2</option>
              <option value="1099">1099</option>
              <option value="Contract">Contract</option>
            </FilterSelect>
            <FilterSelect value={statusFilter} onChange={setStatusFilter}>
              <option value="all">All Status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </FilterSelect>
            <button
              type="button"
              onClick={() => exportApplicationsCsv(filteredApplications)}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-4 text-sm font-medium text-[#374151] transition hover:bg-[#F9FAFB]"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {loading ? (
          <p className="px-6 py-10 text-sm text-[#64748B]">Loading applications…</p>
        ) : error ? (
          <p className="px-6 py-10 text-sm text-[#B91C1C]">{error}</p>
        ) : filteredApplications.length === 0 ? (
          <p className="px-6 py-10 text-sm text-[#64748B]">
            {applications.length === 0
              ? "You have not applied to any jobs yet."
              : "No applications match the selected filters."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                <tr>
                  <th className="px-4 py-3 sm:px-6">Job Title</th>
                  <th className="px-4 py-3">Work Type</th>
                  <th className="px-4 py-3">Application Date</th>
                  <th className="min-w-[220px] px-4 py-3">Current Stage</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 sm:px-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {filteredApplications.map((app) => (
                  <tr key={app.applicationId} className="align-top hover:bg-[#FAFAFA]">
                    <td className="px-4 py-4 sm:px-6">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FFF7ED] text-[#F97316]">
                          <Briefcase className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#111827]">{app.job.title}</p>
                          <p className="mt-0.5 text-[#6B7280]">
                            {app.job.facility || app.tenant.name}
                          </p>
                          {app.job.location ? (
                            <p className="mt-0.5 text-xs text-[#94A3B8]">{app.job.location}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${workTypeBadgeClass(app.job.employmentType)}`}
                      >
                        {app.job.employmentTypeLabel}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[#374151]">
                      <p>{formatRelativeAppliedDate(app.appliedAt)}</p>
                      <p className="mt-0.5 text-xs text-[#94A3B8]">
                        {formatAppliedDateLine(app.appliedAt)}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-[#111827]">{app.stage.label}</p>
                      <p className="text-xs text-[#6B7280]">{app.stage.sublabel}</p>
                      <div className="mt-2 h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-[#E5E7EB]">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${app.stage.progressPercent}%`,
                            backgroundColor: app.stage.barColor,
                          }}
                        />
                      </div>
                    </td>
                    <td className={`px-4 py-4 font-medium ${workerApplicationStatusTextClass(app.statusLabel)}`}>
                      {app.statusLabel}
                    </td>
                    <td className="px-4 py-4 sm:px-6">
                      <button
                        type="button"
                        onClick={() => setPipelineApplicationId(app.applicationId)}
                        className="inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-[#F97316] hover:text-[#EA580C]"
                      >
                        View Details
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <DonutSummaryCard
          title="Work Type Summary"
          data={summary?.workTypeCounts ?? []}
          centerLabel={
            summary && summary.total > 0 ? `${summary.total} total` : undefined
          }
        />
        <DonutSummaryCard title="Application Status Summary" data={summary?.statusCounts ?? []} />
        <section className={`${WORKER_SCHEDULE_CARD_CLASS} flex h-full flex-col`}>
          <div className="border-b border-[#E5E7EB] px-4 py-3 sm:px-5">
            <h3 className="text-[15px] font-semibold text-[#111827]">Smart Insight</h3>
          </div>
          <div className="flex flex-1 flex-col justify-between gap-4 bg-[#FFF7ED] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#F97316] shadow-sm">
                <Sparkles className="h-4 w-4" />
              </span>
              <p className="text-sm leading-6 text-[#7C2D12]">
                {loading ? "Loading insight…" : insight}
              </p>
            </div>
            <Link
              href="/jobs"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#FDBA74] bg-white px-4 text-sm font-semibold text-[#C2410C] transition hover:bg-[#FFEDD5]"
            >
              Browse Open Jobs
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
