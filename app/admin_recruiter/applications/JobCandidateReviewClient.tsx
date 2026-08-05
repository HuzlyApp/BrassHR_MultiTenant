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
  HelpCircle,
  MapPin,
  MoreVertical,
  Phone,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import toast from "react-hot-toast";
import AddCallLogModal from "@/app/admin_recruiter/components/AddCallLogModal";
import CandidateChatPopup from "@/app/admin_recruiter/components/CandidateChatPopup";
import CandidateCommunicationDialog from "@/app/admin_recruiter/components/CandidateCommunicationDialog";
import { ScheduleInterviewModal } from "@/app/admin_recruiter/calendar/components/ScheduleInterviewModal";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
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
import { formatInterviewDate, formatInterviewTimeRange } from "@/lib/interviews/format";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import type { AdminInterviewItem } from "@/app/api/admin/applicant-appointments/route";

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
  worker?: Record<string, unknown> | Record<string, unknown>[] | null;
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
  const worker = one(row.worker);
  return (
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    [worker.first_name, worker.last_name].filter(Boolean).join(" ") ||
    String(profile.email ?? worker.email ?? "Applicant")
  );
}

function applicantEmail(row: ApplicationRow): string {
  return String(one(row.applicant_profiles).email ?? one(row.worker).email ?? "");
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
  const [upcomingInterview, setUpcomingInterview] = useState<AdminInterviewItem | null>(null);
  const [upcomingInterviewLoading, setUpcomingInterviewLoading] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [resumePreviewError, setResumePreviewError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatPreferExpanded, setChatPreferExpanded] = useState(false);

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

  const secondaryColor = branding.secondaryHex || "#012352";

  const chatAppliedOnLabel = useMemo(() => {
    if (!selected) return null;
    const raw = selected.submitted_at || selected.created_at;
    if (!raw) return null;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return null;
    return `Applied on ${date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
    })}`;
  }, [selected]);

  useEffect(() => {
    if (workerId) {
      setChatOpen(true);
      setChatPreferExpanded(false);
    } else {
      setChatOpen(false);
    }
  }, [workerId]);

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

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!workerId) {
        setUpcomingInterview(null);
        setUpcomingInterviewLoading(false);
        return;
      }
      setUpcomingInterviewLoading(true);
      try {
        const response = await fetch(
          `/api/admin/applicant-appointments?tab=upcoming&workerId=${encodeURIComponent(workerId)}`,
          { cache: "no-store" }
        );
        const payload = (await response.json()) as {
          error?: string;
          interviews?: AdminInterviewItem[];
        };
        if (cancelled) return;
        if (!response.ok) throw new Error(payload.error || "Failed to load interviews");
        const interviews = payload.interviews ?? [];
        setUpcomingInterview(interviews[0] ?? null);
      } catch {
        if (!cancelled) setUpcomingInterview(null);
      } finally {
        if (!cancelled) setUpcomingInterviewLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [workerId]);

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
    if (!selected) return;
    setInterviewSubmitting(true);
    setInterviewError(null);
    try {
      const response = await fetch("/api/admin/applicant-appointments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          applicationId: selected.id,
          jobId: jobId || selected.job_requisition_id,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        interview?: AdminInterviewItem;
        statusUpdated?: boolean;
        emailSent?: boolean;
        emailSkipped?: boolean;
      };
      if (!response.ok) throw new Error(data.error || "Failed to schedule interview");
      if (data.interview) setUpcomingInterview(data.interview);
      if (data.statusUpdated) {
        setRows((current) =>
          current.map((row) =>
            row.id === selected.id ? { ...row, status: "interviewing" } : row
          )
        );
      }
      setInterviewOpen(false);
      if (data.emailSent) {
        toast.success("Interview scheduled — invitation email sent");
      } else if (data.emailSkipped) {
        toast.success("Interview scheduled");
        toast("No email sent — candidate email is missing or mail is not configured.", {
          icon: "ℹ️",
        });
      } else {
        toast.success("Interview scheduled");
      }
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
      className="box-border flex min-h-0 w-full min-w-0 max-w-full flex-col px-5 pb-8"
      style={brandStyle}
    >
      <div className="flex flex-wrap items-center gap-5 border-b border-[#E5E7EB] py-5">
        <h1 className={CANDIDATES_PAGE_TITLE_CLASS} style={CANDIDATES_PAGE_TITLE_STYLE}>
          Candidates
        </h1>
        <Link
          href={
            jobId
              ? `/admin_recruiter/applications?jobId=${encodeURIComponent(jobId)}`
              : "/admin_recruiter/applications"
          }
          className="admin-recruiter-action-chip inline-flex h-7 items-center rounded-lg px-2.5 text-xs font-semibold text-white"
          style={{ backgroundColor: branding.primaryHex }}
        >
          All Candidates
        </Link>
      </div>

      <div className="flex min-w-0 flex-col gap-1 border-b border-[#E5E7EB] py-5">
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

      {/* Figma Frame 6926: Back + pager — 14px vertical, 20px left via page px-5 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] py-[14px] sm:gap-3">
        <Link
          href="/admin_recruiter/jobs"
          className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
          style={{ color: branding.secondaryHex || "#012352" }}
        >
          <span
            aria-hidden
            className="inline-block h-[14px] w-[14px] shrink-0"
            style={{
              backgroundColor: "currentColor",
              maskImage: "url(/eva_arrow-back-fill.svg)",
              WebkitMaskImage: "url(/eva_arrow-back-fill.svg)",
              maskSize: "contain",
              WebkitMaskSize: "contain",
            }}
          />
          Back to jobs
        </Link>
        <div className="inline-flex shrink-0 items-center gap-1 text-sm text-[#64748B]">
          <button
            type="button"
            onClick={() => goRelative(-1)}
            disabled={selectedIndex <= 0}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white disabled:opacity-40 sm:h-8 sm:w-8"
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
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white disabled:opacity-40 sm:h-8 sm:w-8"
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
        <div className="mt-4 grid min-h-0 grid-cols-1 gap-3 sm:gap-4 xl:min-h-[calc(100vh-260px)] xl:grid-cols-[240px_minmax(0,1fr)_280px]">
          {/* Left — rounded candidate cards */}
          <aside className="min-h-0 min-w-0 order-1 xl:order-none">
            <div className="-mx-1 flex max-h-[28vh] snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-hidden px-1 pb-1 sm:max-h-[32vh] sm:flex-col sm:overflow-x-hidden sm:overflow-y-auto sm:snap-none sm:pb-0 sm:pr-0.5 xl:max-h-[calc(100vh-260px)]">
              {loading ? (
                <p className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-8 text-center text-sm text-[#64748B]">
                  Loading…
                </p>
              ) : rows.length === 0 ? (
                <p className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-8 text-center text-sm text-[#64748B]">
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
                      className={`w-[min(78vw,280px)] shrink-0 snap-start rounded-xl border px-3.5 py-3 text-left transition sm:w-full sm:shrink ${active
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

          {/* Center — profile + resume (Figma Frame 6927: 20px inset + gap) */}
          <section className="order-2 flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white xl:order-none">
            {!selected ? (
              <p className="px-5 py-12 text-center text-sm text-[#64748B]">
                Select a candidate from the list.
              </p>
            ) : (
              <>
                <div className="border-b border-[#E5E7EB] px-5 pt-5 pb-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <h2
                        className="truncate text-[18px] font-semibold leading-7 sm:break-words sm:whitespace-normal sm:text-[22px]"
                        style={{ color: secondaryColor }}
                        title={displayName}
                      >
                        {displayName}
                      </h2>
                      <p className="mt-1 flex min-w-0 items-start gap-1.5 text-sm text-[#64748B]">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
                        <span className="min-w-0 break-words">{displayLocation}</span>
                      </p>
                    </div>
                    <div className="inline-flex w-full shrink-0 items-center justify-end gap-0.5 sm:w-auto">
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#16A34A] transition hover:bg-[#F0FDF4] sm:h-8 sm:w-8"
                        aria-label="Accept"
                        title="Accept"
                        onClick={() => void updateStatus("hired")}
                      >
                        <Check className="h-4 w-4" strokeWidth={2.25} />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#F8FAFC] sm:h-8 sm:w-8"
                        aria-label="Maybe"
                        title="Maybe"
                        onClick={() => void updateStatus("undecided")}
                      >
                        <HelpCircle className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#DC2626] transition hover:bg-[#FEF2F2] sm:h-8 sm:w-8"
                        aria-label="Reject"
                        title="Reject"
                        onClick={() => void updateStatus("rejected")}
                      >
                        <X className="h-4 w-4" strokeWidth={2.25} />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#F8FAFC] sm:h-8 sm:w-8"
                        aria-label="More"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <button
                      type="button"
                      disabled={!workerId}
                      onClick={() => setInterviewOpen(true)}
                      className="admin-recruiter-action-chip h-10 w-full rounded-lg px-3.5 text-sm font-semibold text-white disabled:opacity-50 sm:h-9 sm:w-auto"
                      style={{ backgroundColor: branding.primaryHex }}
                    >
                      <BrandedSvgIcon
                        src="/interview-jobs.svg"
                        className="h-4 w-4"
                        color="#FFFFFF"
                      />
                      <span>
                        {upcomingInterview ? "Schedule another interview" : "Setup Interview"}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={!workerId || (!displayEmail && !displayPhone)}
                      onClick={() => setMessageOpen(true)}
                      className="admin-recruiter-action-chip h-10 w-full rounded-lg border bg-white px-3.5 text-sm font-medium disabled:opacity-50 sm:h-9 sm:w-auto"
                      style={{
                        borderColor: branding.secondaryHex || "#012352",
                        color: branding.secondaryHex || "#012352",
                      }}
                    >
                      <BrandedSvgIcon
                        src="/message.svg"
                        className="h-4 w-4"
                        color={branding.secondaryHex || "#012352"}
                      />
                      <span>Message</span>
                    </button>
                    <button
                      type="button"
                      disabled={!workerId}
                      onClick={() => setCallOpen(true)}
                      className="admin-recruiter-action-chip h-10 w-full rounded-lg border bg-white px-3.5 text-sm font-medium disabled:opacity-50 sm:h-9 sm:w-auto"
                      style={{
                        borderColor: branding.secondaryHex || "#012352",
                        color: branding.secondaryHex || "#012352",
                      }}
                    >
                      <Phone className="h-4 w-4 shrink-0" aria-hidden />
                      <span>Call</span>
                    </button>
                  </div>
                  {upcomingInterviewLoading ? (
                    <p className="mt-4 text-sm text-[#64748B]">Loading interview schedule…</p>
                  ) : upcomingInterview ? (
                    <div
                      className="mt-4 rounded-xl border px-3.5 py-3 sm:px-4"
                      style={{
                        borderColor: `color-mix(in srgb, ${branding.primaryHex} 35%, #E5E7EB)`,
                        backgroundColor: `color-mix(in srgb, ${branding.primaryHex} 6%, white)`,
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${branding.primaryHex} 14%, white)`,
                            color: branding.primaryHex,
                          }}
                        >
                          <CalendarDays className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold" style={{ color: secondaryColor }}>
                            Upcoming interview
                          </p>
                          <p className="mt-0.5 text-sm font-medium text-[#1F2937]">
                            {upcomingInterview.title}
                          </p>
                          <p className="mt-1 text-sm text-[#64748B]">
                            {formatInterviewDate(upcomingInterview.startsAt)} ·{" "}
                            {formatInterviewTimeRange(
                              upcomingInterview.startsAt,
                              upcomingInterview.endsAt
                            )}
                          </p>
                          {upcomingInterview.meetingLink ? (
                            <a
                              href={upcomingInterview.meetingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex text-sm font-medium underline"
                              style={{ color: branding.primaryHex }}
                            >
                              Open meeting link
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="border-b border-[#E5E7EB] px-5 pt-5">
                  <h3
                    className="text-lg font-semibold leading-7 sm:text-[20px]"
                    style={{ color: secondaryColor }}
                  >
                    Resume
                  </h3>
                  <div className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        className="admin-recruiter-action-chip h-10 w-10 rounded-lg transition hover:bg-[#F8FAFC] sm:h-9 sm:w-9"
                        onClick={() => setZoom((value) => Math.max(50, value - 10))}
                        aria-label="Zoom out"
                      >
                        <ZoomOut className="h-6 w-6 text-[#374151]" strokeWidth={2} aria-hidden />
                      </button>
                      <span className="admin-recruiter-zoom-pct">{zoom}%</span>
                      <button
                        type="button"
                        className="admin-recruiter-action-chip h-10 w-10 rounded-lg transition hover:bg-[#F8FAFC] sm:h-9 sm:w-9"
                        onClick={() => setZoom((value) => Math.min(150, value + 10))}
                        aria-label="Zoom in"
                      >
                        <ZoomIn className="h-6 w-6 text-[#374151]" strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                    {resumeDownloadUrl ? (
                      <a
                        href={resumeDownloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="admin-recruiter-action-chip h-10 w-full shrink-0 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#525252] transition hover:bg-[#F8FAFC] sm:h-9 sm:w-auto"
                      >
                        <BrandedSvgIcon
                          src="/icons/admin-recruiter/downloadicon.svg"
                          className="h-4 w-4 shrink-0"
                          color="#525252"
                        />
                        <span>Download Resume</span>
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="min-h-[280px] flex-1 overflow-auto bg-[#F8FAFC] p-5 sm:min-h-[420px]">
                  {profileLoading ? (
                    <p className="py-16 text-center text-sm text-[#64748B]">Loading resume…</p>
                  ) : workerId && hasResume && resumePreviewUrl ? (
                    <div className="w-full overflow-auto">
                      <div
                        className="inline-block min-w-full rounded-xl border border-[#E5E7EB] bg-white shadow-sm"
                        style={{ zoom: zoom / 100 }}
                      >
                        <iframe
                          key={resumePreviewUrl}
                          title={`${displayName} resume`}
                          src={resumePreviewUrl}
                          className="h-[min(55vh,520px)] w-full bg-white sm:h-[min(70vh,760px)]"
                          onError={() =>
                            setResumePreviewError(
                              "Preview is blocked on this device. Use Download Resume or open in a new tab."
                            )
                          }
                        />
                        {resumePreviewError ? (
                          <div className="border-t border-[#E5E7EB] bg-amber-50 px-3 py-3 text-sm text-amber-900 sm:px-4">
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
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 text-center text-sm text-[#64748B] sm:min-h-[420px]">
                      {workerId
                        ? "No resume uploaded for this candidate yet."
                        : "Candidate profile is not linked yet, so resume is unavailable."}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          {/* Right — Figma notes panel (compact card, not full-height) */}
          <aside
            className="order-3 flex h-fit w-full min-w-0 flex-col gap-4 self-start rounded-[16px] border border-[#E2E8F0] bg-[#F8FAFC] p-3 sm:p-4 xl:order-none"
            ref={statusMenuRef}
          >
            <div className="relative">
              <button
                type="button"
                disabled={!selected || statusBusy}
                onClick={() => setStatusMenuOpen((open) => !open)}
                className="inline-flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3 text-sm text-[#334155] disabled:opacity-50"
              >
                <span className="min-w-0 truncate text-left">
                  Status:{" "}
                  <span className="font-semibold">{applicationStatusLabel(currentStatus)}</span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-[#94A3B8] ${statusMenuOpen ? "rotate-180" : ""}`}
                />
              </button>
              {statusMenuOpen ? (
                <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg">
                  {APPLICATION_STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => void updateStatus(option.id)}
                      className="flex min-h-10 w-full items-center justify-between px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#F8FAFC]"
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

            <div className="max-h-[200px] overflow-y-auto rounded-[12px]">
              <h3 className="text-sm font-semibold text-[#0F172A]">Activity feed</h3>
              {selected ? (
                <div className="mt-2 space-y-3">
                  {upcomingInterview ? (
                    <div>
                      <p className="text-xs font-medium text-[#94A3B8]">
                        {formatActivityDate(upcomingInterview.startsAt)}
                      </p>
                      <p className="mt-0.5 break-words text-xs leading-5 text-[#64748B]">
                        Interview scheduled — {upcomingInterview.title} on{" "}
                        {formatInterviewDate(upcomingInterview.startsAt)} at{" "}
                        {formatInterviewTimeRange(
                          upcomingInterview.startsAt,
                          upcomingInterview.endsAt
                        )}
                        .
                      </p>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-xs font-medium text-[#94A3B8]">
                      {formatActivityDate(selected.submitted_at || selected.created_at)}
                    </p>
                    <p className="mt-0.5 break-words text-xs leading-5 text-[#64748B]">
                      {applicantName(selected)} applied to {jobTitle}.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-[#94A3B8]">No activity yet.</p>
              )}
            </div>

            <div>
              <textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                aria-label="Candidate note"
                className="h-[120px] w-full resize-none rounded-[12px] border border-[#E2E8F0] bg-white px-3 py-3 text-sm text-[#334155] outline-none placeholder:text-[#94A3B8]"
              />
              <button
                type="button"
                disabled={noteSaving || !selected || !noteDraft.trim()}
                onClick={() => void saveNote()}
                className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#E2E8F0] px-4 text-sm font-semibold text-[#94A3B8] disabled:cursor-not-allowed disabled:opacity-80 sm:h-9 sm:w-auto"
                style={
                  noteDraft.trim() && selected && !noteSaving
                    ? {
                      backgroundColor: branding.secondaryHex || "#012352",
                      color: "#FFFFFF",
                    }
                    : undefined
                }
              >
                {noteSaving ? "Saving…" : "Save Note"}
              </button>
            </div>
          </aside>
        </div>
      )}

      {workerId ? (
        <>
          <CandidateChatPopup
            key={workerId}
            workerId={workerId}
            candidateName={displayName}
            appliedOnLabel={chatAppliedOnLabel}
            open={chatOpen}
            preferExpanded={chatPreferExpanded}
            onOpenChange={(next) => {
              setChatOpen(next);
              if (!next) setChatPreferExpanded(false);
            }}
          />
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
