"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Calendar, ChevronDown, Download, Filter, Loader2, Search } from "lucide-react";
import type { DateRangePreset } from "@/lib/analytics/period";
import type { TeamProductivityPayload } from "@/lib/analytics/team-productivity-service";

const CHART_AXIS_TICK = { fontSize: 10, fill: "#6B7280" };
const CHART_GRID_STROKE = "#E5E7EB";

const PRESET_OPTIONS: Array<{ id: DateRangePreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last_7_days", label: "Last 7 days" },
  { id: "last_30_days", label: "Last 30 days" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "quarter", label: "Quarter" },
  { id: "year", label: "Year" },
  { id: "custom", label: "Custom" },
];

type TabId =
  | "overview"
  | "departments"
  | "employees"
  | "sessions"
  | "jobs"
  | "recruitment"
  | "hr"
  | "finance"
  | "scorecards"
  | "exports"
  | "settings";

function MetricCard({
  label,
  display,
  changePct,
  direction,
  explanation,
  unit,
}: {
  label: string;
  display: string;
  changePct: number | null;
  direction: string;
  explanation: string;
  unit?: string;
}) {
  const positive = direction === "up";
  const negative = direction === "down";
  return (
    <div
      className="flex min-h-[120px] flex-col justify-center rounded-md border border-[#E5E7EB] bg-white p-[14px]"
      title={explanation}
    >
      <p className="font-[Inter,sans-serif] text-[12px] font-semibold leading-[16px] text-[#6B7280]">
        {label}
      </p>
      <div className="mt-2 flex items-end gap-2">
        <p className="font-[Inter,sans-serif] text-[22px] font-semibold leading-[30px] text-[#111827]">
          {display}
          {display !== "N/A" && unit ? (
            <span className="ml-1 text-[12px] font-medium text-[#6B7280]">{unit}</span>
          ) : null}
        </p>
        {changePct != null ? (
          <span
            className={`mb-1 font-[Inter,sans-serif] text-[12px] font-semibold ${
              positive ? "text-[#10B981]" : negative ? "text-[#EF4444]" : "text-[#6B7280]"
            }`}
          >
            {changePct > 0 ? "+" : ""}
            {changePct}%
          </span>
        ) : null}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex min-h-[280px] flex-col overflow-hidden rounded-md border border-[#E5E7EB] bg-white ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] px-[14px] py-[10px]">
        <h2 className="font-[Inter,sans-serif] text-[16px] font-semibold leading-[24px] text-[#012352]">
          {title}
        </h2>
        {action}
      </div>
      <div className="min-h-0 flex-1 p-[14px]">{children}</div>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[160px] items-center justify-center rounded-md border border-dashed border-[#E5E7EB] bg-[#F9FAFB] px-4 text-center font-[Inter,sans-serif] text-[12px] text-[#6B7280]">
      {message}
    </div>
  );
}

export default function TeamProductivityClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = (searchParams.get("tab") as TabId | null) ?? "overview";
  const preset = (searchParams.get("preset") as DateRangePreset | null) ?? "last_7_days";
  const departmentIds = searchParams.get("departmentIds") ?? "";
  const employeeIds = searchParams.get("employeeIds") ?? "";
  const roles = searchParams.get("roles") ?? "";
  const q = searchParams.get("q") ?? "";

  const [data, setData] = useState<TeamProductivityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [settingsIdle, setSettingsIdle] = useState(300);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") next.delete(key);
        else next.set(key, value);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("preset", preset);
    if (departmentIds) p.set("departmentIds", departmentIds);
    if (employeeIds) p.set("employeeIds", employeeIds);
    if (roles) p.set("roles", roles);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    if (start) p.set("start", start);
    if (end) p.set("end", end);
    return p.toString();
  }, [preset, departmentIds, employeeIds, roles, searchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/reports/team-productivity?${queryString}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load report");
        if (!cancelled) setData(json as TeamProductivityPayload);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load report");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  useEffect(() => {
    if (tab !== "settings") return;
    fetch("/api/admin/reports/team-productivity/settings")
      .then((res) => res.json())
      .then((json) => {
        const idle = Number(json?.settings?.idle_threshold_seconds);
        if (Number.isFinite(idle)) setSettingsIdle(idle);
      })
      .catch(() => undefined);
  }, [tab]);

  const filteredEmployees = useMemo(() => {
    const rows = data?.employees ?? [];
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(query) ||
        row.email.toLowerCase().includes(query) ||
        row.roleLabel.toLowerCase().includes(query) ||
        (row.departmentName ?? "").toLowerCase().includes(query),
    );
  }, [data?.employees, q]);

  const availableTabs = data?.tabs ?? [];
  const presetLabel = PRESET_OPTIONS.find((p) => p.id === preset)?.label ?? "Last 7 days";

  const saveSettings = async () => {
    setSettingsSaving(true);
    try {
      const res = await fetch("/api/admin/reports/team-productivity/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idleThresholdSeconds: settingsIdle }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save settings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 px-4 py-[30px] sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 py-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/admin_recruiter/reports"
            className="mb-2 inline-flex font-[Inter,sans-serif] text-[12px] font-medium text-[#012352] hover:underline"
          >
            ← Back to Report Center
          </Link>
          <h1 className="font-[Inter,sans-serif] text-[30px] font-semibold leading-[36px] text-black">
            Team Productivity KPI
          </h1>
          <p className="font-[Inter,sans-serif] text-[16px] font-normal leading-[24px] text-[#374151]">
            Employee performance, session engagement, and department activity analytics.
          </p>
          {data?.disclosure ? (
            <p className="mt-2 max-w-3xl font-[Inter,sans-serif] text-[11px] leading-[16px] text-[#6B7280]">
              {data.disclosure}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:gap-[20px]">
          <div className="flex items-center">
            <label className="sr-only" htmlFor="tp-preset">
              Date range
            </label>
            <select
              id="tp-preset"
              value={preset}
              onChange={(e) => setParams({ preset: e.target.value })}
              className="flex items-center gap-1 rounded-l-lg border border-[#E5E7EB] bg-white px-2 py-1.5 font-[Inter,sans-serif] text-[12px] text-[#374151]"
            >
              {PRESET_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="flex items-center gap-1 rounded-r-lg border border-l-0 border-[#E5E7EB] bg-white px-2 py-1.5 font-[Inter,sans-serif] text-[12px] text-[#374151]">
              <Calendar className="h-4 w-4" aria-hidden />
              {data?.period.label ?? presetLabel}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 font-[Inter,sans-serif] text-[12px] text-[#374151] hover:bg-[#F9FAFB]"
            >
              <Filter className="h-4 w-4" aria-hidden />
              Filters
            </button>
            <a
              href={`/api/admin/reports/team-productivity/export?${queryString}&format=csv`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 font-[Inter,sans-serif] text-[12px] text-[#374151] hover:bg-[#F9FAFB]"
            >
              <Download className="h-4 w-4" aria-hidden />
              Export CSV
            </a>
          </div>
        </div>
      </div>

      {showFilters ? (
        <div className="grid grid-cols-1 gap-3 rounded-md border border-[#E5E7EB] bg-white p-4 md:grid-cols-3">
          <label className="flex flex-col gap-1 font-[Inter,sans-serif] text-[12px] text-[#374151]">
            Department
            <select
              value={departmentIds.split(",")[0] ?? ""}
              onChange={(e) => setParams({ departmentIds: e.target.value || null })}
              className="rounded-md border border-[#CBD5E1] px-2 py-1.5"
            >
              <option value="">All departments</option>
              {(data?.departments ?? [])
                .filter((d) => d.departmentId)
                .map((d) => (
                  <option key={d.departmentId!} value={d.departmentId!}>
                    {d.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-[Inter,sans-serif] text-[12px] text-[#374151]">
            Employee
            <select
              value={employeeIds.split(",")[0] ?? ""}
              onChange={(e) => setParams({ employeeIds: e.target.value || null })}
              className="rounded-md border border-[#CBD5E1] px-2 py-1.5"
            >
              <option value="">All employees</option>
              {(data?.employees ?? []).map((e) => (
                <option key={e.employeeId} value={e.employeeId}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-[Inter,sans-serif] text-[12px] text-[#374151]">
            Role
            <select
              value={roles.split(",")[0] ?? ""}
              onChange={(e) => setParams({ roles: e.target.value || null })}
              className="rounded-md border border-[#CBD5E1] px-2 py-1.5"
            >
              <option value="">All roles</option>
              {Array.from(
                new Map((data?.employees ?? []).map((e) => [e.role, e.roleLabel])).entries(),
              ).map(([role, label]) => (
                <option key={role} value={role}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="rounded-md border border-[#CBD5E1] px-3 py-2 text-[12px] text-[#374151] hover:bg-[#F9FAFB] md:col-span-3 md:w-fit"
            onClick={() =>
              setParams({
                departmentIds: null,
                employeeIds: null,
                roles: null,
                start: null,
                end: null,
              })
            }
          >
            Clear filters
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-[#E5E7EB] bg-white">
        <nav className="flex min-w-max gap-1 px-2 py-2" aria-label="Team Productivity tabs">
          {availableTabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={!item.available && item.id !== tab}
                onClick={() => setParams({ tab: item.id })}
                className={`rounded-md px-3 py-2 font-[Inter,sans-serif] text-[12px] font-semibold transition ${
                  active
                    ? "bg-[#F4F4F4] text-[#BC8B41] underline decoration-[#BC8B41] underline-offset-4"
                    : item.available
                      ? "text-[#374151] hover:bg-[#F9FAFB]"
                      : "cursor-not-allowed text-[#94A3B8]"
                }`}
                title={item.available ? undefined : "Awaiting department event instrumentation"}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-[#6B7280]">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span className="font-[Inter,sans-serif] text-sm">Loading productivity analytics…</span>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 font-[Inter,sans-serif] text-sm text-[#B91C1C]">
          {error}
        </div>
      ) : null}

      {!loading && data && tab === "overview" ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.overview.cards.slice(0, 15).map((card) => (
              <MetricCard
                key={card.key}
                label={card.label}
                display={card.display}
                changePct={card.changePct}
                direction={card.direction}
                explanation={card.explanation}
                unit={card.unit}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <SectionCard title="Activity trend">
              {data.overview.activityTrend.some((p) => p.value > 0) ? (
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.overview.activityTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                      <XAxis dataKey="label" tick={CHART_AXIS_TICK} />
                      <YAxis tick={CHART_AXIS_TICK} allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="#004CFF" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState message="No recorded activity events in this period." />
              )}
            </SectionCard>

            <SectionCard title="Productivity by department">
              {data.overview.departmentBars.some((d) => d.available && (d.value ?? 0) > 0) ? (
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.overview.departmentBars.filter((d) => d.available)}
                      margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
                      <XAxis dataKey="dept" tick={CHART_AXIS_TICK} />
                      <YAxis tick={CHART_AXIS_TICK} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#BC8B41" radius={[4, 4, 0, 0]} barSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState message="No department activity in this period." />
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="Employee performance"
            action={
              <button
                type="button"
                className="inline-flex items-center gap-1 font-[Inter,sans-serif] text-[12px] text-[#012352]"
                onClick={() => setParams({ tab: "employees" })}
              >
                View all
                <ChevronDown className="h-4 w-4 -rotate-90" aria-hidden />
              </button>
            }
          >
            <EmployeeTable
              rows={filteredEmployees.slice(0, 8)}
              queryString={queryString}
              search={q}
              onSearch={(value) => setParams({ q: value || null })}
            />
          </SectionCard>

          <p className="font-[Inter,sans-serif] text-[11px] text-[#6B7280]">
            Generated {new Date(data.generatedAt).toLocaleString()} · Last activity{" "}
            {data.dataFreshness.lastActivityAt
              ? new Date(data.dataFreshness.lastActivityAt).toLocaleString()
              : "N/A"}
          </p>
        </>
      ) : null}

      {!loading && data && tab === "departments" ? (
        <SectionCard title="Departments">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-[#E5E7EB] font-[Inter,sans-serif] text-[12px] font-semibold text-[#6B7280]">
                  <th className="pb-3 pr-4">Department</th>
                  <th className="pb-3 pr-4">Employees</th>
                  <th className="pb-3 pr-4">Active</th>
                  <th className="pb-3 pr-4">Engaged hours</th>
                  <th className="pb-3 pr-4">Activities</th>
                  <th className="pb-3">Jobs worked</th>
                </tr>
              </thead>
              <tbody>
                {data.departments.map((dept) => (
                  <tr
                    key={dept.departmentId ?? "none"}
                    className="border-b border-[#F3F4F6] font-[Inter,sans-serif] text-[12px] text-[#374151]"
                  >
                    <td className="py-3 pr-4 font-medium text-[#111827]">{dept.name}</td>
                    <td className="py-3 pr-4">{dept.employeeCount}</td>
                    <td className="py-3 pr-4">{dept.activeEmployees}</td>
                    <td className="py-3 pr-4">{dept.engagedHours ?? "N/A"}</td>
                    <td className="py-3 pr-4">{dept.activityCount ?? "N/A"}</td>
                    <td className="py-3">{dept.jobsWorked ?? "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      {!loading && data && tab === "employees" ? (
        <SectionCard title="Employee performance">
          <EmployeeTable
            rows={filteredEmployees}
            queryString={queryString}
            search={q}
            onSearch={(value) => setParams({ q: value || null })}
          />
        </SectionCard>
      ) : null}

      {!loading && data && tab === "sessions" ? (
        <SectionCard title={`Activity & sessions (${data.sessions.activeCount} active now)`}>
          {data.sessions.history.length === 0 ? (
            <EmptyState message="No session records in this period. Sessions appear after staff interact in the app." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-[#E5E7EB] font-[Inter,sans-serif] text-[12px] font-semibold text-[#6B7280]">
                    <th className="pb-3 pr-4">Employee</th>
                    <th className="pb-3 pr-4">Login</th>
                    <th className="pb-3 pr-4">Logout</th>
                    <th className="pb-3 pr-4">Session</th>
                    <th className="pb-3 pr-4">Engaged</th>
                    <th className="pb-3 pr-4">Idle</th>
                    <th className="pb-3">Activities</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sessions.history.map((row) => (
                    <tr
                      key={row.sessionId}
                      className="border-b border-[#F3F4F6] font-[Inter,sans-serif] text-[12px] text-[#374151]"
                    >
                      <td className="py-3 pr-4 font-medium text-[#111827]">
                        {row.employeeName}
                        {row.isActive ? (
                          <span className="ml-2 rounded bg-[#DCFCE7] px-1.5 py-0.5 text-[10px] text-[#166534]">
                            active
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4">{new Date(row.loginAt).toLocaleString()}</td>
                      <td className="py-3 pr-4">
                        {row.logoutAt ? new Date(row.logoutAt).toLocaleString() : "—"}
                      </td>
                      <td className="py-3 pr-4">{row.sessionHours}h</td>
                      <td className="py-3 pr-4">{row.engagedHours}h</td>
                      <td className="py-3 pr-4">{row.idleHours}h</td>
                      <td className="py-3">{row.activities}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      ) : null}

      {!loading && data && tab === "jobs" ? (
        <SectionCard title="Job & task analytics">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Jobs worked on"
              display={
                data.recruitment.totals.distinctJobsWorked != null
                  ? String(data.recruitment.totals.distinctJobsWorked)
                  : "N/A"
              }
              changePct={null}
              direction="na"
              explanation="Distinct jobs with attributed activity"
            />
            <MetricCard
              label="Tasks completed"
              display="N/A"
              changePct={null}
              direction="na"
              explanation="No general tasks table yet"
            />
          </div>
          <p className="mt-4 font-[Inter,sans-serif] text-[12px] text-[#6B7280]">
            Open an employee for job-level drill-down of attributed activity.
          </p>
        </SectionCard>
      ) : null}

      {!loading && data && tab === "recruitment" ? (
        <SectionCard title="Recruitment analytics">
          <p className="mb-4 font-[Inter,sans-serif] text-[12px] text-[#6B7280]">{data.recruitment.note}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(
              [
                [
                  "Status updates",
                  data.recruitment.totals.statusUpdates,
                  "From application_status_history by changed_by_user_id",
                ],
                [
                  "Stage advances",
                  data.recruitment.totals.stageAdvances,
                  "Forward moves across Pre-Hire stages",
                ],
                [
                  "Candidate matches",
                  data.recruitment.totals.candidateMatches,
                  "ANALYZED applications attributed via ai_analyzed_by",
                ],
                ["Meaningful actions", data.recruitment.totals.meaningfulActions, "Attributed activity events"],
                ["Jobs worked", data.recruitment.totals.distinctJobsWorked, "Distinct jobs with activity"],
                [
                  "Interviews scheduled",
                  data.recruitment.totals.interviewsScheduled,
                  "Interview-labeled recruiter activity logs",
                ],
                ["Hires attributed", data.recruitment.totals.hiresAttributed, "Hire-labeled activity events"],
              ] as const
            ).map(([label, value, explanation]) => (
              <MetricCard
                key={label}
                label={label}
                display={value != null ? String(value) : "N/A"}
                changePct={null}
                direction="na"
                explanation={explanation}
              />
            ))}
          </div>
          {data.recruitment.stageAdvancesByStage.length > 0 ? (
            <div className="mt-6 overflow-x-auto">
              <h3 className="mb-3 font-[Inter,sans-serif] text-[14px] font-semibold text-[#012352]">
                Moved forward by stage
              </h3>
              <table className="w-full min-w-[420px] text-left">
                <thead>
                  <tr className="border-b border-[#E5E7EB] font-[Inter,sans-serif] text-[12px] font-semibold text-[#6B7280]">
                    <th className="pb-3 pr-4">Destination stage</th>
                    <th className="pb-3">Advances</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recruitment.stageAdvancesByStage.map((row) => (
                    <tr
                      key={row.stageName}
                      className="border-b border-[#F3F4F6] font-[Inter,sans-serif] text-[12px] text-[#374151]"
                    >
                      <td className="py-3 pr-4 font-medium text-[#111827]">{row.stageName}</td>
                      <td className="py-3">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      {!loading && data && (tab === "hr" || tab === "finance" || tab === "scorecards") ? (
        <SectionCard title={tab === "hr" ? "HR Analytics" : tab === "finance" ? "Finance Analytics" : "KPI Scorecards"}>
          <EmptyState
            message={
              tab === "hr"
                ? data.hr.note
                : tab === "finance"
                  ? data.finance.note
                  : data.scorecards.note
            }
          />
        </SectionCard>
      ) : null}

      {!loading && data && tab === "exports" ? (
        <SectionCard title="Reports & exports">
          <p className="mb-4 font-[Inter,sans-serif] text-[12px] text-[#6B7280]">
            Exports respect active filters and access permissions. Missing metrics export as N/A.
          </p>
          <a
            href={`/api/admin/reports/team-productivity/export?${queryString}&format=csv`}
            className="inline-flex items-center gap-2 rounded-lg bg-[#012352] px-4 py-2 font-[Inter,sans-serif] text-[12px] font-semibold text-white"
          >
            <Download className="h-4 w-4" aria-hidden />
            Download employee CSV
          </a>
          <p className="mt-3 font-[Inter,sans-serif] text-[11px] text-[#94A3B8]">
            Excel and PDF export formats are planned next.
          </p>
        </SectionCard>
      ) : null}

      {!loading && tab === "settings" ? (
        <SectionCard title="KPI settings">
          <div className="max-w-lg space-y-4">
            <label className="flex flex-col gap-1 font-[Inter,sans-serif] text-[12px] text-[#374151]">
              Idle threshold (seconds)
              <input
                type="number"
                min={60}
                max={86400}
                value={settingsIdle}
                onChange={(e) => setSettingsIdle(Number(e.target.value))}
                className="rounded-md border border-[#CBD5E1] px-2 py-1.5"
              />
            </label>
            <p className="font-[Inter,sans-serif] text-[11px] text-[#6B7280]">
              Default is 300 seconds (5 minutes). Engaged time stops accruing after this inactivity
              window. Scores must not be used automatically for employment decisions, discipline, or
              compensation.
            </p>
            <button
              type="button"
              disabled={settingsSaving}
              onClick={() => void saveSettings()}
              className="rounded-lg bg-[#BC8B41] px-4 py-2 font-[Inter,sans-serif] text-[12px] font-semibold text-white disabled:opacity-60"
            >
              {settingsSaving ? "Saving…" : "Save settings"}
            </button>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}

function EmployeeTable({
  rows,
  queryString,
  search,
  onSearch,
}: {
  rows: TeamProductivityPayload["employees"];
  queryString: string;
  search: string;
  onSearch: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search employees"
          className="w-full rounded-lg border border-[#CBD5E1] bg-white py-2 pl-9 pr-3 font-[Inter,sans-serif] text-[12px]"
          aria-label="Search employees"
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState message="No employees match the current filters." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-[#E5E7EB] font-[Inter,sans-serif] text-[12px] font-semibold text-[#6B7280]">
                <th className="pb-3 pr-4">Employee</th>
                <th className="pb-3 pr-4">Department</th>
                <th className="pb-3 pr-4">Role</th>
                <th className="pb-3 pr-4">Engaged hours</th>
                <th className="pb-3 pr-4">Jobs worked</th>
                <th className="pb-3 pr-4">Status updates</th>
                <th className="pb-3 pr-4">Stage advances</th>
                <th className="pb-3 pr-4">Candidate matches</th>
                <th className="pb-3 pr-4">Activity count</th>
                <th className="pb-3">Target attainment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.employeeId}
                  className="border-b border-[#F3F4F6] font-[Inter,sans-serif] text-[12px] text-[#374151]"
                >
                  <td className="py-3 pr-4">
                    <Link
                      href={`/admin_recruiter/reports/team-productivity/employees/${row.employeeId}?${queryString}`}
                      className="font-medium text-[#012352] hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">{row.departmentName ?? "Unassigned"}</td>
                  <td className="py-3 pr-4">{row.roleLabel}</td>
                  <td className="py-3 pr-4">{row.engagedHours ?? "N/A"}</td>
                  <td className="py-3 pr-4">{row.jobsWorked ?? "N/A"}</td>
                  <td className="py-3 pr-4">{row.statusUpdates ?? "N/A"}</td>
                  <td className="py-3 pr-4">{row.stageAdvances ?? "N/A"}</td>
                  <td className="py-3 pr-4">{row.candidateMatches ?? "N/A"}</td>
                  <td className="py-3 pr-4">{row.activityCount ?? "N/A"}</td>
                  <td className="py-3">{row.targetAttainment ?? "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
