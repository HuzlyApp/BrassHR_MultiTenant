"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import DetailedCandidateHeader from "../../../components/DetailedCandidateHeader";
import DetailedTabs from "../../../components/DetailedTabs";
import {
  Briefcase,
  Calendar,
  LogOut,
  Menu,
  Phone,
  Plus,
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
};

type ActivityTab = "Calls" | "Inbox" | "Interview";

type CallLog = {
  id: string;
  title: string;
  when: string;
  duration: string;
  outcome: "Answered" | "Did not answered";
  attempt: string;
};

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

  /** No `call_logs` table yet — keep structure ready for a future API. */
  const callLogs: CallLog[] = useMemo(() => [], []);

  const historyCount = useMemo(() => {
    const u = profile?.activity?.updated_at;
    const c = profile?.activity?.created_at;
    if (u && c && u !== c) return 1;
    return 0;
  }, [profile?.activity?.created_at, profile?.activity?.updated_at]);

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
            <div className="mb-5 text-xs text-gray-600">Admin - New Applicant Detailed Page - Activities</div>

            {loadError ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {loadError}
              </div>
            ) : null}

            <DetailedCandidateHeader
              name={candidateName}
              role={candidateRole}
              loading={loading}
            />
            <DetailedTabs applicantId={applicantId} activeTab="Activities" />

            <div className="mx-auto mb-3 flex w-full max-w-[1300px] items-center justify-center gap-2">
              {(["Calls", "Inbox", "Interview"] as const).map((t) => {
                const isActive = active === t;
                return (
                  <button
                    key={t}
                    onClick={() => setActive(t)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                      isActive
                        ? "border-[#0D9488] bg-[#0D9488] text-white"
                        : "border-zinc-200 bg-transparent text-[#4B5563] hover:bg-zinc-50"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>

            <div className="mx-auto w-full max-w-[1300px] rounded-md border border-[#D1D5DB] p-4">
              <div className="grid grid-cols-12 gap-4">
                {/* Left mini-nav */}
                <aside className="col-span-3">
                  <div className="h-full border-r border-[#E5E7EB] pr-4">
                    <div className="space-y-2">
                      {(
                        [
                          { key: "Recent Logs" as const, count: callLogs.length },
                          { key: "History" as const, count: historyCount },
                        ] as const
                      ).map(({ key: k, count }) => {
                        const isActive = leftNav === k;
                        return (
                          <button
                            key={k}
                            onClick={() => setLeftNav(k)}
                            className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-md border text-xs transition ${
                              isActive
                                ? "border-[#99D8D3] bg-[#F8FAFC] text-[#374151]"
                                : "border-transparent text-[#6B7280] hover:bg-[#F8FAFC]"
                            }`}
                          >
                            <span className="inline-flex items-center gap-2">
                              <img
                                src={k === "Recent Logs" ? "/icons/admin-recruiter/phone.svg" : "/icons/admin-recruiter/history-icon.svg"}
                                alt=""
                                className="h-3.5 w-3.5"
                              />
                              {k}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-[#6B7280] font-medium">
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </aside>

                {/* Main */}
                <main className="col-span-9">
                  <div className="flex items-center justify-between mb-4">
                    <div />

                    <div className="flex items-center gap-2">
                      <button className="text-xs px-4 py-2 rounded-lg border border-[#99D8D3] bg-white text-[#0D9488] hover:bg-[#F8FAFC] transition">
                        + Add a call log
                      </button>
                      <button className="text-xs px-4 py-2 rounded-lg border border-zinc-200 bg-zinc-100 text-[#9CA3AF] transition flex items-center gap-2">
                        <img src="/icons/admin-recruiter/phone.svg" alt="" className="h-4 w-4 opacity-60" />
                        Call
                      </button>
                    </div>
                  </div>

                  {active !== "Calls" ? (
                    <div className="rounded-md border border-[#D1D5DB] p-6 text-sm text-[#6B7280]">
                      {active} for {candidateName} — connect an inbox or interview data source to show items
                      here.
                    </div>
                  ) : leftNav === "History" ? (
                    <div className="rounded-md border border-[#D1D5DB] p-6 text-sm text-[#6B7280]">
                      {historyCount > 0 ? (
                        <p>
                          Last profile update tracked from onboarding activity. Full history export can be
                          wired when activity events are stored per worker.
                        </p>
                      ) : (
                        <p>No history entries yet.</p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-md border border-[#D1D5DB] p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="inline-flex items-center gap-2 text-[20px] font-semibold leading-7 text-[#1F2937]">
                          <img src="/icons/admin-recruiter/phone.svg" alt="" className="h-5 w-5" />
                          Call History
                        </div>
                        <div className="text-xs text-[#6B7280]">
                          Actions taken{" "}
                          <span className="font-semibold text-[#111827]">{callLogs.length}</span>
                        </div>
                      </div>

                      {callLogs.length === 0 ? (
                        <div className="text-sm text-[#6B7280] py-10 text-center border border-dashed border-[#D1D5DB] rounded-md">
                          No call logs recorded for{" "}
                          <span className="font-medium text-[#374151]">{candidateName}</span> yet. Call logs
                          can be stored in a future call-log table and loaded here.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {callLogs.map((c) => {
                            const badge =
                              c.outcome === "Answered"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800";
                            return (
                              <div
                                key={c.id}
                                className="grid grid-cols-12 gap-4 items-center py-3 border-b border-zinc-100 last:border-b-0"
                              >
                                <div className="col-span-6 flex items-start gap-3">
                                  <div className="w-9 h-9 rounded-full bg-teal-600/10 flex items-center justify-center shrink-0">
                                    <img src="/icons/admin-recruiter/phone.svg" alt="" className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-medium text-gray-600 truncate">
                                      {c.title}
                                    </div>
                                    <div className="text-[11px] text-gray-600">{c.when}</div>
                                  </div>
                                </div>

                                <div className="col-span-2 text-[11px] text-gray-600">
                                  Duration: {c.duration}
                                </div>

                                <div className="col-span-2">
                                  <span
                                    className={`text-[11px] px-3 py-1 rounded-full font-medium ${badge}`}
                                  >
                                    {c.outcome}
                                  </span>
                                </div>

                                <div className="col-span-2 text-[11px] text-gray-600">{c.attempt}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </main>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

