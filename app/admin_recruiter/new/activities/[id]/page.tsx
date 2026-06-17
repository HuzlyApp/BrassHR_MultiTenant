"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import DetailedCandidateHeader from "../../../components/DetailedCandidateHeader";
import DetailedTabs from "../../../components/DetailedTabs";
import CandidateDetailLoader from "../../../components/CandidateDetailLoader";
import CandidateCommunicationHistory, {
  InboxChannelTabButtons,
  type InboxChannel,
} from "../../../components/CandidateCommunicationHistory";
import BrandedHistoryIcon from "../../../components/BrandedHistoryIcon";
import BrandedPhoneIcon from "../../../components/BrandedPhoneIcon";
import InterviewsPageClient from "../../../calendar/components/InterviewsPageClient";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import type { CommunicationThread } from "@/lib/communication/conversation";
import type { CandidateCommunicationRow } from "@/lib/communication/record";
import {
  Briefcase,
  Calendar,
  LogOut,
  Menu,
  Phone,
  Plus,
  RefreshCw,
  Settings,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from "lucide-react";
type WorkerProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  job_role: string | null;
  status_label?: string;
};

type WorkerProfileResponse = {
  worker: WorkerProfile;
  activity: {
    source: string;
    created_at: string | null;
    updated_at: string | null;
  };
  activity_history?: Array<{
    id: string | null;
    action: string | null;
    created_at: string | null;
  }>;
};

type ActivityTab = "Calls" | "Inbox" | "Interview";

function ordinalAttempt(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n}st call attempt`;
  if (mod10 === 2 && mod100 !== 12) return `${n}nd call attempt`;
  if (mod10 === 3 && mod100 !== 13) return `${n}rd call attempt`;
  return `${n}th call attempt`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

export default function NewApplicantActivitiesPage() {
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const applicantId = params?.id;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [active, setActive] = useState<ActivityTab>("Calls");
  const [leftNav, setLeftNav] = useState<"Recent Logs" | "History">("Recent Logs");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<WorkerProfileResponse | null>(null);
  const [commLoading, setCommLoading] = useState(false);
  const [commError, setCommError] = useState<string | null>(null);
  const [commThreads, setCommThreads] = useState<CommunicationThread[]>([]);
  const [commRefreshKey, setCommRefreshKey] = useState(0);
  const [inboxChannel, setInboxChannel] = useState<InboxChannel>("sms");
  const [inboxRefreshing, setInboxRefreshing] = useState(false);

  const branding = useTenantBranding();
  const companyName = branding.companyName?.trim() || "Company";

  useEffect(() => {
    async function fetchApplicant() {
      if (!applicantId) return;
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(
          `/api/admin/worker-profile?workerId=${encodeURIComponent(applicantId)}`
        );
        const json = (await res.json()) as WorkerProfileResponse & { error?: string };
        if (!res.ok) {
          throw new Error(json.error || `Failed to load profile (${res.status})`);
        }
        setProfile(json);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("Failed to fetch applicant for activities:", msg, e);
        setLoadError(msg);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }
    fetchApplicant();
  }, [applicantId]);

  const applicant = profile?.worker ?? null;

  const candidateName = useMemo(() => {
    const n = `${applicant?.first_name ?? ""} ${applicant?.last_name ?? ""}`.trim();
    return n || "Applicant";
  }, [applicant]);

  const candidateRole = applicant?.job_role || "N/A";
  const statusLabel = applicant?.status_label?.trim() || "New Applicant";

  useEffect(() => {
    async function fetchCommunicationData() {
      if (!applicantId) return;
      setCommLoading(true);
      setCommError(null);
      try {
        const res = await fetch(
          `/api/admin/candidates/${encodeURIComponent(applicantId)}/communications`,
          { cache: "no-store" }
        );
        const json = (await res.json().catch(() => ({}))) as {
          threads?: CommunicationThread[];
          error?: string;
        };
        if (!res.ok) throw new Error(json.error || `Failed to load communications (${res.status})`);
        setCommThreads(json.threads ?? []);
      } catch (e) {
        setCommThreads([]);
        setCommError(e instanceof Error ? e.message : "Failed to load communications.");
      } finally {
        setCommLoading(false);
      }
    }
    void fetchCommunicationData();
  }, [applicantId, commRefreshKey]);

  const smsThreads = useMemo(
    () => commThreads.filter((thread) => thread.channel === "sms"),
    [commThreads]
  );

  const smsRows = useMemo(() => {
    const rows: CandidateCommunicationRow[] = smsThreads.flatMap((thread) => thread.messages);
    return rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [smsThreads]);

  const historyRows = useMemo(
    () => [...smsRows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [smsRows]
  );

  const activityHistory = profile?.activity_history ?? [];
  const historyCount = activityHistory.length;

  const visibleCallRows = leftNav === "Recent Logs" ? smsRows : historyRows;

  function relativeTimeLabel(iso: string): string {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "—";
    const diffMs = Date.now() - t;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  function callOutcome(status: CandidateCommunicationRow["status"]): "Answered" | "Did not answer" {
    return status === "failed" ? "Did not answer" : "Answered";
  }
  function activityTabClass(isActive: boolean): string {
    return `shrink-0 px-0 pb-3 pt-1 text-sm font-medium leading-5 whitespace-nowrap transition-colors ${
      isActive
        ? "-mb-px border-b-2 border-(--brand-primary) text-(--brand-primary)"
        : "border-b-2 border-transparent text-[#2B3D51] hover:text-(--brand-primary)"
    }`;
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 overflow-hidden">
      {/* Sidebar */}
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
            <a
              href="#"
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 rounded-2xl"
            >
              Profile
            </a>
            <a
              href="#"
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 rounded-2xl"
            >
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
              <a
                href="#"
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 rounded-2xl"
              >
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

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden lg:pl-72">
        <header className="h-16 border-b bg-white flex items-center px-6 justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen((v) => !v)} className="lg:hidden text-gray-600">
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="font-semibold text-2xl">New Applicant</div>
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
            <DetailedTabs applicantId={applicantId} activeTab="Activities" />

            {loadError ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {loadError}
              </div>
            ) : null}

            {loading ? (
              <CandidateDetailLoader label="Loading activities..." />
            ) : (
              <>
            <DetailedCandidateHeader
              name={candidateName}
              role={candidateRole}
              status={statusLabel}
            />

            <nav
              className="mb-4 mx-auto flex w-full max-w-[1300px] items-end justify-center gap-x-8"
              aria-label="Activity sections"
            >
              {(["Calls", "Inbox", "Interview"] as const).map((t) => {
                const isActive = active === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setActive(t)}
                    className={activityTabClass(isActive)}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {t}
                  </button>
                );
              })}
            </nav>

            {active === "Inbox" ? (
              <nav
                className="mb-4 mx-auto grid w-full max-w-[1300px] grid-cols-[1fr_auto_1fr] items-end"
                aria-label="Inbox channels"
              >
                <div aria-hidden />
                <div className="flex items-end justify-center gap-x-8">
                  <InboxChannelTabButtons
                    active={inboxChannel}
                    onChange={setInboxChannel}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setCommRefreshKey((key) => key + 1)}
                    disabled={inboxRefreshing}
                    className="mb-2 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-(--brand-primary) bg-white px-3 text-xs font-semibold text-(--brand-primary) transition hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)] disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${inboxRefreshing ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                </div>
              </nav>
            ) : null}

            <div className="mx-auto w-full max-w-[1300px] overflow-hidden rounded-md border border-[#D1D5DB] bg-white">
              {active === "Inbox" ? (
                <CandidateCommunicationHistory
                  workerId={applicantId ?? ""}
                  refreshKey={commRefreshKey}
                  embedded
                  hideSubTabs
                  inboxNav={inboxChannel}
                  onInboxNavChange={setInboxChannel}
                  onLoadingChange={setInboxRefreshing}
                  candidateName={candidateName}
                />
              ) : active === "Interview" ? (
                <InterviewsPageClient
                  embedded
                  workerId={applicantId ?? ""}
                  candidateName={candidateName}
                  candidateStatus={statusLabel}
                />
              ) : (
                <div className="grid min-h-[420px] grid-cols-12">
                  <aside className="col-span-12 border-b border-[#E5E7EB] bg-[#FAFBFC] md:col-span-3 md:border-b-0 md:border-r">
                    <div className="space-y-2 p-4">
                      <button
                        type="button"
                        onClick={() => setLeftNav("Recent Logs")}
                        className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left text-xs transition ${
                          leftNav === "Recent Logs"
                            ? "border-(--brand-primary) bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)] text-(--brand-primary)"
                            : "border-transparent text-[#6B7280] hover:bg-white"
                        }`}
                      >
                        <span className="inline-flex items-center gap-2 font-medium">
                          <BrandedPhoneIcon className="h-3.5 w-3.5" />
                          Recent Logs
                        </span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[#6B7280] ring-1 ring-[#E5E7EB]">
                          {smsRows.length}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeftNav("History")}
                        className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left text-xs transition ${
                          leftNav === "History"
                            ? "border-(--brand-primary) bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)] text-(--brand-primary)"
                            : "border-transparent text-[#6B7280] hover:bg-white"
                        }`}
                      >
                        <span className="inline-flex items-center gap-2 font-medium">
                          <BrandedHistoryIcon className="h-3.5 w-3.5" />
                          History
                        </span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[#6B7280] ring-1 ring-[#E5E7EB]">
                          {historyCount}
                        </span>
                      </button>
                    </div>
                  </aside>

                  <main className="col-span-12 md:col-span-9">
                    <div className="flex items-center justify-end gap-2 border-b border-[#E5E7EB] px-5 py-3">
                      <button
                        type="button"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-(--brand-primary) bg-white px-4 text-xs font-semibold text-(--brand-primary) transition hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)]"
                      >
                        + Add a call log
                      </button>
                      <button
                        type="button"
                        disabled
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-[#F3F4F6] px-4 text-xs font-semibold text-[#9CA3AF]"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Call
                      </button>
                    </div>

                    <div className="px-5 py-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 text-[20px] font-semibold leading-7 text-[#1F2937]">
                          <BrandedPhoneIcon className="h-5 w-5" />
                          {leftNav === "Recent Logs" ? "Call History" : "Activity History"}
                        </div>
                        <div className="text-xs text-[#6B7280]">
                          Actions taken{" "}
                          <span className="font-semibold text-[#111827]">
                            {leftNav === "Recent Logs" ? visibleCallRows.length : historyCount}
                          </span>
                        </div>
                      </div>

                      {leftNav === "History" ? (
                        activityHistory.length === 0 ? (
                          <div className="rounded-md border border-dashed border-[#D1D5DB] py-10 text-center text-sm text-[#6B7280]">
                            No history entries yet.
                          </div>
                        ) : (
                          <div className="space-y-0">
                            {activityHistory.map((entry, idx) => (
                              <div
                                key={entry.id ?? `history-${idx}`}
                                className={`flex items-start gap-3 py-3 ${
                                  idx < activityHistory.length - 1 ? "border-b border-[#F1F5F9]" : ""
                                }`}
                              >
                                <BrandedHistoryIcon className="mt-0.5 h-5 w-5 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-(--brand-primary)">
                                    {entry.action ?? "Activity"}
                                  </p>
                                  <p className="text-xs text-[#6B7280]">
                                    {entry.created_at
                                      ? new Date(entry.created_at).toLocaleString()
                                      : "—"}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      ) : commLoading ? (
                        <div className="py-10 text-sm text-[#6B7280]">Loading call logs...</div>
                      ) : commError ? (
                        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          {commError}
                        </div>
                      ) : visibleCallRows.length === 0 ? (
                        <div className="rounded-md border border-dashed border-[#D1D5DB] py-10 text-center text-sm text-[#6B7280]">
                          No call logs for <span className="font-medium text-[#374151]">{candidateName}</span> yet.
                        </div>
                      ) : (
                        <div className="space-y-0">
                          {visibleCallRows.map((row, idx) => {
                            const outcome = callOutcome(row.status);
                            const badge =
                              outcome === "Answered"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800";
                            return (
                              <div
                                key={row.id}
                                className={`grid grid-cols-12 items-center gap-3 py-4 ${
                                  idx < visibleCallRows.length - 1 ? "border-b border-[#F1F5F9]" : ""
                                }`}
                              >
                                <div className="col-span-12 flex items-start gap-3 lg:col-span-5">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand-primary)_10%,white)]">
                                    <BrandedPhoneIcon className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate text-xs text-[#374151]">
                                      {companyName} Called{" "}
                                      <span className="font-semibold text-(--brand-primary)">{candidateName}</span>
                                    </div>
                                    <div className="mt-0.5 text-[11px] text-[#6B7280]">
                                      {relativeTimeLabel(row.created_at)} •{" "}
                                      {new Date(row.created_at).toLocaleDateString("en-US", {
                                        month: "2-digit",
                                        day: "2-digit",
                                        year: "numeric",
                                      })}{" "}
                                      •{" "}
                                      {new Date(row.created_at).toLocaleTimeString("en-US", {
                                        hour: "numeric",
                                        minute: "2-digit",
                                      })}
                                    </div>
                                  </div>
                                </div>

                                <div className="col-span-4 text-[11px] text-[#6B7280] lg:col-span-2">
                                  Duration: —
                                </div>

                                <div className="col-span-4 lg:col-span-2">
                                  <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${badge}`}>
                                    {outcome}
                                  </span>
                                </div>

                                <div className="col-span-4 text-right text-[11px] text-[#6B7280] lg:col-span-3">
                                  {ordinalAttempt(idx + 1)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </main>
                </div>
              )}
            </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

