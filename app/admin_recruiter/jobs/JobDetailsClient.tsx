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
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { JobDescriptionHtml } from "@/lib/jobs/job-description-html";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import type { JobStatus } from "@/lib/jobs/types";
import {
  JOB_FORM_OUTLINE_BUTTON_CLASS,
  JOB_FORM_PAGE_CARD_CLASS,
  JOB_FORM_PRIMARY_BUTTON_CLASS,
  JOB_FORM_SURFACE_CLASS,
  primaryButtonStyle,
} from "./job-form-shared";
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
    <section className="mt-6">
      <h3 className="text-base font-semibold text-[#1D2739]">{title}</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-[#334155]">
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconSrc}
          alt=""
          width={20}
          height={20}
          className="mt-0.5 h-5 w-5 shrink-0"
          aria-hidden
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
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

  const title = job?.public_title?.trim() || "Untitled job";
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
  const summaryHtml = job?.public_description?.trim() || "";

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
    <div className="w-full" style={brandVars}>
      <div className={`${JOB_FORM_PAGE_CARD_CLASS} p-5 sm:p-6 lg:p-8`}>
        <Link
          href="/admin_recruiter/jobs"
          className="inline-flex items-center gap-1 text-[10px] font-semibold leading-[15px] transition hover:opacity-80"
          style={{ color: branding.secondaryHex || "#012352" }}
        >
          <BrandBackIcon />
          Back to jobs
        </Link>

        {loading ? (
          <p className="mt-8 text-sm text-[#64748B]">Loading job details…</p>
        ) : error && !job ? (
          <p className="mt-8 text-sm text-red-600">{error}</p>
        ) : job ? (
          <>
            <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h1 className="text-[20px] font-semibold leading-7 text-black">
                  {title}
                </h1>
                <p className="mt-1.5 text-sm text-[#374151]">
                  Location: {location}
                  <span className="mx-1.5 text-[#CBD5E1]">•</span>
                  Company: {companyName}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/admin_recruiter/jobs/${job.id}/edit`}
                    className={JOB_FORM_PRIMARY_BUTTON_CLASS}
                    style={brandStyle}
                  >
                    Edit Job
                  </Link>
                  {publicJobPath ? (
                    <Link
                      href={publicJobPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={JOB_FORM_OUTLINE_BUTTON_CLASS}
                    >
                      View public job page
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      title="Publish this job to view the public page"
                      className={`${JOB_FORM_OUTLINE_BUTTON_CLASS} opacity-50`}
                    >
                      View public job page
                    </button>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 self-start">
                <div className="relative" ref={statusRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusOpen((open) => !open);
                      setActionsOpen(false);
                    }}
                    disabled={statusBusy}
                    className={`inline-flex h-9 items-center gap-2 px-3 text-sm text-[#334155] ${JOB_FORM_SURFACE_CLASS}`}
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
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#64748B] transition hover:bg-[#F8FAFC]"
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
                          onClick={() => void transition("unpublish")}
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
              <div className="mt-5 grid grid-cols-2 gap-4 border-y border-[#E5E7EB] py-5 sm:grid-cols-3 lg:grid-cols-5">
                {performanceMetrics.map((metric, index) => (
                  <div
                    key={metric.label}
                    className={`px-1 ${index > 0 ? "sm:border-l sm:border-[#E5E7EB] sm:pl-5" : ""}`}
                  >
                    <p className="text-2xl font-semibold text-[#1D2739]">{metric.value}</p>
                    <p className="mt-1 text-sm text-[#64748B]">{metric.label}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-lg font-semibold text-[#1D2739]">Job post summary</h2>
              <div className="mt-4 max-h-[560px] overflow-y-auto rounded-xl border border-[#E5E7EB] bg-[#FCFCFD] p-5 sm:p-6">
                <p className="text-sm text-[#334155]">
                  <span className="font-medium text-[#1D2739]">Date posted:</span> {posted}
                </p>
                <p className="mt-1 text-sm text-[#334155]">
                  <span className="font-medium text-[#1D2739]">Pay:</span> {pay}
                </p>

                <section className="mt-6">
                  <h3 className="text-base font-semibold text-[#1D2739]">Job Summary</h3>
                  <JobDescriptionHtml
                    html={summaryHtml}
                    className="mt-2 text-sm leading-6 text-[#334155]"
                    emptyLabel="No job summary added yet."
                  />
                </section>

                <SummaryList title="Key Responsibilities" items={responsibilities} />
                <SummaryList title="Qualifications" items={qualifications} />
                <SummaryList title="Preferred Skills" items={preferredSkills} />

                {benefits.length ? (
                  <section className="mt-6">
                    <h3 className="text-base font-semibold text-[#1D2739]">Benefits</h3>
                    <p className="mt-2 text-sm leading-6 text-[#334155]">
                      {benefits.join(", ")}
                    </p>
                  </section>
                ) : null}

                <section className="mt-6">
                  <h3 className="text-base font-semibold text-[#1D2739]">Work Location</h3>
                  <p className="mt-2 text-sm leading-6 text-[#334155]">{workLocation}</p>
                </section>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
