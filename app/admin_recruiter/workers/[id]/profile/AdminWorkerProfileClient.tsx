"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HireJourneyClient from "@/app/admin_recruiter/candidates/[workerId]/hire-journey/HireJourneyClient";
import {
  CalendarDays,
  ChevronLeft,
  Clock,
  Download,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Wallet,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import AddWorkerSkillModal from "@/app/admin_recruiter/components/AddWorkerSkillModal";
import CandidateCommunicationDialog from "@/app/admin_recruiter/components/CandidateCommunicationDialog";
import { formatPhoneForDisplay } from "@/lib/admin/worker-profile-field-client";
import { exportRowsAsCsv } from "@/lib/admin/export-list-download";
import {
  fetchStaffDetailJson,
  workerProfileApiUrl,
} from "@/lib/admin/staff-detail-fetch-cache";
import { formatDecimalHours } from "@/app/application/components/applicant-portal/worker-dashboard-utils";
import type { WorkerAccountOverviewPayload } from "@/app/application/components/applicant-portal/worker-account-types";
import {
  isWorkerFigmaProfileTabId,
  WORKER_FIGMA_PROFILE_TABS,
  workerFigmaProfileTabHref,
  workerProfileHasSkillAssessmentStep,
  type WorkerFigmaProfileTabId,
} from "../../worker-profile-tabs";
import { WorkerProfileFilesPanel } from "./WorkerProfileFilesPanel";
import { WorkerProfileSkillAssessmentPanel } from "./WorkerProfileSkillAssessmentPanel";

type WorkerProfilePayload = {
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
    status: string;
    status_label: string;
    profile_photo_url?: string | null;
    employee_id?: string | null;
    employee_number?: string | null;
    employment_type?: string | null;
    reports_to?: string | null;
    converted_worker_type?: string | null;
    converted_at?: string | null;
    hourly_rate?: string | null;
    years_experience?: number | null;
    about_me?: string | null;
    created_at?: string | null;
  };
  profile_skills?: Array<{ id: string; skill_name: string; created_at: string | null }>;
  nursing_licenses?: Array<{
    id?: string | null;
    license_type: string | null;
    expires_at: string | null;
  }>;
  license_records?: Array<{
    id: string;
    license_type: string;
    license_type_label: string;
    expires_at: string | null;
  }>;
  facilities_assigned?: Array<{
    assignment_id: string | null;
    assigned_at: string | null;
    status: string | null;
    shift_title: string | null;
    facility_name: string | null;
    facility_address: string | null;
  }>;
  skillAssessments?: {
    completed: number;
    total: number;
    rows?: Array<Record<string, unknown>>;
  };
  onboardingSteps?: Array<{
    id: string;
    label: string;
    state: string;
    detail?: string;
  }>;
  onboardingCompletion?: {
    completedSteps: number;
    totalSteps: number;
    percent: number;
  };
  onboardingSubmission?: {
    submittedAt: string;
  } | null;
  experience?: {
    years: number | null;
    job_role: string | null;
    positions: string[];
    role_assignments: Array<{ role: string | null; job_category_name: string | null }>;
  };
  activity_logs?: Array<{
    id: string | null;
    action: string | null;
    created_at: string | null;
    details: Record<string, unknown> | null;
  }>;
};

const CARD_CLASS = "overflow-hidden rounded-xl border border-[#E5E7EB] bg-white";
const PAGE_CLASS =
  "box-border w-full min-w-0 max-w-full overflow-x-hidden px-3 pb-10 pt-4 sm:px-5 sm:pt-5 lg:px-8";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

function formatDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...opts,
  });
}

function formatDateShort(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function formatCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatPayRate(hourlyRate: string | null | undefined) {
  if (!hourlyRate?.trim()) return "—";
  const cleaned = hourlyRate.replace(/[^0-9.]/g, "");
  if (!cleaned) return "—";
  return `$${cleaned} · Hourly`;
}

function fullAddress(worker: WorkerProfilePayload["worker"]) {
  const line1 = [worker.address1, worker.address2].filter(Boolean).join(" ").trim();
  const cityState = [worker.city, worker.state].filter(Boolean).join(", ");
  const zip = worker.zip?.trim() ?? "";
  return [line1, cityState, zip].filter(Boolean).join(" ") || "—";
}

function SummaryStat({
  label,
  value,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white p-3.5">
      <div
        className="flex size-14 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-[#6B7280]">{label}</p>
        <p className="mt-0.5 truncate text-xl font-semibold text-[#111827]">{value}</p>
      </div>
    </div>
  );
}

function WorkplaceRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(140px,180px)_1fr] gap-3 border-b border-[#F3F4F6] py-3 last:border-b-0">
      <dt className="text-sm font-medium text-[#6B7280]">{label}</dt>
      <dd className="text-sm font-semibold text-[#111827]">{value}</dd>
    </div>
  );
}

function EditAboutMeModal({
  open,
  initialValue,
  workerId,
  onClose,
  onSaved,
}: {
  open: boolean;
  initialValue: string;
  workerId: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  if (!open) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/worker-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId, field: "about_me", value: value.trim() }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not save About Me");
      toast.success("About Me updated");
      await onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save About Me");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#111827]">Edit About Me</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full bg-black text-white"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4 px-6 py-5">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={6}
            maxLength={1000}
            className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#374151] outline-none focus:border-[color:var(--brand-primary)]"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#9CA3AF]">{value.trim().length}/1000</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#374151]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[color:var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminWorkerProfileClient({ workerId }: { workerId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab")?.trim() ?? "profile";

  const [profile, setProfile] = useState<WorkerProfilePayload | null>(null);
  const [overview, setOverview] = useState<WorkerAccountOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [addSkillOpen, setAddSkillOpen] = useState(false);
  const [editAboutOpen, setEditAboutOpen] = useState(false);

  const load = useCallback(async (bust = false) => {
    const [profileRes, overviewRes] = await Promise.all([
      fetchStaffDetailJson<WorkerProfilePayload & { error?: string }>(
        workerProfileApiUrl(workerId),
        bust ? { bust: true } : undefined
      ),
      fetch(`/api/admin/worker-account-overview?workerId=${encodeURIComponent(workerId)}`, {
        cache: "no-store",
      }).then(async (res) => {
        const payload = (await res.json().catch(() => ({}))) as WorkerAccountOverviewPayload & {
          error?: string;
        };
        return { ok: res.ok, payload };
      }),
    ]);

    if (!profileRes.ok) {
      throw new Error(profileRes.payload.error || "Could not load worker profile.");
    }
    setProfile(profileRes.payload);
    if (overviewRes.ok) setOverview(overviewRes.payload);
    else setOverview(null);
  }, [workerId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        await load();
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load worker profile.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const worker = profile?.worker;
  const displayName = worker
    ? `${worker.first_name ?? ""} ${worker.last_name ?? ""}`.trim() || "Worker"
    : "Worker";
  const role = worker?.job_role?.trim() || overview?.profile.jobRole?.trim() || "—";
  const phone = formatPhoneForDisplay(worker?.phone) || "—";
  const email = worker?.email?.trim() || "—";
  const address = worker ? fullAddress(worker) : "—";
  const employeeId =
    worker?.employee_id?.trim() ||
    worker?.employee_number?.trim() ||
    overview?.profile.employeeId?.trim() ||
    "—";
  const hireDate =
    formatDate(worker?.converted_at) !== "—"
      ? formatDate(worker?.converted_at)
      : overview?.profile.hireDateLabel || formatDate(worker?.created_at);
  const employmentType =
    worker?.employment_type?.trim() ||
    worker?.converted_worker_type?.trim() ||
    overview?.profile.employmentType?.trim() ||
    "—";
  const supervisor =
    worker?.reports_to?.trim() || overview?.profile.supervisorName?.trim() || "—";

  const aboutMe =
    worker?.about_me?.trim() ||
    overview?.aboutMe?.trim() ||
    "No about me description yet.";

  const skills = useMemo(() => {
    const fromProfile = (profile?.profile_skills ?? [])
      .map((s) => s.skill_name.trim())
      .filter(Boolean);
    if (fromProfile.length > 0) return fromProfile;
    return overview?.skills ?? [];
  }, [profile?.profile_skills, overview?.skills]);

  const expiringLicenses = useMemo(() => {
    type LicenseRow = {
      id: string;
      title: string;
      expiresAt: string | null;
      expiresLabel?: string | null;
    };
    const fromRecords: LicenseRow[] = (profile?.license_records ?? []).map((row) => ({
      id: row.id,
      title: row.license_type_label || row.license_type || "License",
      expiresAt: row.expires_at,
    }));
    if (fromRecords.length > 0) return fromRecords;
    const fromNursing: LicenseRow[] = (profile?.nursing_licenses ?? []).map((row, i) => ({
      id: row.id || `license-${i}`,
      title: row.license_type || "License",
      expiresAt: row.expires_at,
    }));
    if (fromNursing.length > 0) return fromNursing;
    return (overview?.certifications ?? []).map((c) => ({
      id: c.id,
      title: c.title || c.licenseType,
      expiresAt: null,
      expiresLabel: c.expiresLabel,
    }));
  }, [profile?.license_records, profile?.nursing_licenses, overview?.certifications]);

  const primaryFacility = profile?.facilities_assigned?.[0] ?? null;
  const workSummary = overview?.workSummary;
  const onboardingLabel = useMemo(() => {
    const submitted = profile?.onboardingSubmission?.submittedAt;
    if (submitted) return `Completed ${formatDate(submitted, { month: "short", day: "numeric" })}`;
    const pct = profile?.onboardingCompletion?.percent;
    if (pct != null) return `${pct}% complete`;
    return "Not started";
  }, [profile?.onboardingSubmission, profile?.onboardingCompletion]);

  const showSkillAssessmentTab = useMemo(
    () =>
      workerProfileHasSkillAssessmentStep({
        skillAssessmentTotal: profile?.skillAssessments?.total,
        onboardingSteps: profile?.onboardingSteps,
      }),
    [profile?.skillAssessments?.total, profile?.onboardingSteps]
  );

  const visibleTabs = useMemo(
    () =>
      WORKER_FIGMA_PROFILE_TABS.filter(
        (tab) => tab.id !== "skill_assessment" || showSkillAssessmentTab
      ),
    [showSkillAssessmentTab]
  );

  const activeTab: WorkerFigmaProfileTabId = useMemo(() => {
    if (!isWorkerFigmaProfileTabId(tabParam)) return "profile";
    if (tabParam === "skill_assessment" && !showSkillAssessmentTab) return "profile";
    return tabParam;
  }, [tabParam, showSkillAssessmentTab]);

  useEffect(() => {
    if (tabParam === "skill_assessment" && profile && !showSkillAssessmentTab) {
      router.replace(`/admin_recruiter/workers/${encodeURIComponent(workerId)}/profile`);
    }
  }, [tabParam, profile, showSkillAssessmentTab, router, workerId]);

  function handleDownloadProfile() {
    if (!worker) return;
    const row = {
      name: displayName,
      role,
      email,
      phone,
      address,
      employeeId,
      hireDate,
      employmentType,
      supervisor,
      payRate: formatPayRate(worker.hourly_rate),
      totalShifts: workSummary?.totalShifts ?? 0,
      hoursWorked: workSummary?.hoursWorked ?? 0,
      earningsYtd: workSummary?.earnings ?? "",
    };
    exportRowsAsCsv(
      [row],
      [
        { header: "Name", value: (r) => r.name },
        { header: "Role", value: (r) => r.role },
        { header: "Email", value: (r) => r.email },
        { header: "Phone", value: (r) => r.phone },
        { header: "Address", value: (r) => r.address },
        { header: "Employee ID", value: (r) => r.employeeId },
        { header: "Hire Date", value: (r) => r.hireDate },
        { header: "Employment Type", value: (r) => r.employmentType },
        { header: "Supervisor", value: (r) => r.supervisor },
        { header: "Pay Rate", value: (r) => r.payRate },
        { header: "Total Shifts", value: (r) => r.totalShifts },
        { header: "Hours Worked", value: (r) => r.hoursWorked },
        { header: "Earnings YTD", value: (r) => r.earningsYtd },
      ],
      `worker-profile-${worker.id}.csv`
    );
    toast.success("Profile downloaded");
  }

  if (loading) {
    return (
      <div className={PAGE_CLASS}>
        <div className="h-40 animate-pulse rounded-xl bg-[#F3F4F6]" />
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="h-80 animate-pulse rounded-xl bg-[#F3F4F6]" />
          <div className="h-80 animate-pulse rounded-xl bg-[#F3F4F6]" />
        </div>
      </div>
    );
  }

  if (error || !worker) {
    return (
      <div className={PAGE_CLASS}>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error || "Worker not found."}
        </div>
        <Link
          href="/admin_recruiter/workers"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#6B7280] hover:text-[color:var(--brand-primary)]"
        >
          <ChevronLeft className="size-4" /> Back to Workers
        </Link>
      </div>
    );
  }

  return (
    <div className={PAGE_CLASS}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push("/admin_recruiter/workers")}
          className="inline-flex items-center gap-1 text-sm font-medium text-[#6B7280] transition hover:text-[color:var(--brand-primary)]"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Back
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadProfile}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-semibold text-[#012352] transition hover:bg-[#F9FAFB]"
          >
            <Download className="size-3.5" aria-hidden />
            Download Profile
          </button>
          <button
            type="button"
            onClick={() => setMessageOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[color:var(--brand-primary)] px-3 text-xs font-semibold text-white transition hover:brightness-95"
          >
            Message
          </button>
        </div>
      </div>

      {/* Profile header card */}
      <section className={`${CARD_CLASS} p-5`}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="relative size-[72px] shrink-0 overflow-hidden rounded-full bg-[#E5E7EB]">
              {worker.profile_photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={worker.profile_photo_url}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <span className="flex size-full items-center justify-center text-lg font-semibold text-[#012352]">
                  {initials(displayName)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-[#012352]">{displayName}</h1>
                <span className="inline-flex rounded-full bg-[rgba(18,170,0,0.12)] px-2.5 py-0.5 text-[11px] font-semibold text-[#12AA00]">
                  Worker
                </span>
              </div>
              <p className="mt-0.5 text-sm text-[#6B7280]">{role}</p>
              <div className="mt-3 flex flex-col gap-1.5 text-sm text-[#374151]">
                <p className="inline-flex items-center gap-2">
                  <Mail className="size-3.5 shrink-0 text-[#9CA3AF]" aria-hidden />
                  <span className="truncate">{email}</span>
                </p>
                <p className="inline-flex items-center gap-2">
                  <Phone className="size-3.5 shrink-0 text-[#9CA3AF]" aria-hidden />
                  <span>{phone}</span>
                </p>
                <p className="inline-flex items-start gap-2">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-[#9CA3AF]" aria-hidden />
                  <span>{address}</span>
                </p>
              </div>
            </div>
          </div>

          <dl className="grid min-w-0 shrink-0 grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[#6B7280]">Employee ID</dt>
              <dd className="text-sm font-semibold text-[#111827]">{employeeId}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#6B7280]">Hire Date</dt>
              <dd className="text-sm font-semibold text-[#111827]">{hireDate}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#6B7280]">Employment Type</dt>
              <dd className="text-sm font-semibold text-[#111827]">{employmentType}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#6B7280]">Email</dt>
              <dd className="truncate text-sm font-semibold text-[#111827]">{email}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-[#6B7280]">Supervisor</dt>
              <dd className="text-sm font-semibold text-[#2563EB]">{supervisor}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Tabs */}
      <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-[#E5E7EB]" aria-label="Worker profile tabs">
        {visibleTabs.map((tab) => {
          const href = workerFigmaProfileTabHref(workerId, tab.id);
          const isActive = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={href}
              className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? "border-[color:var(--brand-primary)] text-[color:var(--brand-primary)]"
                  : "border-transparent text-[#6B7280] hover:text-[#111827]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Profile tab body */}
      {activeTab === "profile" ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="space-y-5">
            <section className={CARD_CLASS}>
              <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
                <h2 className="text-sm font-semibold text-[#111827]">About Me</h2>
                <button
                  type="button"
                  onClick={() => setEditAboutOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline"
                >
                  <Pencil className="size-3.5" aria-hidden />
                  Edit
                </button>
              </div>
              <div className="px-4 py-4">
                <p className="text-sm leading-6 text-[#374151]">{aboutMe}</p>
              </div>
            </section>

            <section className={CARD_CLASS}>
              <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
                <h2 className="text-sm font-semibold text-[#111827]">Skills</h2>
                <button
                  type="button"
                  onClick={() => setAddSkillOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline"
                >
                  <Plus className="size-3.5" aria-hidden />
                  Add
                </button>
              </div>
              <div className="px-4 py-4">
                {skills.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">No skills added yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex rounded-full bg-[#DBEAFE] px-3 py-1 text-xs font-medium text-[#1D4ED8]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className={CARD_CLASS}>
              <div className="border-b border-[#E5E7EB] px-4 py-3">
                <h2 className="text-sm font-semibold text-[#111827]">
                  Expiring License/Certification
                </h2>
              </div>
              <div className="space-y-2 px-4 py-4">
                {expiringLicenses.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">No licenses on file.</p>
                ) : (
                  expiringLicenses.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-[rgba(225,29,72,0.2)] bg-[rgba(225,29,72,0.06)] px-3 py-2.5"
                    >
                      <p className="text-sm font-semibold text-[#111827]">{item.title}</p>
                      <p className="text-xs text-[#E11D48]">
                        {item.expiresLabel
                          ? item.expiresLabel
                          : item.expiresAt
                            ? formatDate(item.expiresAt, { month: "short", year: "numeric" })
                            : "Expiry unknown"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className={CARD_CLASS}>
              <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
                <h2 className="text-sm font-semibold text-[#111827]">Onboarding</h2>
                <Link
                  href={`/admin_recruiter/new/attachments/${encodeURIComponent(workerId)}`}
                  className="text-xs font-semibold text-[#2563EB] hover:underline"
                >
                  View Packet
                </Link>
              </div>
              <div className="px-4 py-4">
                <p className="text-sm font-medium text-[#374151]">{onboardingLabel}</p>
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section className={CARD_CLASS}>
              <div className="border-b border-[#E5E7EB] px-4 py-3">
                <h2 className="text-sm font-semibold text-[#111827]">Summary</h2>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-3">
                <SummaryStat
                  label="Total Shifts"
                  value={String(workSummary?.totalShifts ?? 0)}
                  icon={<CalendarDays className="size-7" strokeWidth={1.5} aria-hidden />}
                  iconBg="#DBEAFE"
                  iconColor="#2563EB"
                />
                <SummaryStat
                  label="Hours Worked"
                  value={formatDecimalHours(workSummary?.hoursWorked ?? 0)}
                  icon={<Clock className="size-7" strokeWidth={1.5} aria-hidden />}
                  iconBg="#D6FFE6"
                  iconColor="#00B546"
                />
                <SummaryStat
                  label="Earnings (YTD)"
                  value={formatCurrency(workSummary?.earnings)}
                  icon={<Wallet className="size-7" strokeWidth={1.5} aria-hidden />}
                  iconBg="#FFECD6"
                  iconColor="#F97316"
                />
              </div>
            </section>

            <section className={CARD_CLASS}>
              <div className="border-b border-[#E5E7EB] px-4 py-3">
                <h2 className="text-sm font-semibold text-[#111827]">Workplace</h2>
              </div>
              <dl className="px-4 py-1">
                <WorkplaceRow
                  label="Location"
                  value={primaryFacility?.facility_name?.trim() || "—"}
                />
                <WorkplaceRow label="Type" value={employmentType} />
                <WorkplaceRow label="Hire Date" value={hireDate} />
                <WorkplaceRow
                  label="Manager"
                  value={<span className="text-[#2563EB]">{supervisor}</span>}
                />
                <WorkplaceRow
                  label="Assignment Start Date"
                  value={
                    primaryFacility?.assigned_at
                      ? formatDateShort(primaryFacility.assigned_at)
                      : "—"
                  }
                />
                <WorkplaceRow label="Assignment End Date" value="—" />
                <WorkplaceRow label="Bill Rate" value="—" />
                <WorkplaceRow label="Pay rate" value={formatPayRate(worker.hourly_rate)} />
              </dl>
            </section>
          </div>
        </div>
      ) : null}

      {activeTab === "files" ? <WorkerProfileFilesPanel workerId={workerId} /> : null}

      {activeTab === "skill_assessment" && showSkillAssessmentTab ? (
        <WorkerProfileSkillAssessmentPanel workerId={workerId} workerName={displayName} />
      ) : null}

      {activeTab === "hire" ? (
        <Suspense
          fallback={
            <div className="mt-5 rounded-xl border border-[#E5E7EB] bg-white px-5 py-10 text-sm text-[#64748B]">
              Loading hire journey…
            </div>
          }
        >
          <HireJourneyClient workerId={workerId} layout="tab" />
        </Suspense>
      ) : null}

      {activeTab === "work_history" ? (
        <section className={`${CARD_CLASS} mt-5`}>
          <div className="border-b border-[#E5E7EB] px-4 py-3">
            <h2 className="text-sm font-semibold text-[#111827]">Work History</h2>
          </div>
          <div className="px-4 py-4">
            <p className="mb-3 text-sm text-[#6B7280]">
              Experience:{" "}
              {profile?.experience?.years != null
                ? `${profile.experience.years} years`
                : "—"}
              {profile?.experience?.job_role ? ` · ${profile.experience.job_role}` : ""}
            </p>
            {(profile?.experience?.role_assignments?.length ?? 0) === 0 &&
            (profile?.experience?.positions?.length ?? 0) === 0 ? (
              <p className="text-sm text-[#6B7280]">No work history on file.</p>
            ) : (
              <ul className="space-y-2">
                {(profile?.experience?.role_assignments ?? []).map((row, i) => (
                  <li
                    key={`role-${i}`}
                    className="rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#374151]"
                  >
                    <span className="font-semibold text-[#111827]">
                      {row.role || row.job_category_name || "Role"}
                    </span>
                    {row.job_category_name && row.role ? (
                      <span className="text-[#6B7280]"> · {row.job_category_name}</span>
                    ) : null}
                  </li>
                ))}
                {(profile?.experience?.positions ?? []).map((pos) => (
                  <li
                    key={pos}
                    className="rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm font-semibold text-[#111827]"
                  >
                    {pos}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "licenses" ? (
        <section className={`${CARD_CLASS} mt-5`}>
          <div className="border-b border-[#E5E7EB] px-4 py-3">
            <h2 className="text-sm font-semibold text-[#111827]">License/Certifications</h2>
          </div>
          <div className="space-y-2 px-4 py-4">
            {expiringLicenses.length === 0 ? (
              <p className="text-sm text-[#6B7280]">No licenses or certifications on file.</p>
            ) : (
              expiringLicenses.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] px-3 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">{item.title}</p>
                    <p className="text-xs text-[#6B7280]">
                      {item.expiresLabel
                        ? item.expiresLabel
                        : item.expiresAt
                          ? `Expires ${formatDate(item.expiresAt)}`
                          : "Expiry unknown"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      <AddWorkerSkillModal
        open={addSkillOpen}
        workerId={workerId}
        onClose={() => setAddSkillOpen(false)}
        onAdded={async () => {
          await load(true);
        }}
      />

      <EditAboutMeModal
        open={editAboutOpen}
        initialValue={worker.about_me?.trim() || overview?.aboutMe || ""}
        workerId={workerId}
        onClose={() => setEditAboutOpen(false)}
        onSaved={async () => {
          await load(true);
        }}
      />

      <CandidateCommunicationDialog
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
        workerId={workerId}
        candidateName={displayName}
        email={worker.email}
        phone={worker.phone}
      />
    </div>
  );
}
