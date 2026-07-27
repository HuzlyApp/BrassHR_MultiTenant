"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  HelpCircle,
  MapPin,
  MessageSquare,
  MoreVertical,
  Phone,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import AddCallLogModal from "@/app/admin_recruiter/components/AddCallLogModal";
import CandidateCommunicationDialog from "@/app/admin_recruiter/components/CandidateCommunicationDialog";
import { ScheduleInterviewModal } from "@/app/admin_recruiter/calendar/components/ScheduleInterviewModal";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  CANDIDATES_PAGE_TITLE_CLASS,
  CANDIDATES_PAGE_TITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";
import {
  APPLICATION_STATUS_OPTIONS,
  applicationStatusLabel,
  normalizeApplicationStatus,
  type ApplicationPipelineStatus,
} from "@/lib/jobs/application-status";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";

type ApplicationRow = {
  id: string;
  status: string;
  created_at: string;
  submitted_at: string | null;
  updated_at?: string | null;
  job_requisition_id: string;
  worker_id: string | null;
  job_requisitions: Record<string, unknown> | Record<string, unknown>[] | null;
  applicant_profiles: Record<string, unknown> | Record<string, unknown>[] | null;
};

type JobOption = {
  id: string;
  public_title: string | null;
  location: string | null;
  facility: string | null;
  facility_name: string | null;
};

type WorkerProfilePayload = {
  worker: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email?: string | null;
    phone?: string | null;
    city: string | null;
    state: string | null;
    address?: string | null;
    job_role?: string | null;
    profile_photo_url?: string | null;
  };
  requirements: {
    resume_path: string | null;
    resume_url: string | null;
  } | null;
};

function one(value: Record<string, unknown> | Record<string, unknown>[] | null | undefined) {
  if (!value) return {} as Record<string, unknown>;
  return (Array.isArray(value) ? value[0] : value) ?? ({} as Record<string, unknown>);
}

function applicantName(row: ApplicationRow): string {
  const profile = one(row.applicant_profiles);
  return (
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    String(profile.email ?? "Applicant")
  );
}

function applicantEmail(row: ApplicationRow): string {
  return String(one(row.applicant_profiles).email ?? "");
}

function resolveWorkerId(row: ApplicationRow): string | null {
  if (row.worker_id?.trim()) return row.worker_id.trim();
  const fromProfile = String(one(row.applicant_profiles).worker_id ?? "").trim();
  return fromProfile || null;
}

function formatJobLocation(job: JobOption | null, fallback?: Record<string, unknown>): string {
  if (job) {
    return (
      job.location?.trim() ||
      job.facility_name?.trim() ||
      job.facility?.trim() ||
      "—"
    );
  }
  if (!fallback) return "—";
  return (
    String(fallback.location ?? "").trim() ||
    String(fallback.facility_name ?? "").trim() ||
    String(fallback.facility ?? "").trim() ||
    "—"
  );
}

function formatAppliedMeta(iso: string | null | undefined): string {
  if (!iso) return "Applied";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Applied";
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfThatDay = new Date(date);
  startOfThatDay.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startOfToday.getTime() - startOfThatDay.getTime()) / 86400000);
  if (dayDiff === 0) return "Applied today";
  if (dayDiff === 1) return "Applied yesterday";
  return `Applied ${date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`;
}

function formatActivityDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export default function JobCandidateReviewClient() {
  const branding = useTenantBranding();
  const brandStyle = brandingToCssVars(branding) as CSSProperties;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const jobMenuRef = useRef<HTMLDivElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  const jobId = searchParams.get("jobId")?.trim() ?? "";
  const applicationId = searchParams.get("applicationId")?.trim() ?? "";

  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [jobOptions, setJobOptions] = useState<JobOption[]>([]);
  const [jobMenuOpen, setJobMenuOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const [profile, setProfile] = useState<WorkerProfilePayload | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [messageOpen, setMessageOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [interviewSubmitting, setInterviewSubmitting] = useState(false);
  const [interviewError, setInterviewError] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [resumePreviewError, setResumePreviewError] = useState<string | null>(null);

  const selected = useMemo(
    () => rows.find((row) => row.id === applicationId) ?? rows[0] ?? null,
    [rows, applicationId]
  );

  const selectedIndex = useMemo(() => {
    if (!selected) return -1;
    return rows.findIndex((row) => row.id === selected.id);
  }, [rows, selected]);

  const selectedJob = useMemo(
    () => jobOptions.find((option) => option.id === jobId) ?? null,
    [jobOptions, jobId]
  );

  const jobTitle =
    selectedJob?.public_title?.trim() ||
    String(one(selected?.job_requisitions ?? null).public_title ?? "").trim() ||
    (jobId ? "Job" : "Select a job");
  const jobLocation = formatJobLocation(
    selectedJob,
    one(selected?.job_requisitions ?? null)
  );

  const workerId = selected ? resolveWorkerId(selected) : null;
  const profileName = [
    profile?.worker.first_name,
    profile?.worker.last_name,
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const displayName =
    profileName || (selected ? applicantName(selected) : "Candidate");
  const displayEmail =
    profile?.worker.email?.trim() || (selected ? applicantEmail(selected) : "");
  const displayPhone = profile?.worker.phone?.trim() || null;
  const displayLocation = [
    profile?.worker.address,
    profile?.worker.city,
    profile?.worker.state,
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(", ") || jobLocation;

  const resumePath = profile?.requirements?.resume_path?.trim() || null;
  const resumeUrl = profile?.requirements?.resume_url?.trim() || null;
  const hasResume = Boolean(resumePath || resumeUrl);
  const resumePreviewUrl = workerId
    ? `/api/admin/worker-resume-preview?workerId=${encodeURIComponent(workerId)}`
    : null;
  const resumeDownloadUrl = resumeUrl || resumePreviewUrl;

  const currentStatus = selected
    ? normalizeApplicationStatus(selected.status)
    : "new";

  const setApplicationId = useCallback(
    (nextId: string) => {
      if (!jobId || !nextId) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("jobId", jobId);
      params.set("applicationId", nextId);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [jobId, pathname, router, searchParams]
  );

  const selectJob = useCallback(
    (nextJob: JobOption) => {
      setJobMenuOpen(false);
      const params = new URLSearchParams();
      params.set("jobId", nextJob.id);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router]
  );

  useEffect(() => {
    if (!jobMenuOpen && !statusMenuOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (jobMenuOpen && !jobMenuRef.current?.contains(target)) setJobMenuOpen(false);
      if (statusMenuOpen && !statusMenuRef.current?.contains(target)) setStatusMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [jobMenuOpen, statusMenuOpen]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/admin/jobs", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to load jobs");
        setJobOptions((payload.jobs ?? []) as JobOption[]);
      } catch {
        setJobOptions([]);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!jobId) {
        setRows([]);
        setLoading(false);
        setError("");
        return;
      }
      setLoading(true);
      try {
        const response = await fetch(
          `/api/admin/job-applications?jobId=${encodeURIComponent(jobId)}`,
          { cache: "no-store" }
        );
        const payload = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(payload.error || "Failed to load applications");
        const applications = ((payload.applications ?? []) as ApplicationRow[]).filter(
          (row) => row.job_requisition_id === jobId
        );
        setRows(applications);
        setError("");
        if (!applicationId && applications[0]) {
          setApplicationId(applications[0].id);
        } else if (
          applicationId &&
          applications.length > 0 &&
          !applications.some((row) => row.id === applicationId)
        ) {
          setApplicationId(applications[0].id);
        }
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load applications");
        setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps -- only reload list when job changes

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!workerId) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }
      setProfileLoading(true);
      try {
        const response = await fetch(
          `/api/admin/worker-profile?workerId=${encodeURIComponent(workerId)}`,
          { cache: "no-store" }
        );
        const payload = (await response.json()) as WorkerProfilePayload & { error?: string };
        if (cancelled) return;
        if (!response.ok) throw new Error(payload.error || "Failed to load profile");
        setProfile(payload);
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [workerId]);

  useEffect(() => {
    setResumePreviewError(null);
    setZoom(100);
  }, [workerId, resumeUrl]);

  async function updateStatus(nextStatus: ApplicationPipelineStatus) {
    if (!selected) return;
    setStatusBusy(true);
    setStatusMenuOpen(false);
    try {
      const response = await fetch(`/api/admin/job-applications/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to update status");
      setRows((current) =>
        current.map((row) =>
          row.id === selected.id ? { ...row, status: nextStatus } : row
        )
      );
      toast.success(`Status updated to ${applicationStatusLabel(nextStatus)}`);
    } catch (updateError) {
      toast.error(updateError instanceof Error ? updateError.message : "Failed to update status");
    } finally {
      setStatusBusy(false);
    }
  }

  async function saveNote() {
    if (!workerId) {
      toast.error("This applicant is not linked to a worker profile yet.");
      return;
    }
    const body = noteDraft.trim();
    if (!body) {
      toast.error("Please type a note before saving.");
      return;
    }
    setNoteSaving(true);
    try {
      const response = await fetch("/api/admin/worker-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId, body }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to save note");
      setNoteDraft("");
      toast.success("Note saved");
    } catch (noteError) {
      toast.error(noteError instanceof Error ? noteError.message : "Failed to save note");
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleSchedule(payload: {
    workerId: string;
    startsAt: string;
    endsAt: string;
    meetingType: "online";
  }) {
    setInterviewSubmitting(true);
    setInterviewError(null);
    try {
      const response = await fetch("/api/admin/applicant-appointments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Failed to schedule interview");
      setInterviewOpen(false);
      toast.success("Interview scheduled");
    } catch (scheduleError) {
      setInterviewError(
        scheduleError instanceof Error ? scheduleError.message : "Failed to schedule interview"
      );
    } finally {
      setInterviewSubmitting(false);
    }
  }

  function goRelative(delta: number) {
    if (selectedIndex < 0) return;
    const next = rows[selectedIndex + delta];
    if (next) setApplicationId(next.id);
  }

  return (
    <div
      className="box-border flex min-h-0 w-full min-w-0 max-w-full flex-col px-3 pb-8 pt-4 sm:px-5 sm:pt-5 lg:px-8"
      style={brandStyle}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <h1 className={CANDIDATES_PAGE_TITLE_CLASS} style={CANDIDATES_PAGE_TITLE_STYLE}>
          Candidates
        </h1>
        <Link
          href={
            jobId
              ? `/admin_recruiter/applications?jobId=${encodeURIComponent(jobId)}`
              : "/admin_recruiter/applications"
          }
          className="inline-flex h-7 items-center rounded-lg px-2.5 text-xs font-semibold text-white"
          style={{ backgroundColor: branding.primaryHex }}
        >
          All Candidates
        </Link>
      </div>

      <div className="mb-3 flex min-w-0 flex-col gap-1">
        <div className="relative min-w-0" ref={jobMenuRef}>
          <button
            type="button"
            onClick={() => setJobMenuOpen((open) => !open)}
            className="inline-flex min-h-7 max-w-full items-center gap-1.5 text-left transition hover:opacity-80"
            aria-expanded={jobMenuOpen}
          >
            <span
              className="text-lg font-semibold leading-7 break-words"
              style={{ color: branding.primaryHex }}
            >
              {jobTitle}
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition ${jobMenuOpen ? "rotate-180" : ""}`}
              style={{ color: branding.primaryHex }}
            />
          </button>
          {jobMenuOpen ? (
            <div className="absolute left-0 z-40 mt-2 max-h-72 w-[min(100vw-2rem,360px)] overflow-y-auto rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg">
              {jobOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => selectJob(option)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[#F8FAFC]"
                >
                  <span className="inline-flex h-4 w-4 items-center justify-center">
                    {option.id === jobId ? (
                      <Check className="h-4 w-4" style={{ color: branding.primaryHex }} />
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-[#1E293B]">
                      {option.public_title || "Untitled job"}
                    </span>
                    <span className="block truncate text-xs text-[#64748B]">
                      {formatJobLocation(option)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <p className="inline-flex min-w-0 items-center gap-1.5 text-sm text-[#64748B]">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
          <span className="break-words">{jobLocation}</span>
        </p>
      </div>

      {/* Figma: Back + pager row with full-width divider */}
      <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3">
        <Link
          href="/admin_recruiter/jobs"
          className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
          style={{ color: branding.primaryHex }}
        >
          ← Back to jobs
        </Link>
        <div className="inline-flex shrink-0 items-center gap-1 text-sm text-[#64748B]">
          <button
            type="button"
            onClick={() => goRelative(-1)}
            disabled={selectedIndex <= 0}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white disabled:opacity-40"
            aria-label="Previous candidate"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[4.5rem] text-center tabular-nums">
            {rows.length === 0 ? "0 of 0" : `${selectedIndex + 1} of ${rows.length}`}
          </span>
          <button
            type="button"
            onClick={() => goRelative(1)}
            disabled={selectedIndex < 0 || selectedIndex >= rows.length - 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white disabled:opacity-40"
            aria-label="Next candidate"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!jobId ? (
        <p className="mt-4 rounded-xl border border-[#E5E7EB] bg-white px-4 py-12 text-center text-sm text-[#64748B]">
          Select a job to review candidates.
        </p>
      ) : (
        <div className="mt-4 grid min-h-[calc(100vh-260px)] grid-cols-1 gap-4 xl:grid-cols-[240px_minmax(0,1fr)_280px]">
          {/* Left — rounded candidate cards */}
          <aside className="min-h-0">
            <div className="flex max-h-[40vh] flex-col gap-2 overflow-y-auto pr-0.5 xl:max-h-[calc(100vh-260px)]">
              {loading ? (
                <p className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-8 text-center text-sm text-[#64748B]">
                  Loading…
                </p>
              ) : rows.length === 0 ? (
                <p className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-8 text-center text-sm text-[#64748B]">
                  No candidates yet.
                </p>
              ) : (
                rows.map((row) => {
                  const active = selected?.id === row.id;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setApplicationId(row.id)}
                      className={`w-full rounded-xl border px-3.5 py-3 text-left transition ${
                        active
                          ? "shadow-sm"
                          : "border-[#E5E7EB] bg-white hover:border-[#CBD5E1] hover:bg-[#FAFBFC]"
                      }`}
                      style={
                        active
                          ? {
                              borderColor: branding.primaryHex,
                              backgroundColor: `color-mix(in srgb, ${branding.primaryHex} 8%, white)`,
                            }
                          : undefined
                      }
                    >
                      <p
                        className="truncate text-sm font-semibold"
                        style={{ color: branding.secondaryHex || "#012352" }}
                      >
                        {applicantName(row)}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[#64748B]">
                        {applicantEmail(row) || jobLocation}
                      </p>
                      <p className="mt-1.5 text-[11px] leading-4 text-[#94A3B8]">
                        {applicationStatusLabel(row.status)} •{" "}
                        {formatAppliedMeta(row.submitted_at || row.created_at)}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Center — profile + resume */}
          <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
            {!selected ? (
              <p className="px-4 py-12 text-center text-sm text-[#64748B]">
                Select a candidate from the list.
              </p>
            ) : (
              <>
                <div className="border-b border-[#E5E7EB] px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-[22px] font-semibold leading-7 text-[#0F172A]">
                        {displayName}
                      </h2>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-[#64748B]">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
                        {displayLocation}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-0.5">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#16A34A] transition hover:bg-[#F0FDF4]"
                        aria-label="Accept"
                        title="Accept"
                        onClick={() => void updateStatus("hired")}
                      >
                        <Check className="h-4 w-4" strokeWidth={2.25} />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#F8FAFC]"
                        aria-label="Maybe"
                        title="Maybe"
                        onClick={() => void updateStatus("undecided")}
                      >
                        <HelpCircle className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#DC2626] transition hover:bg-[#FEF2F2]"
                        aria-label="Reject"
                        title="Reject"
                        onClick={() => void updateStatus("rejected")}
                      >
                        <X className="h-4 w-4" strokeWidth={2.25} />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#F8FAFC]"
                        aria-label="More"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!workerId}
                      onClick={() => setInterviewOpen(true)}
                      className="inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold text-white disabled:opacity-50"
                      style={{ backgroundColor: branding.primaryHex }}
                    >
                      <CalendarDays className="h-4 w-4" />
                      Setup Interview
                    </button>
                    <button
                      type="button"
                      disabled={!workerId}
                      onClick={() => setMessageOpen(true)}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border bg-white px-3.5 text-sm font-medium disabled:opacity-50"
                      style={{
                        borderColor: branding.secondaryHex || "#012352",
                        color: branding.secondaryHex || "#012352",
                      }}
                    >
                      <MessageSquare className="h-4 w-4" />
                      Message
                    </button>
                    <button
                      type="button"
                      disabled={!workerId}
                      onClick={() => setCallOpen(true)}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border bg-white px-3.5 text-sm font-medium disabled:opacity-50"
                      style={{
                        borderColor: branding.secondaryHex || "#012352",
                        color: branding.secondaryHex || "#012352",
                      }}
                    >
                      <Phone className="h-4 w-4" />
                      Call
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] px-5 py-2.5">
                  <h3 className="text-sm font-semibold text-[#0F172A]">Resume</h3>
                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-1 text-sm text-[#64748B]">
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-[#F1F5F9]"
                        onClick={() => setZoom((value) => Math.max(50, value - 10))}
                        aria-label="Zoom out"
                      >
                        −
                      </button>
                      <span className="min-w-[2.75rem] text-center tabular-nums">{zoom}%</span>
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-[#F1F5F9]"
                        onClick={() => setZoom((value) => Math.min(150, value + 10))}
                        aria-label="Zoom in"
                      >
                        +
                      </button>
                    </div>
                    {resumeDownloadUrl ? (
                      <a
                        href={resumeDownloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                        style={{ color: branding.primaryHex }}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download Resume
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="min-h-[420px] flex-1 bg-[#F8FAFC] p-4">
                  {profileLoading ? (
                    <p className="py-16 text-center text-sm text-[#64748B]">Loading resume…</p>
                  ) : workerId && hasResume && resumePreviewUrl ? (
                    <div
                      className="mx-auto overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm"
                      style={{ width: `${zoom}%`, maxWidth: "100%" }}
                    >
                      <iframe
                        key={resumePreviewUrl}
                        title={`${displayName} resume`}
                        src={resumePreviewUrl}
                        className="h-[min(70vh,760px)] w-full bg-white"
                        onError={() =>
                          setResumePreviewError(
                            "Preview is blocked on this device. Use Download Resume or open in a new tab."
                          )
                        }
                      />
                      {resumePreviewError ? (
                        <div className="border-t border-[#E5E7EB] bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          {resumePreviewError}{" "}
                          {resumeDownloadUrl ? (
                            <a
                              href={resumeDownloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold underline"
                            >
                              Open resume
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 text-center text-sm text-[#64748B]">
                      {workerId
                        ? "No resume uploaded for this candidate yet."
                        : "Candidate profile is not linked yet, so resume is unavailable."}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          {/* Right — Figma notes panel */}
          <aside
            className="flex min-h-0 flex-col gap-4 rounded-2xl border border-[#E2E8F0] bg-[#F1F5F9] p-4"
            ref={statusMenuRef}
          >
            <div className="relative">
              <button
                type="button"
                disabled={!selected || statusBusy}
                onClick={() => setStatusMenuOpen((open) => !open)}
                className="inline-flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3 text-sm text-[#334155] disabled:opacity-50"
              >
                <span>
                  Status:{" "}
                  <span className="font-semibold">{applicationStatusLabel(currentStatus)}</span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-[#94A3B8] ${statusMenuOpen ? "rotate-180" : ""}`}
                />
              </button>
              {statusMenuOpen ? (
                <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg">
                  {APPLICATION_STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => void updateStatus(option.id)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#F8FAFC]"
                    >
                      {option.label}
                      {currentStatus === option.id ? (
                        <Check className="h-4 w-4" style={{ color: branding.primaryHex }} />
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#0F172A]">Activity feed</h3>
              {selected ? (
                <div className="mt-2">
                  <p className="text-xs font-medium text-[#94A3B8]">
                    {formatActivityDate(selected.submitted_at || selected.created_at)}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-[#64748B]">
                    {applicantName(selected)} applied to {jobTitle}.
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-[#94A3B8]">No activity yet.</p>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-[200px] flex-1 flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
                <textarea
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  aria-label="Candidate note"
                  className="min-h-[140px] flex-1 resize-none border-0 bg-transparent px-3 py-3 text-sm text-[#334155] outline-none placeholder:text-[#94A3B8]"
                />
                <div className="border-t border-[#F1F5F9] p-2.5">
                  <button
                    type="button"
                    disabled={noteSaving || !selected || !noteDraft.trim()}
                    onClick={() => void saveNote()}
                    className="inline-flex h-9 w-full items-center justify-center rounded-xl px-3 text-sm font-semibold text-white disabled:bg-[#CBD5E1]"
                    style={
                      noteDraft.trim() && selected && !noteSaving
                        ? { backgroundColor: branding.secondaryHex || "#012352" }
                        : undefined
                    }
                  >
                    {noteSaving ? "Saving…" : "Save Note"}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {workerId ? (
        <>
          <CandidateCommunicationDialog
            open={messageOpen}
            onClose={() => setMessageOpen(false)}
            workerId={workerId}
            candidateName={displayName}
            email={displayEmail || profile?.worker.email || null}
            phone={displayPhone}
          />
          <AddCallLogModal open={callOpen} workerId={workerId} onClose={() => setCallOpen(false)} />
          <ScheduleInterviewModal
            open={interviewOpen}
            applicants={[{ id: workerId, name: displayName, status: currentStatus }]}
            submitting={interviewSubmitting}
            error={interviewError}
            onClose={() => {
              setInterviewOpen(false);
              setInterviewError(null);
            }}
            onSubmit={handleSchedule}
            fixedWorkerId={workerId}
            fixedApplicantName={displayName}
          />
        </>
      ) : null}
    </div>
  );
}
