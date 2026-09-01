"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ChevronDown, MoreVertical } from "lucide-react";
import toast from "react-hot-toast";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  formatStoredJobDescriptionHtml,
  JobDescriptionHtml,
} from "@/lib/jobs/job-description-html";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import type { JobStatus } from "@/lib/jobs/types";
import { JobsBreadcrumb } from "./JobsBreadcrumb";
import {
  JOB_FORM_PAGE_CARD_CLASS,
  JOB_FORM_PRIMARY_BUTTON_CLASS,
  JOB_FORM_SURFACE_CLASS,
  primaryButtonStyle,
} from "./job-form-shared";
import {
  JOB_POSTING_DESCRIPTION_CSS,
  JOB_POSTING_METADATA_CLASS,
  JOB_POSTING_PAGE_TITLE_CLASS,
} from "./job-posting-typography";
import { JobPublicViewLink } from "./JobPublicViewLink";
import {
  formatJobDetailsDate,
  formatJobDetailsLocation,
  formatJobDetailsPay,
  formatWorkLocationLabel,
  jobDetailsStatusDotClass,
  jobDetailsStatusLabel,
  performanceDateRangeLabel,
  preferredSkillsFromJob,
  splitJobListContent,
  statusActionForTarget,
  type JobDetailsRow,
  type JobDetailsStats,
  type StatusTransitionAction,
} from "./job-details-helpers";

const STATUS_OPTIONS: JobStatus[] = ["published", "draft", "closed", "archived"];

type Props = {
  jobId: string;
};

function BrandBackIcon({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-[14px] w-[14px] shrink-0 ${flip ? "rotate-180" : ""} ${className}`}
      style={{
        backgroundColor: "currentColor",
        maskImage: "url(/eva_arrow-back-fill.svg)",
        WebkitMaskImage: "url(/eva_arrow-back-fill.svg)",
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-8">
      <h3 className="text-sm font-semibold text-[#1D2739]">{title}</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-[#667085]">
        {items.map((item) => (
          <li key={`${title}-${item}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function CandidateCard({
  iconSrc,
  count,
  label,
  linkHref,
  linkLabel,
  secondaryColor,
}: {
  iconSrc: string;
  count: number;
  label: string;
  linkHref: string;
  linkLabel: string;
  secondaryColor: string;
}) {
  return (
    <div className="flex min-h-[120px] flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <BrandedSvgIcon
          src={iconSrc}
          className="mt-0.5 h-5 w-5 shrink-0"
          color={secondaryColor}
        />
        <div className="min-w-0">
          <p className="text-base font-semibold leading-6 text-[#374151]">
            {count} {label}
          </p>
          <p className="mt-0.5 text-xs font-normal leading-4 text-[#6B7280]">
            Applications received
          </p>
        </div>
      </div>
      <Link
        href={linkHref}
        className="mt-4 inline-flex items-center gap-1 text-[10px] font-semibold leading-[15px] transition hover:opacity-80"
        style={{ color: secondaryColor }}
      >
        {linkLabel}
        <BrandBackIcon flip />
      </Link>
    </div>
  );
}

export default function JobDetailsClient({ jobId }: Props) {
  const branding = useTenantBranding();
  const brandVars = brandingToCssVars(branding) as CSSProperties;
  const brandStyle = primaryButtonStyle(brandVars);

  const [job, setJob] = useState<JobDetailsRow | null>(null);
  const [stats, setStats] = useState<JobDetailsStats | null>(null);
  const [publicJobPath, setPublicJobPath] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(jobId)}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to load job");
      setJob(payload.job as JobDetailsRow);
      setStats(payload.stats as JobDetailsStats);
      setPublicJobPath(
        typeof payload.publicJobPath === "string" ? payload.publicJobPath : null
      );
      setCompanyName(
        String(payload.tenant?.name || branding.companyName || "").trim() || "Company"
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load job");
      setJob(null);
    } finally {
      setLoading(false);
    }
  }, [branding.companyName, jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (statusRef.current && !statusRef.current.contains(target)) setStatusOpen(false);
      if (actionsRef.current && !actionsRef.current.contains(target)) setActionsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  async function transition(action: StatusTransitionAction) {
    setStatusBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to update status");
      setStatusOpen(false);
      setActionsOpen(false);
      if (action === "archive") {
        toast.success("Job archived successfully");
      } else if (action === "unarchive") {
        toast.success("Job restored from archive");
      } else if (action === "publish") {
        toast.success("Job published");
      } else if (action === "close") {
        toast.success("Job closed");
      } else if (action === "unpublish") {
        toast.success("Job unpublished");
      }
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update status";
      setError(message);
      toast.error(message);
    } finally {
      setStatusBusy(false);
    }
  }

  async function onSelectStatus(target: JobStatus) {
    if (!job) return;
    const action = statusActionForTarget(String(job.status), target);
    if (!action) {
      setStatusOpen(false);
      return;
    }
    await transition(action);
  }

  const title = (() => {
    if (!job) return "Untitled job";
    const isMsp = String(job.source_type ?? "").trim().toLowerCase() === "msp";
    if (isMsp) {
      return job.source_job_title?.trim() || job.public_title?.trim() || "Untitled job";
    }
    return job.public_title?.trim() || "Untitled job";
  })();
  const location = job ? formatJobDetailsLocation(job) : "—";
  const pay = job ? formatJobDetailsPay(job) : "—";
  const posted = job ? formatJobDetailsDate(job.published_at || job.created_at) : "—";
  const responsibilities = useMemo(
    () => splitJobListContent(job?.responsibilities),
    [job?.responsibilities]
  );
  const qualifications = useMemo(
    () => splitJobListContent(job?.qualifications),
    [job?.qualifications]
  );
  const preferredSkills = useMemo(
    () => (job ? preferredSkillsFromJob(job) : []),
    [job]
  );
  const benefits = useMemo(() => splitJobListContent(job?.benefits), [job?.benefits]);
  const workLocation = job ? formatWorkLocationLabel(job) : "—";
  const summaryHtml = useMemo(() => {
    const raw = job?.public_description?.trim() || "";
    return formatStoredJobDescriptionHtml(raw, {
      stripBenefits: benefits.length > 0,
    });
  }, [job?.public_description, benefits.length]);

  const performanceMetrics = [
    { value: String(stats?.impressions ?? 0), label: "Impressions" },
    { value: String(stats?.clicks ?? 0), label: "Clicks" },
    { value: String(stats?.applicationsStarted ?? 0), label: "Started Applications" },
    {
      value: String(stats?.applicationsAll ?? 0),
      label: "Applications",
    },
    {
      value: `$${(stats?.totalCost ?? 0).toFixed(2)}`,
      label: "Total cost",
    },
  ];

  return (
    <div
      className="box-border w-full min-w-0 max-w-full px-3 pb-8 pt-4 sm:px-5 sm:pt-5 lg:px-8"
      style={brandVars}
    >
      <JobsBreadcrumb page="job-details" className="mb-4" />
      <div className={`${JOB_FORM_PAGE_CARD_CLASS} p-4 sm:p-6 lg:p-8`}>
        {loading ? (
          <p className="mt-8 text-sm text-[#64748B]">Loading job details…</p>
        ) : error && !job ? (
          <p className="mt-8 text-sm text-red-600">{error}</p>
        ) : job ? (
          <>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 w-full lg:w-auto">
                <div className="flex min-w-0 items-start gap-2">
                  <h1 className={`min-w-0 ${JOB_POSTING_PAGE_TITLE_CLASS}`}>
                    {title}
                  </h1>
                </div>
                <p className={`mt-1.5 ${JOB_POSTING_METADATA_CLASS}`}>
                  Location: {location}
                  <span className="mx-1.5 text-[#CBD5E1]">•</span>
                  Company: {companyName}
                </p>
                {(() => {
                  const flow = job.onboarding_flows;
                  const workflowName = Array.isArray(flow)
                    ? flow[0]?.name
                    : flow?.name;
                  if (!workflowName && !job.workflow_assignment_error) return null;
                  return (
                    <p className="mt-2 text-sm text-[#475569]">
                      Assigned workflow:{" "}
                      <span className="font-semibold text-[#111827]">
                        {workflowName || "Unmapped"}
                      </span>
                      {job.workflow_assignment_mode === "manual" ? (
                        <span className="ml-2 text-xs font-medium uppercase tracking-wide text-[#64748B]">
                          (manual override)
                        </span>
                      ) : workflowName ? (
                        <span className="ml-2 text-xs font-medium uppercase tracking-wide text-[#64748B]">
                          (automatic)
                        </span>
                      ) : null}
                      {job.workflow_assignment_error ? (
                        <span className="mt-1 block text-xs text-amber-700 whitespace-pre-line">
                          {job.workflow_assignment_error}
                        </span>
                      ) : null}
                    </p>
                  );
                })()}

                <div className="mt-4 flex w-full flex-col gap-3 min-[520px]:flex-row min-[520px]:flex-wrap min-[520px]:items-center">
                  <Link
                    href={`/admin_recruiter/jobs/${job.id}/edit`}
                    className={`${JOB_FORM_PRIMARY_BUTTON_CLASS} w-full min-[520px]:w-auto`}
                    style={brandStyle}
                  >
                    Edit Job
                  </Link>
                  <JobPublicViewLink
                    href={publicJobPath}
                    variant="button"
                    className="w-full min-[520px]:w-auto"
                  />
                </div>
              </div>

              <div className="flex w-full shrink-0 items-center gap-2 self-stretch min-[520px]:w-auto min-[520px]:self-start lg:w-auto">
                <div className="relative min-w-0 flex-1 min-[520px]:flex-none" ref={statusRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusOpen((open) => !open);
                      setActionsOpen(false);
                    }}
                    disabled={statusBusy}
                    className={`inline-flex h-10 w-full items-center justify-between gap-2 px-3 text-sm text-[#334155] min-[520px]:h-9 min-[520px]:w-auto min-[520px]:justify-center ${JOB_FORM_SURFACE_CLASS}`}
                    aria-haspopup="listbox"
                    aria-expanded={statusOpen}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${jobDetailsStatusDotClass(String(job.status))}`}
                    />
                    {jobDetailsStatusLabel(String(job.status))}
                    <ChevronDown className="h-4 w-4 text-[#94A3B8]" />
                  </button>
                  {statusOpen ? (
                    <div
                      role="listbox"
                      className="absolute right-0 z-30 mt-1 min-w-[140px] overflow-hidden rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          role="option"
                          aria-selected={job.status === option}
                          disabled={statusBusy}
                          onClick={() => void onSelectStatus(option)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#F8FAFC]"
                        >
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${jobDetailsStatusDotClass(option)}`}
                          />
                          {jobDetailsStatusLabel(option)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="relative" ref={actionsRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setActionsOpen((open) => !open);
                      setStatusOpen(false);
                    }}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#64748B] transition hover:bg-[#F8FAFC] min-[520px]:h-9 min-[520px]:w-9"
                    aria-label="More actions"
                    aria-haspopup="menu"
                    aria-expanded={actionsOpen}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {actionsOpen ? (
                    <div
                      role="menu"
                      className="absolute right-0 z-30 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg"
                    >
                      <Link
                        href={`/admin_recruiter/jobs/${job.id}/edit`}
                        role="menuitem"
                        className="block px-3 py-2 text-sm text-[#334155] hover:bg-[#F8FAFC]"
                        onClick={() => setActionsOpen(false)}
                      >
                        Edit
                      </Link>
                      {publicJobPath ? (
                        <Link
                          href={publicJobPath}
                          target="_blank"
                          rel="noopener noreferrer"
                          role="menuitem"
                          className="block px-3 py-2 text-sm text-[#334155] hover:bg-[#F8FAFC]"
                          onClick={() => setActionsOpen(false)}
                        >
                          Public page
                        </Link>
                      ) : null}
                      {job.status === "published" ? (
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#F8FAFC]"
                          onClick={() => void transition("close")}
                        >
                          Close job
                        </button>
                      ) : null}
                      {job.status !== "archived" ? (
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#F8FAFC]"
                          onClick={() => void transition("archive")}
                        >
                          Archive
                        </button>
                      ) : (
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#F8FAFC]"
                          onClick={() => void transition("unarchive")}
                        >
                          Unarchive
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

            <section className="mt-8">
              <h2 className="text-lg font-semibold text-[#1D2739]">Candidates</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <CandidateCard
                  iconSrc="/all-applicants.svg"
                  count={stats?.applicationsAll ?? 0}
                  label="All"
                  linkHref={`/admin_recruiter/applications?jobId=${encodeURIComponent(job.id)}`}
                  linkLabel="View all applications"
                  secondaryColor={branding.secondaryHex || "#012352"}
                />
                <CandidateCard
                  iconSrc="/new-applicants.svg"
                  count={stats?.applicationsNew ?? 0}
                  label="New"
                  linkHref={`/admin_recruiter/applications?jobId=${encodeURIComponent(job.id)}&tab=new`}
                  linkLabel="Reviewed new applications"
                  secondaryColor={branding.secondaryHex || "#012352"}
                />
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-lg font-semibold text-[#1D2739]">Job performance</h2>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#64748B]">
                <span className="inline-flex items-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/jobs-count-icon.svg"
                    alt=""
                    width={14}
                    height={14}
                    className="h-3.5 w-3.5 shrink-0"
                    aria-hidden
                  />
                  Free Job
                </span>
                <span className="inline-flex items-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/fluent_calendar-32-regular.svg"
                    alt=""
                    width={14}
                    height={14}
                    className="h-3.5 w-3.5 shrink-0"
                    aria-hidden
                  />
                  {performanceDateRangeLabel(job)}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {performanceMetrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="flex min-h-[104px] flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 shadow-sm"
                  >
                    <p className="text-[30px] font-semibold leading-9 text-[#1D2739]">{metric.value}</p>
                    <p className="text-sm font-medium leading-5 text-[#64748B]">{metric.label}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-sm font-semibold text-[#1D2739]">Job post summary</h2>
              <div className="mt-4 max-h-[560px] overflow-y-auto rounded-xl border border-[#E5E7EB] bg-[#FCFCFD] p-5 sm:p-6">
                <p className="text-sm text-[#334155]">
                  <span className="font-medium text-[#1D2739]">Date posted:</span> {posted}
                </p>
                <p className="mt-1 text-sm text-[#334155]">
                  <span className="font-medium text-[#1D2739]">Pay:</span> {pay}
                </p>

                <section className="mt-6">
                  <h3 className="mb-4 text-sm font-semibold text-[#1D2739]">Job Summary</h3>
                  <style>{JOB_POSTING_DESCRIPTION_CSS.replaceAll(".job-posting-description", ".job-summary-description")}</style>
                  <JobDescriptionHtml
                    html={summaryHtml}
                    className="job-summary-description mt-0 text-[#667085]"
                    emptyLabel="No job summary added yet."
                  />
                </section>

                <SummaryList title="Key Responsibilities" items={responsibilities} />
                <SummaryList title="Qualifications" items={qualifications} />
                <SummaryList title="Preferred Skills" items={preferredSkills} />

                {benefits.length ? (
                  <section className="mt-8">
                    <h3 className="text-sm font-semibold text-[#1D2739]">Benefits</h3>
                    <p className="mt-2 text-sm leading-6 text-[#667085]">
                      {benefits.join(", ")}
                    </p>
                  </section>
                ) : null}

                <section className="mt-8">
                  <h3 className="text-sm font-semibold text-[#1D2739]">Work Location</h3>
                  <p className="mt-2 text-sm leading-6 text-[#667085]">{workLocation}</p>
                </section>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
