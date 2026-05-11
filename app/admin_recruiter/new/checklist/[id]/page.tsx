"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import DetailedCandidateHeader from "../../../components/DetailedCandidateHeader";
import DetailedTabs from "../../../components/DetailedTabs";
import {
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  LogOut,
  Menu,
  MoreVertical,
  Settings,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from "lucide-react";

type ItemState = "pending" | "complete" | "uploaded" | "answered" | "warning" | "not_reachable" | "not_applicable";

type ChecklistRow = {
  id: string;
  title: string;
  subtitle?: string;
  state: ItemState;
  optional?: boolean;
  checked?: boolean;
  detailLine?: string;
  badge?: string;
};

type ChecklistSection = {
  id: string;
  title: string;
  subtitle?: string;
  rows: ChecklistRow[];
};

type ChecklistActivityEntry = {
  id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: unknown;
  created_at: string | null;
};

type ChecklistPayload = {
  worker: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    job_role: string | null;
    city: string | null;
    state: string | null;
    created_at: string | null;
    updated_at?: string | null;
    status_label: string;
  };
  activity_history?: ChecklistActivityEntry[];
  meta: {
    daysInStage: number;
    progressPercent: number;
    completedItems: number;
    totalItems: number;
    verifiedDocuments: { done: number; total: number };
    skillAssessments: { completed: number; total: number };
  };
  tracker: { labels: string[]; done: boolean[] };
  sections: ChecklistSection[];
};

function badgeClasses(state: ItemState): string {
  switch (state) {
    case "uploaded":
      return "bg-[#00B135] text-white border-[#00B135]";
    case "complete":
      return "bg-emerald-50 text-emerald-800 border-emerald-100";
    case "answered":
      return "bg-[#00B135] text-white border-[#00B135]";
    case "warning":
      return "bg-amber-50 text-amber-900 border-amber-100";
    case "not_reachable":
      return "bg-[#FB7185] text-white border-[#FB7185]";
    case "not_applicable":
      return "bg-slate-50 text-gray-600 border-slate-100";
    default:
      return "bg-white text-[#374151] border-[#D1D5DB]";
  }
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return hrs === 1 ? "1 hour ago" : `${hrs} hours ago`;
  const days = Math.floor(hrs / 24);
  if (days < 14) return days === 1 ? "1 day ago" : `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return months <= 1 ? "1 month ago" : `${months} months ago`;
}

function formatDateTimeParts(iso: string): { dateLine: string; timeLine: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { dateLine: "—", timeLine: "—" };
  }
  const dateLine = d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeLine = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return { dateLine, timeLine };
}

type RecentHistoryRow = {
  key: string;
  title: string;
  metaLine: string;
};

function buildRecentHistoryRows(data: ChecklistPayload | null): RecentHistoryRow[] {
  if (!data) return [];

  const logs = data.activity_history ?? [];
  const withTime = logs.filter((e) => e.created_at?.trim());
  if (withTime.length > 0) {
    return withTime.map((entry, index) => {
      const at = entry.created_at!.trim();
      const { dateLine, timeLine } = formatDateTimeParts(at);
      return {
        key: entry.id ?? `activity-${index}`,
        title: entry.action?.trim() || "Activity",
        metaLine: `${formatRelative(at)} • ${dateLine} • ${timeLine}`,
      };
    });
  }

  const w = data.worker;
  const created = w.created_at?.trim() ?? "";
  const updatedRaw = w.updated_at?.trim() ?? "";
  const updated = updatedRaw && updatedRaw !== created ? updatedRaw : "";

  type Row = { key: string; title: string; at: string };
  const rows: Row[] = [];
  if (created) {
    rows.push({ key: "created", title: "Applicant record created", at: created });
  }
  if (updated) {
    rows.push({ key: "updated", title: "Applicant profile updated", at: updated });
  }
  rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return rows.map((r) => {
    const { dateLine, timeLine } = formatDateTimeParts(r.at);
    return {
      key: r.key,
      title: r.title,
      metaLine: `${formatRelative(r.at)} • ${dateLine} • ${timeLine}`,
    };
  });
}

function RowBadge({ text, state }: { text: string; state: ItemState }) {
  return (
    <span
      className={`inline-flex h-6 min-w-16 items-center justify-center rounded-[4px] border px-2 py-1 text-center text-xs font-semibold leading-4 ${badgeClasses(state)}`}
    >
      {text}
    </span>
  );
}

export default function NewApplicantChecklistPage() {
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const applicantId = params?.id;

  const isWorkerRoute = pathname?.startsWith("/admin_recruiter/workers/") ?? false;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ChecklistPayload | null>(null);

  useEffect(() => {
    async function run() {
      if (!applicantId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/worker-checklist?workerId=${encodeURIComponent(applicantId)}`);
        const json = (await res.json()) as ChecklistPayload & { error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to load checklist");
        setData(json);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Failed to load");
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [applicantId]);

  const candidateName = useMemo(() => {
    const w = data?.worker;
    const n = `${w?.first_name ?? ""} ${w?.last_name ?? ""}`.trim();
    return n || "Applicant";
  }, [data?.worker]);

  const candidateRole = data?.worker?.job_role || "N/A";
  const candidateLocation = useMemo(() => {
    const parts = [data?.worker?.city ?? "", data?.worker?.state ?? ""].filter(Boolean);
    return parts.length ? parts.join(", ") : "—";
  }, [data?.worker?.city, data?.worker?.state]);

  const recentHistoryRows = useMemo(() => buildRecentHistoryRows(data), [data]);

  return (
    <div className="flex min-h-screen bg-zinc-50 overflow-hidden">
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0A1F1C] text-white transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="px-6 py-8 flex items-center gap-3 border-b border-white/10">
            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center">
              <span className="text-[#0A1F1C] font-bold text-3xl">N</span>
            </div>
            <div>
              <div className="font-semibold text-2xl tracking-tight">Nexus</div>
              <div className="text-xs text-teal-400 -mt-1">MedPro Staffing</div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-8 space-y-1">
            <div className="px-4 text-xs uppercase tracking-widest text-teal-400/70 mb-4">
              PERSONAL SETTINGS
            </div>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 rounded-2xl">
              Profile
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 rounded-2xl">
              Account
            </a>

            <div className="px-4 pt-8 text-xs uppercase tracking-widest text-teal-400/70 mb-4">
              TEAM MANAGEMENT
            </div>

            {[
              { label: "Candidates", href: "/admin_recruiter/candidates", icon: Users },
              { label: "New", href: "/admin_recruiter/new", icon: UserPlus },
              { label: "Pending", href: "/admin_recruiter/pending", icon: UserCheck },
              { label: "Approved", href: "/admin_recruiter/approved", icon: UserCheck },
              { label: "Disapproved", href: "/admin_recruiter/disapproved", icon: UserX },
              { label: "Workers", href: "/admin_recruiter/workers", icon: Briefcase },
              { label: "Schedule", href: "/admin_recruiter/schedule", icon: Calendar },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 text-sm rounded-2xl transition-all ${
                    isActive ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/10"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}

            <div className="px-4 pt-10">
              <a href="#" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 rounded-2xl">
                <Settings className="w-5 h-5" /> Settings
              </a>
            </div>
          </nav>

          <div className="p-6 border-t border-white/10">
            <button className="flex w-full items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-white/10 rounded-2xl">
              <LogOut className="w-5 h-5" /> Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden lg:pl-72">
        <header className="h-16 border-b bg-white flex items-center px-6 justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="lg:hidden text-gray-600"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="flex items-baseline gap-3">
              <div className="font-semibold text-2xl">{isWorkerRoute ? "Worker" : "New Applicant"}</div>
              <Link
                href={isWorkerRoute ? "/admin_recruiter/workers" : "/admin_recruiter/new"}
                className="text-sm text-gray-600 hover:text-gray-600"
              >
                Back to {isWorkerRoute ? "Workers" : "New"}
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-1 rounded-full text-sm">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Online
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="font-medium text-sm">Sean Smith</div>
                <div className="text-xs text-gray-600">Manager</div>
              </div>
              <img
                src="https://i.pravatar.cc/128?u=sean"
                alt="Sean Smith"
                className="w-9 h-9 rounded-full object-cover"
              />
            </div>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-[1320px] mx-auto">
            <div className="mb-5 text-xs text-gray-600">
              Admin - {isWorkerRoute ? "Worker" : "New Applicant"} Detailed Page - Checklist
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <DetailedCandidateHeader
              name={candidateName}
              role={candidateRole}
              loading={loading}
            />
            <DetailedTabs applicantId={applicantId} activeTab="Checklist" />

            <div className="mx-auto flex w-full max-w-[1300px] flex-col gap-[30px] overflow-hidden rounded-md border border-[#E5E7EB] bg-white p-5">
              <div className="hidden p-3 sm:p-4 border-b border-[#9CC3FF]/30 bg-white/40">
                <div className="mx-auto flex h-[92px] w-full max-w-[1300px] items-center justify-between rounded-md border border-[#D1D5DB] bg-white px-5">
                  <div className="flex items-center gap-3">
                    <img
                      src="/icons/admin-recruiter/user.svg"
                      alt="User"
                      className="h-[52px] w-[52px] shrink-0"
                    />
                    <div>
                      <div className="text-base font-semibold leading-6 text-[#0D9488]">
                        {loading ? "John Doe" : candidateName || "John Doe"}
                      </div>
                      <div className="mt-0.5 text-xs font-normal leading-4 text-[#4B5563]">
                        {candidateRole || "Licensed Practical Nurse , LPN"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex h-8 items-center justify-center rounded-md border border-[#D1D5DB] bg-white px-3 text-center text-xs font-semibold leading-4 text-[#111827] hover:bg-[#F9FAFB]"
                    >
                      New Applicant
                    </button>
                    <button
                      type="button"
                      aria-label="More options"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-[#6B7280] hover:bg-[#F3F4F6]"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-[30px]">
                <div className="h-[110px] w-full max-w-[1260px] rounded-md border border-[#0D9488] bg-[#F8FAFC] px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div className="text-[20px] font-semibold leading-7 text-[#1F2937]">Progress Checklist Tracker</div>
                    <div className="text-[18px] font-normal leading-7 text-[#374151]">
                      Days in current stage:{" "}
                      <span className="font-semibold text-[#1F2937]">{data?.meta?.daysInStage ?? "—"} days</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-4">
                    <div className="h-[10px] w-full max-w-[1168px] rounded-[100px] bg-[#ECF1F9] overflow-hidden">
                      <div
                        className="h-full rounded-[100px] bg-[#0D9488] transition-all"
                        style={{ width: `${data?.meta?.progressPercent ?? 0}%` }}
                      />
                    </div>
                    <div className="text-[18px] font-semibold leading-7 text-[#111827]">
                      {data?.meta?.progressPercent ?? 0}%
                    </div>
                  </div>
                </div>

                <main className="space-y-4">
                  {loading ? (
                    <div className="text-center py-16 text-gray-600">Loading checklist…</div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-[30px]">
                      {(data?.sections ?? []).map((section, sectionIndex) => (
                        <div
                          key={section.id}
                          className={`rounded-lg border border-[#E5E7EB] bg-white ${
                            sectionIndex < 2 ? "h-[426px]" : ""
                          }`}
                        >
                          <div className="flex h-16 items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3 pl-5 pr-5 pt-5">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#0D9488] bg-[#0D9488] text-sm font-semibold text-white">
                                {sectionIndex + 1}
                              </span>
                              <div className="text-[18px] font-semibold leading-7 text-[#111827]">{section.title}</div>
                            </div>
                            <button
                              type="button"
                              className="inline-flex h-8 w-[73px] items-center justify-center gap-1.5 rounded-[8px] border border-[#0D9488] px-4 py-2 text-xs font-semibold leading-4 text-[#0D9488]"
                            >
                              Details
                            </button>
                          </div>

                          <div className="space-y-3 p-5 pt-4">
                            {sectionIndex === 0 ? (
                              <>
                                {section.rows.slice(0, 2).map((row, rowIndex) => (
                                  <div key={row.id} className="p-0">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="text-sm font-semibold leading-5 text-[#111827]">
                                          {rowIndex + 1}. {row.title}
                                        </div>
                                      </div>
                                      <RowBadge text={row.badge ?? "Pending"} state={row.state} />
                                    </div>

                                    <div className="mt-3 flex items-center gap-3 text-sm text-[#6B7280]">
                                      <div className="h-4 w-4 rounded-[4px] border border-zinc-300 bg-white" />
                                      <span>{(row.subtitle?.trim() || row.title).replace(/^\d+\.\s*/, "")}</span>
                                    </div>
                                  </div>
                                ))}

                                {section.rows[2] ? (
                                  <div className="p-0">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="text-sm font-semibold leading-5 text-[#111827]">
                                          3. {section.rows[2].title.replace(/^\d+\.\s*/, "")} :
                                          <span className="ml-2 font-normal text-[#6B7280]">
                                            {section.rows[2].subtitle}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="mt-3 space-y-3">
                                      {section.rows.slice(3).map((row) => {
                                        const isVerified =
                                          row.checked === true ||
                                          row.state === "uploaded" ||
                                          row.state === "complete" ||
                                          row.state === "answered";
                                        return (
                                          <div key={row.id} className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                              <div
                                                className={`h-4 w-4 rounded-[4px] border flex items-center justify-center ${
                                                  isVerified
                                                    ? "border-teal-600 bg-teal-600"
                                                    : "border-zinc-300 bg-white"
                                                }`}
                                              >
                                                {isVerified ? (
                                                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                                ) : null}
                                              </div>
                                              <span className="text-sm leading-5 text-[#111827]">
                                                {row.title.replace(/^\d+\.\s*/, "")}
                                              </span>
                                            </div>
                                            <RowBadge text={row.badge ?? "Pending"} state={row.state} />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : null}
                              </>
                            ) : sectionIndex === 1 ? (
                              <>
                                {section.rows.map((row, rowIndex) => {
                                  const isAnswered =
                                    row.checked === true ||
                                    row.state === "answered" ||
                                    row.state === "complete" ||
                                    row.state === "uploaded";
                                  return (
                                    <div key={row.id} className="p-0">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="text-sm font-semibold leading-5 text-[#111827]">
                                            {rowIndex + 1}. {row.title.replace(/^\d+\.\s*/, "")}
                                          </div>
                                        </div>
                                        <RowBadge text={row.badge ?? "Pending"} state={row.state} />
                                      </div>

                                      <div className="mt-3 flex items-center gap-3 text-sm text-[#374151]">
                                        <div
                                          className={`h-4 w-4 rounded-[4px] border flex items-center justify-center ${
                                            isAnswered ? "border-teal-600 bg-teal-600" : "border-zinc-300 bg-white"
                                          }`}
                                        >
                                          {isAnswered ? (
                                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                          ) : null}
                                        </div>
                                        <span>{(row.subtitle?.trim() || row.title).replace(/^\d+\.\s*/, "")}</span>
                                      </div>

                                      {row.detailLine ? (
                                        <div className="mt-1 pl-7 text-[11px] text-[#94A3B8]">{row.detailLine}</div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </>
                            ) : sectionIndex === 2 || sectionIndex === 3 || sectionIndex === 4 || sectionIndex === 5 ? (
                              <>
                                {section.rows.map((row, rowIndex) => {
                                  const isChecked =
                                    row.checked === true ||
                                    row.state === "uploaded" ||
                                    row.state === "complete" ||
                                    row.state === "answered";
                                  const cleanTitle = row.title.replace(/^\d+\.\s*/, "");
                                  const subtitleIsMeta = (row.subtitle ?? "").startsWith("(");
                                  const checkboxText = (() => {
                                    if (row.id === "oig") return "For Verification";
                                    if (row.id === "drug") return "For Drug Test";
                                    if (row.id === "bg") return "For Background Check";
                                    if (row.subtitle && !subtitleIsMeta) return row.subtitle;
                                    return `For ${cleanTitle}`;
                                  })();

                                  return (
                                    <div key={row.id} className="p-0">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="text-sm font-semibold leading-5 text-[#111827]">
                                            {rowIndex + 1}. {cleanTitle}
                                            {subtitleIsMeta ? (
                                              <span className="ml-2 font-normal text-[#6B7280]">{row.subtitle}</span>
                                            ) : null}
                                          </div>
                                        </div>
                                        <RowBadge text={row.badge ?? "Pending"} state={row.state} />
                                      </div>

                                      <div className="mt-3 flex items-center gap-3 text-sm text-[#6B7280]">
                                        <div
                                          className={`h-4 w-4 rounded-[4px] border flex items-center justify-center ${
                                            isChecked ? "border-teal-600 bg-teal-600" : "border-zinc-300 bg-white"
                                          }`}
                                        >
                                          {isChecked ? (
                                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                          ) : null}
                                        </div>
                                        <span>{checkboxText}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </>
                            ) : (
                              <>
                                {section.rows.map((row) => (
                                  <div key={row.id} className="p-0">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="text-sm font-semibold leading-5 text-[#111827]">{row.title}</div>
                                        {row.subtitle ? (
                                      <div className="mt-0.5 text-sm font-normal leading-5 text-[#6B7280]">
                                            {row.subtitle}
                                          </div>
                                        ) : null}
                                      </div>
                                      <RowBadge text={row.badge ?? "Pending"} state={row.state} />
                                    </div>

                                    {typeof row.checked === "boolean" ||
                                    row.state === "uploaded" ||
                                    row.state === "complete" ||
                                    row.state === "answered" ? (
                                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                                        {(() => {
                                          const isVerified =
                                            row.checked === true ||
                                            row.state === "uploaded" ||
                                            row.state === "complete" ||
                                            row.state === "answered";
                                          return (
                                            <div
                                              className={`h-4 w-4 rounded-[4px] border flex items-center justify-center ${
                                                isVerified
                                                  ? "border-teal-600 bg-teal-600"
                                                  : "border-zinc-300 bg-white"
                                              }`}
                                            >
                                              {isVerified ? (
                                                <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                              ) : null}
                                            </div>
                                          );
                                        })()}
                                        <span>{(row.subtitle?.trim() || row.title).replace(/^\d+\.\s*/, "")}</span>
                                      </div>
                                    ) : null}

                                    {row.detailLine ? (
                                      <div className="mt-2 text-[11px] text-gray-600">{row.detailLine}</div>
                                    ) : null}
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <section className="mt-4 rounded-lg border border-[#E5E7EB] bg-white p-5">
                    <h3 className="text-[28px] font-semibold leading-7 text-[#111827]">Recent History</h3>
                    <div className="mt-4">
                      {loading ? (
                        <div className="py-4 text-sm text-[#6B7280]">Loading history…</div>
                      ) : recentHistoryRows.length === 0 ? (
                        <div className="rounded-md border border-dashed border-[#E5E7EB] px-4 py-8 text-center text-sm text-[#6B7280]">
                          No history yet.
                        </div>
                      ) : (
                        recentHistoryRows.map((entry) => (
                          <div
                            key={entry.key}
                            className="flex items-start gap-3 border-b border-[#E5E7EB] py-3 last:border-b-0"
                          >
                            <img
                              src="/icons/admin-recruiter/history-icon.svg"
                              alt=""
                              className="mt-0.5 h-[30px] w-[30px] shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium leading-5 text-[#0D9488]">{entry.title}</div>
                              <div className="text-xs leading-4 text-[#6B7280]">{entry.metaLine}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </main>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
