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
  Plus,
  Settings,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from "lucide-react";

type OnboardingStep = {
  id: string;
  label: string;
  state: "complete" | "in_progress" | "pending";
  detail?: string;
};

type ProfilePayload = {
  worker: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    address1: string | null;
    address2: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    job_role: string | null;
    created_at: string | null;
    updated_at: string | null;
    status: string;
    status_label: string;
    date_of_birth: string | null;
    years_experience: number | null;
    hourly_rate: string | null;
    ssn_last_four: string | null;
  };
  documents: {
    updated_at: string | null;
    nursing_license_url: boolean;
    tb_test_url: boolean;
    cpr_certification_url: boolean;
    identity_uploaded: boolean;
  } | null;
  references: Array<{ id: string; name: string; phone: string | null; email: string | null }>;
  skillAssessments: { completed: number; total: number; rows?: Array<Record<string, unknown>> };
  onboardingSteps: OnboardingStep[];
  activity: { source: string; created_at: string | null; updated_at: string | null };
  activity_logs?: Array<{
    id: string | null;
    action: string | null;
    entity_type: string | null;
    entity_id: string | null;
    details: Record<string, unknown> | null;
    created_at: string | null;
  }>;
  activity_history?: Array<{
    id: string | null;
    action: string | null;
    entity_type: string | null;
    entity_id: string | null;
    details: Record<string, unknown> | null;
    created_at: string | null;
  }>;
  requirements: {
    resume_path: string | null;
    resume_url: string | null;
  } | null;
  nursing_licenses?: Array<{
    license_url: string | null;
    state: string | null;
    license_type: string | null;
    expires_at: string | null;
  }>;
  education?: {
    source: string;
    resume_available: boolean;
    items: Array<Record<string, unknown>>;
  };
  experience?: {
    years: number | null;
    job_role: string | null;
    positions: string[];
    role_assignments: Array<{ role: string | null; job_category_name: string | null }>;
  };
  skills?: {
    positions: string[];
    role_assignments: Array<{ role: string | null; job_category_name: string | null }>;
    assessed_categories: Array<{ category_title: string | null; completed: boolean }>;
  };
  facilities_assigned?: Array<{
    assignment_id: string | null;
    assigned_at: string | null;
    status: string | null;
    shift_title: string | null;
    facility_name: string | null;
    facility_address: string | null;
  }>;
  notes?: Array<Record<string, unknown>>;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatRelative(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function formatDateTimeLabel(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const datePart = d.toLocaleDateString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
  const timePart = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${datePart} - ${timePart}`;
}

function stepDotClass(state: OnboardingStep["state"]) {
  if (state === "complete") return "bg-teal-600";
  if (state === "in_progress") return "bg-amber-500";
  return "bg-zinc-300";
}

function isMissingValue(value: unknown) {
  if (value == null) return true;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length === 0 || trimmed === "—";
  }
  return false;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export default function NewApplicantProfilePage() {
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const applicantId = params?.id;

  const isWorkerRoute = pathname?.startsWith("/admin_recruiter/workers/") ?? false;
  const base = "/admin_recruiter/new";

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProfilePayload | null>(null);

  useEffect(() => {
    async function run() {
      if (!applicantId) return;
      if (!isUuid(applicantId)) {
        setError("Invalid workerId");
        setData(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/worker-profile?workerId=${encodeURIComponent(applicantId)}`
        );
        const json = (await res.json()) as ProfilePayload & { error?: string };
        if (!res.ok && json?.error === "Invalid workerId") {
          setError("Invalid workerId");
          setData(null);
          return;
        }
        if (!res.ok) throw new Error(json.error || "Failed to load profile");
        setData(json);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load";
        if (message !== "Invalid workerId") {
          console.error(e);
        }
        setError(message);
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [applicantId]);

  const w = data?.worker;
  const candidateName = useMemo(() => {
    const n = `${w?.first_name ?? ""} ${w?.last_name ?? ""}`.trim();
    return n || "Applicant";
  }, [w?.first_name, w?.last_name]);

  const candidateRole = w?.job_role || "N/A";
  const candidateLocation = useMemo(() => {
    const parts = [w?.city ?? "", w?.state ?? "", w?.zip ?? ""].filter(Boolean);
    return parts.length ? parts.join(", ") : "—";
  }, [w?.city, w?.state, w?.zip]);

  const id = applicantId ?? "";
  const nursingLicenseRows = useMemo(() => {
    const fromApi = (data?.nursing_licenses ?? []).map((license, idx) => ({
      tag: `L${idx + 1}`,
      registration: license.license_type ?? "—",
      state: license.state ?? "—",
      expiry: formatDate(license.expires_at),
    }));
    if (fromApi.length > 0) return fromApi;
    return [
      {
        tag: "L1",
        registration: "—",
        state: w?.state ?? "—",
        expiry: "—",
      },
    ];
  }, [data?.nursing_licenses, w?.state]);

  const onboardingCompleted = useMemo(
    () => (data?.onboardingSteps ?? []).length > 0 && (data?.onboardingSteps ?? []).every((s) => s.state === "complete"),
    [data?.onboardingSteps]
  );

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

      <div className="flex-1 flex flex-col overflow-hidden lg:pl-72">
        <header className="h-16 border-b bg-white flex items-center px-6 justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen((v) => !v)} className="lg:hidden text-gray-600">
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="font-semibold text-2xl">{isWorkerRoute ? "Worker" : "New Applicant"}</div>
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

        <div className="flex-1 overflow-auto px-4 py-3 lg:px-5 lg:py-4">
          <div className="w-full">
            <div className="mb-2 text-xs text-gray-600">
              Admin - {isWorkerRoute ? "Worker" : "New Applicant"} Detailed Page - Details
            </div>

            {error ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <DetailedCandidateHeader
              name={candidateName}
              role={candidateRole}
              loading={loading}
            />
            <DetailedTabs applicantId={applicantId} activeTab="Profile" />
            <div className="mb-1 flex justify-center">
              <div className="h-9 w-[327px] rounded-xl bg-[#F8FAFC] p-1">
                <div className="grid h-full grid-cols-3 gap-1">
                  <Link
                    href={`${base}/profile/${id}`}
                    className="inline-flex items-center justify-center rounded-lg bg-[#0D9488] text-sm font-medium leading-5 text-white"
                  >
                    Details
                  </Link>
                  <Link
                    href={`${base}/profile/resume/${id}`}
                    className="inline-flex items-center justify-center rounded-lg text-sm font-medium leading-5 text-[#374151] hover:bg-white"
                  >
                    Resume
                  </Link>
                  <Link
                    href={`${base}/profile/notes/${id}`}
                    className="inline-flex items-center justify-center rounded-lg text-sm font-medium leading-5 text-[#374151] hover:bg-white"
                  >
                    Notes
                  </Link>
                </div>
              </div>
            </div>

            <div className="mx-auto w-full max-w-[1298px] overflow-x-auto rounded-lg border border-[#D1D5DB] bg-white">
              <div className="hidden p-6 items-start justify-between gap-6 border-b border-[#9CC3FF]/30 bg-white/40">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-teal-600 text-white flex items-center justify-center font-semibold text-sm">
                    {initials(candidateName)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="text-lg font-semibold text-gray-600">
                        {loading ? "Loading..." : candidateName}
                      </div>
                      <span className="text-[11px] px-3 py-1 rounded-full bg-white/70 border border-zinc-200 text-gray-600 font-medium">
                        {w?.status_label ?? "—"}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600">{candidateRole}</div>
                    <div className="text-xs text-gray-600">{candidateLocation}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="bg-white/70 border border-[#9CC3FF] text-gray-600 px-5 py-2.5 rounded-2xl hover:bg-white transition text-sm"
                  >
                    <Plus className="inline-block w-4 h-4 mr-2" />
                    New Appointment
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-stretch">
                <section className="space-y-4">
                  <div className="overflow-hidden bg-white">
                    <div className="flex h-11 items-center gap-2 border-b border-[#E5E7EB] px-5">
                      <h2 className="text-[20px] font-semibold leading-7 text-[#111827]">Candidate Details</h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2">
                      {(
                        [
                          ["First Name", w?.first_name ?? "—"],
                          ["Last Name", w?.last_name ?? "—"],
                          ["Date of Birth(MM/DD/YYYY)", w?.date_of_birth ? formatDate(w.date_of_birth) : "—"],
                          ["Email Address", w?.email ?? "—"],
                          [
                            "Total Years of Experience in Your Profession",
                            w?.years_experience != null ? `${w.years_experience} yrs` : "—",
                          ],
                          ["Address", w?.address1 ?? "—"],
                          ["City", w?.city ?? "—"],
                          ["Zip Code", w?.zip ?? "—"],
                          ["Phone Number", w?.phone ?? "—"],
                          ["Last Four Digits of SSN", w?.ssn_last_four ?? "—"],
                          ["Work Status", w?.status_label ?? "—"],
                          ["Hourly Rate", w?.hourly_rate ? `$ ${w.hourly_rate} / hr` : "—"],
                          ["Reference 1 (Name, Email, Phone, Relationship)", data?.references?.[0]?.name ?? "—"],
                          [
                            "Reference 1 (Name, Email, Phone, Relationship)",
                            data?.references?.[1]?.name ?? "—",
                          ],
                          [
                            "Reference 2 (Name, Email, Phone, Relationship)",
                            data?.references?.[2]?.name ?? "—",
                          ],
                          [
                            "Primary Practice Setting",
                            data?.facilities_assigned?.[0]?.facility_name ?? candidateLocation,
                          ],
                          [
                            "Primary Allied Health Role",
                            data?.experience?.role_assignments?.[0]?.role ??
                              data?.skills?.positions?.[0] ??
                              "—",
                          ],
                          [
                            "Professional License / Certification Type",
                            data?.nursing_licenses?.[0]?.license_type ?? "—",
                          ],
                          ["License Expiration Date", formatDate(data?.nursing_licenses?.[0]?.expires_at)],
                          ["Which State are you applying for?", data?.nursing_licenses?.[0]?.state ?? w?.state ?? "—"],
                          [
                            "Resume file",
                            data?.requirements?.resume_url ? (
                              <Link
                                key="resume-link"
                                href={`${base}/profile/resume/${id}`}
                                className="text-[#0D9488] hover:underline"
                              >
                                View / download
                              </Link>
                            ) : (
                              "—"
                            ),
                          ],
                        ] as const
                      ).map(([k, v], idx) => {
                        const showAsAdd = typeof v === "string" && isMissingValue(v) && k !== "Work Status";
                        const isEmail = k === "Email Address" && !isMissingValue(v);
                        return (
                          <div key={`${k}-${idx}`} className="contents">
                            <div className="border-b border-r border-[#E5E7EB] px-5 py-3 text-[14px] font-normal leading-5 text-[#374151]">
                              {k}
                            </div>
                            <div className="border-b border-[#E5E7EB] px-5 py-3 text-[14px] font-normal leading-5 break-all text-[#111827]">
                              {showAsAdd ? (
                                <span className="text-[#0D9488]">+ Add</span>
                              ) : (
                                <span className={isEmail ? "text-[#0D9488]" : ""}>{v}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white">
                    <div className="flex h-11 items-center justify-between gap-2 border-b border-[#E5E7EB] px-5">
                      <div className="text-[20px] font-semibold leading-7 text-[#111827]">Nursing Licenses</div>
                    </div>
                    <div className="flex flex-col px-4 py-3">
                      <div className="overflow-hidden rounded-md border border-[#E5E7EB]">
                        {nursingLicenseRows.map((row, rowIdx) => (
                          <div
                            key={row.tag}
                            className={`grid grid-cols-[55px_minmax(0,1fr)] ${rowIdx > 0 ? "border-t border-[#E5E7EB]" : ""}`}
                          >
                            <div className="flex h-[134px] items-center justify-center border-r border-[#E5E7EB] px-5 text-[12px] font-normal leading-4 text-[#6B7280]">
                              {row.tag}
                            </div>
                            <div className="h-[134px]">
                              {(
                                [
                                  ["State Nursing License Registration #", row.registration],
                                  ["State Nursing License", row.state],
                                  ["License Expiry Date", row.expiry],
                                ] as const
                              ).map(([label, value], idx) => (
                                <div
                                  key={`${row.tag}-${label}`}
                                  className={`grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] ${idx > 0 ? "border-t border-[#E5E7EB]" : ""}`}
                                >
                                  <div className="h-11 border-r border-[#E5E7EB] px-3 py-3 text-[14px] font-normal leading-5 text-[#374151]">
                                    {label}
                                  </div>
                                  <div className="h-11 px-3 py-3 text-[14px] font-normal leading-5 text-[#111827]">
                                    {label === "State Nursing License" && value !== "—" ? (
                                      <span className="text-[#111827]">
                                        <span className="mr-1 text-[#0D9488]">⌄</span>
                                        {value}
                                      </span>
                                    ) : (
                                      value
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex items-center justify-center border-t border-[#E5E7EB] py-4">
                        <button
                          type="button"
                          className="inline-flex h-9 min-w-[175px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#0D9488] px-4 py-2 text-sm font-semibold text-[#0D9488]"
                        >
                          <span className="text-base leading-none">+</span>
                          Add Nursing License
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white">
                    <div className="flex h-11 items-center gap-2 border-b border-[#E5E7EB] px-5">
                      <div className="text-[20px] font-semibold leading-7 text-[#111827]">Activity Logs</div>
                    </div>
                    <div className="p-5">
                    <div className="overflow-hidden rounded-md border border-[#E5E7EB] text-xs">
                      {(
                        [
                          ["Source", data?.activity.source ?? "—"],
                          ["Created date", formatDateTimeLabel(data?.activity.created_at)],
                          ["Date resume added", formatDateTimeLabel(data?.requirements?.resume_path ? data?.activity.created_at : null)],
                          ["Created by", data?.activity_logs?.[0]?.details?.user_agent ? "API Session" : "N/A"],
                          ["Last updated", formatRelative(data?.activity.updated_at)],
                        ] as const
                      ).map(([k, v], idx) => (
                        <div
                          key={k}
                          className={`grid grid-cols-2 ${idx > 0 ? "border-t border-[#E5E7EB]" : ""}`}
                        >
                          <div className="border-r border-[#E5E7EB] px-4 py-3 text-[14px] leading-5 text-[#374151]">
                            {k}
                          </div>
                          <div className="px-4 py-3 text-[14px] leading-5 text-[#111827]">{v}</div>
                        </div>
                      ))}
                    </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white">
                    <div className="flex h-11 items-center gap-2 border-b border-[#E5E7EB] px-5">
                      <div className="text-[20px] font-semibold leading-7 text-[#111827]">Activity History</div>
                    </div>
                    <div className="p-5">
                    <div>
                      {(data?.activity_history ?? []).length === 0 ? (
                        <div className="py-3 text-xs text-[#6B7280]">No activity history found.</div>
                      ) : (
                        (data?.activity_history ?? []).slice(0, 6).map((entry, idx) => (
                          <div
                            key={entry.id ?? `history-${idx}`}
                            className={`flex items-start gap-3 py-3 ${idx < (data?.activity_history ?? []).slice(0, 6).length - 1 ? "border-b border-[#E5E7EB]" : ""}`}
                          >
                            <img
                              src="/icons/admin-recruiter/history-icon.svg"
                              alt=""
                              className="mt-0.5 h-6 w-6 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium leading-5 text-[#0D9488]">
                                {entry.action ?? "Activity"}
                              </div>
                              <div className="text-xs leading-4 text-[#6B7280]">
                                {formatRelative(entry.created_at)} - {formatDateTimeLabel(entry.created_at)}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    </div>
                  </div>
                </section>

                <section className="h-full w-full min-w-0 space-y-0 border-l border-r border-[#D1D5DB]">
                  <div className="h-[160px] w-full bg-white pr-px">
                      <div className="flex h-11 items-center justify-between gap-2 border-b border-[#E5E7EB] px-5">
                        <div className="text-[20px] font-semibold leading-7 text-[#111827]">Education</div>
                        <img
                          src="/icons/admin-recruiter/plus-icon.svg"
                          alt=""
                          className="h-6 w-6 cursor-pointer"
                        />
                      </div>
                      <div className="px-5 pt-4">
                      <div className="text-xs text-gray-600">
                        Source: {data?.education?.source ?? "none"}
                      </div>
                      <div className="mt-2 text-xs text-gray-600">
                        {data?.education?.resume_available
                          ? "Resume available for education verification."
                          : "N/A"}
                      </div>
                      </div>
                  </div>

                    <div className="h-[288px] w-full border-t border-[#E5E7EB] bg-white pr-px">
                      <div className="flex h-11 items-center justify-between gap-2 border-b border-[#E5E7EB] px-5">
                        <div className="text-[20px] font-semibold leading-7 text-[#111827]">Experience</div>
                        <img
                          src="/icons/admin-recruiter/plus-icon.svg"
                          alt=""
                          className="h-6 w-6 cursor-pointer"
                        />
                      </div>
                      <div className="px-5 pt-4">
                      <div className="text-xs text-gray-600">Job role</div>
                      <div className="mt-2 text-xs text-gray-600">{data?.experience?.job_role ?? candidateRole}</div>
                      <div className="mt-2 text-xs text-gray-600">
                        Years: {data?.experience?.years != null ? data.experience.years : "N/A"}
                      </div>
                      <div className="mt-2 text-xs text-gray-600">
                        Roles:{" "}
                        {data?.experience?.role_assignments?.length
                          ? data.experience.role_assignments
                              .map((x) => x.role || x.job_category_name)
                              .filter(Boolean)
                              .join(", ")
                          : "N/A"}
                      </div>
                      </div>
                    </div>

                    <div className="h-[200px] min-h-[200px] w-full border-t border-[#E5E7EB] bg-white pr-px">
                      <div className="flex h-11 items-center justify-between gap-2 border-b border-[#E5E7EB] px-5">
                        <div className="text-[20px] font-semibold leading-7 text-[#111827]">Skills</div>
                        <img
                          src="/icons/admin-recruiter/plus-icon.svg"
                          alt=""
                          className="h-6 w-6 cursor-pointer"
                        />
                      </div>
                      <div className="px-5 pt-4">
                      <div className="text-xs text-gray-600">
                        Positions: {data?.skills?.positions?.length ? data.skills.positions.join(", ") : "N/A"}
                      </div>
                      <div className="mt-2 text-xs text-gray-600">
                        Assessed categories:{" "}
                        {data?.skills?.assessed_categories?.length
                          ? data.skills.assessed_categories
                              .map((x) => x.category_title || "Category")
                              .join(", ")
                          : "N/A"}
                      </div>
                      </div>
                    </div>

                    <div className="h-[200px] min-h-[200px] w-full border-t border-b border-[#E5E7EB] bg-white pr-px">
                      <div className="flex h-11 items-center justify-between gap-2 border-b border-[#E5E7EB] px-5">
                        <div className="text-[20px] font-semibold leading-7 text-[#111827]">Facilities Assigned</div>
                        <img
                          src="/icons/admin-recruiter/plus-icon.svg"
                          alt=""
                          className="h-6 w-6 cursor-pointer"
                        />
                      </div>
                      <div className="flex items-start justify-between px-5 pt-4">
                        <div className="text-xs text-gray-600">
                          {data?.facilities_assigned?.length
                            ? data.facilities_assigned
                                .map((f) => f.facility_name || f.shift_title || "Assignment")
                                .join(", ")
                            : "No facility assignments found"}
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-9 w-[78px] items-center justify-center gap-1.5 rounded-lg bg-[#0D9488] px-4 py-2 text-sm font-semibold text-white"
                        >
                          + Add
                        </button>
                      </div>
                    </div>

                    <div className="h-[422px] min-h-[200px] w-full border-t border-r border-[#D1D5DB] bg-white pr-px">
                      <div className="flex h-11 flex-nowrap items-center justify-between gap-2 border-b border-[#E5E7EB] px-5">
                        <div className="min-w-0 truncate whitespace-nowrap text-[18px] font-semibold leading-6 text-[#111827]">
                          Onboarding Progress
                        </div>
                        <span className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1 text-[11px] font-medium text-white ${onboardingCompleted ? "bg-[#00B135]" : "bg-[#F59E0B]"}`}>
                          {onboardingCompleted ? "Completed" : "In Progress"}
                        </span>
                      </div>

                      <div className="p-5">
                      <div className="relative space-y-0 text-xs text-gray-600">
                        <div className="absolute left-4 top-8 bottom-8 w-[2px] -translate-x-1/2 bg-[#14B8A6]" />
                        {(data?.onboardingSteps ?? []).map((s, idx) => (
                          <div key={s.id} className="flex min-h-[66px] items-center gap-4">
                            <div className="relative flex h-[66px] w-8 shrink-0 items-center justify-center">
                              {s.state === "complete" ? (
                                <img
                                  src="/icons/admin-recruiter/Stepper indicator.svg"
                                  alt=""
                                  className="relative z-10 h-8 w-8"
                                />
                              ) : (
                                <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[#14B8A6] bg-white text-[14px] font-medium leading-none text-[#14B8A6]">
                                  {idx + 1}
                                </div>
                              )}
                            </div>
                            <div className="flex h-[66px] w-[290px] min-w-0 flex-col justify-center gap-1">
                              <div className="text-[14px] font-semibold leading-5 text-[#111827]">{s.label}</div>
                              {s.detail ? (
                                <div className="text-[12px] leading-5 text-[#6B7280]">{s.detail}</div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                        {loading ? (
                          <div className="text-gray-600">Loading progress…</div>
                        ) : null}
                      </div>
                      </div>
                    </div>

                    <div className="w-full border-t border-[#E5E7EB] bg-white pr-px">
                      <div className="flex h-11 items-center gap-2 border-b border-[#E5E7EB] px-5">
                        <div className="text-[20px] font-semibold leading-7 text-[#111827]">Skill assessments</div>
                      </div>
                      <div className="p-5">
                      <div className="text-xs text-gray-600">
                        Completed {data?.skillAssessments.completed ?? 0} of {data?.skillAssessments.total ?? 0}{" "}
                        tracked quizzes.
                      </div>
                      </div>
                    </div>

                  <div className="w-full border-t border-[#E5E7EB] bg-white pr-px">
                    <div className="flex h-11 items-center gap-2 border-b border-[#E5E7EB] px-5">
                      <div className="text-[20px] font-semibold leading-7 text-[#111827]">Remarks</div>
                    </div>
                    <div className="p-5">
                    <div className="mb-4 text-xs text-[#6B7280]">For job recommendation</div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex h-9 items-center justify-center rounded-lg bg-[#0D9488] px-4 text-xs font-semibold text-white"
                      >
                        Approved for work
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-[#99D8D3] bg-white px-4 text-xs font-semibold text-[#0D9488]"
                      >
                        Reactivate
                      </button>
                      <Link
                        href="/admin_recruiter/new"
                        className="inline-flex h-9 items-center justify-center rounded-lg bg-[#0D9488] px-4 text-xs font-semibold text-white hover:bg-teal-700 transition"
                      >
                        Back to New list
                      </Link>
                    </div>
                    </div>
                  </div>

                  <div className="w-full border-t border-[#E5E7EB] bg-white pr-px">
                    <div className="flex h-11 items-center justify-between gap-2 border-b border-[#E5E7EB] px-5">
                      <div className="text-[20px] font-semibold leading-7 text-[#111827]">Notes</div>
                    </div>
                    <div className="p-5">
                      <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-[#9CA3AF]">
                        {data?.notes?.length ? `${data.notes.length} notes found` : "No notes records found"}
                      </div>
                      <Link
                        href={`${base}/profile/notes/${id}`}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#0D9488] px-4 text-xs font-semibold text-white"
                      >
                        + Add
                      </Link>
                    </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
