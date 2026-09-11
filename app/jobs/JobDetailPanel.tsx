"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import {
  JOB_POSTING_BODY_CLASS,
  JOB_POSTING_COMPANY_CLASS,
  JOB_POSTING_DESCRIPTION_CSS,
  JOB_POSTING_METADATA_CLASS,
  JOB_POSTING_SECTION_HEADING_CLASS,
} from "@/app/admin_recruiter/jobs/job-posting-typography";
import { JobDescriptionHtml } from "@/lib/jobs/job-description-html";
import {
  absolutePublicJobShareUrl,
  buildPublicJobSharePath,
  shareOrCopyPublicJobUrl,
} from "@/lib/jobs/public-job-share";
import {
  benefitItems,
  descriptionHasSection,
  formatJobLocationLine,
  formatPostedDate,
  formatPublicJobDescriptionHtml,
  formatPublicJobPay,
  formatWorkplaceType,
  publicBoardJobTitle,
  relationName,
  selectedJobApplyHref,
  type PublicBoardJob,
} from "@/lib/jobs/public-jobs-board";

const DESCRIPTION_STYLES = `
  .public-jobs-board-description.job-description-html { max-width: none; width: 100%; }
  .public-jobs-board-description.job-description-html p,
  .public-jobs-board-description.job-description-html ul,
  .public-jobs-board-description.job-description-html ol,
  .public-jobs-board-description.job-description-html li {
    max-width: none;
  }
  ${JOB_POSTING_DESCRIPTION_CSS.replaceAll(".job-posting-description", ".public-jobs-board-description")}
`;

const SAVED_JOBS_STORAGE_KEY = "brasshr-public-jobs-saved";

const ICON_BUTTON_CLASS =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent text-[color:var(--brand-primary)] transition hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)] focus-visible:ring-offset-2";

const VIEW_BUTTON_CLASS =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:var(--brand-primary)] bg-white text-[color:var(--brand-primary)] transition hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_6%,white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)] focus-visible:ring-offset-2";

const applyClassName =
  "inline-flex h-9 min-w-[8.75rem] items-center justify-center rounded-lg bg-[color:var(--brand-primary)] px-4 text-sm font-semibold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)] focus-visible:ring-offset-2 motion-reduce:transition-none";

const BRAND_ICON_COLOR = "var(--brand-primary)";
const BRAND_ICON_CLASS = "h-4 w-4";
const BOOKMARK_ICON_SRC = "/icons/jobs-board/bookmark.svg";
const BOOKMARK_FILLED_ICON_SRC = "/icons/jobs-board/bookmark-filled.svg";
const EXTERNAL_LINK_ICON_SRC = "/icons/jobs-board/external-link.svg";

function savedJobsStorageKey(tenantSlug: string): string {
  return `${SAVED_JOBS_STORAGE_KEY}:${tenantSlug.trim().toLowerCase()}`;
}

function readSavedJobTokens(tenantSlug: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(savedJobsStorageKey(tenantSlug));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((token): token is string => typeof token === "string" && token.trim().length > 0)
    );
  } catch {
    return new Set();
  }
}

function writeSavedJobTokens(tenantSlug: string, tokens: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(savedJobsStorageKey(tenantSlug), JSON.stringify([...tokens]));
  } catch {
    /* ignore quota */
  }
}

function ApplyControl({
  href,
  className,
}: {
  href: string | null;
  className?: string;
}) {
  if (href) {
    return (
      <Link href={href} data-testid="jobs-apply-button" className={className}>
        Apply now
      </Link>
    );
  }
  return (
    <span
      data-testid="jobs-apply-unavailable"
      className={`${className} cursor-not-allowed bg-slate-200 text-slate-500 hover:brightness-100`}
      title="Online applications are not available for this job yet"
    >
      Apply now
    </span>
  );
}

function JobDetailActions({
  jobToken,
  tenantSlug,
  applyHref,
  shareHref,
  title,
  stacked,
}: {
  jobToken: string;
  tenantSlug: string;
  applyHref: string | null;
  shareHref: string;
  title: string;
  stacked?: boolean;
}) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(readSavedJobTokens(tenantSlug).has(jobToken));
  }, [jobToken, tenantSlug]);

  const toggleSaved = useCallback(() => {
    const next = readSavedJobTokens(tenantSlug);
    if (next.has(jobToken)) {
      next.delete(jobToken);
      writeSavedJobTokens(tenantSlug, next);
      setSaved(false);
      toast.success("Removed from saved jobs");
      return;
    }
    next.add(jobToken);
    writeSavedJobTokens(tenantSlug, next);
    setSaved(true);
    toast.success("Saved job");
  }, [jobToken, tenantSlug]);

  const handleShare = useCallback(async () => {
    const shareUrl = absolutePublicJobShareUrl(
      shareHref,
      typeof window !== "undefined" ? window.location.origin : null
    );
    try {
      const result = await shareOrCopyPublicJobUrl({ url: shareUrl, title });
      if (result === "copied") {
        toast.success("Share link copied");
        return;
      }
      if (result === "shared" || result === "aborted") return;
      toast.error("Sharing is not available on this device");
    } catch {
      toast.error("Could not share this job");
    }
  }, [shareHref, title]);

  const saveButton = (
    <button
      type="button"
      onClick={toggleSaved}
      className={ICON_BUTTON_CLASS}
      aria-label={saved ? "Remove from saved jobs" : "Save job"}
      aria-pressed={saved}
      title={saved ? "Saved" : "Save"}
      data-testid="jobs-save-button"
    >
      <BrandedSvgIcon
        src={saved ? BOOKMARK_FILLED_ICON_SRC : BOOKMARK_ICON_SRC}
        className={BRAND_ICON_CLASS}
        color={BRAND_ICON_COLOR}
      />
    </button>
  );

  const shareButton = (
    <button
      type="button"
      onClick={() => void handleShare()}
      className={ICON_BUTTON_CLASS}
      aria-label="Share job"
      title="Share"
      data-testid="jobs-share-button"
    >
      <BrandedSvgIcon
        src="/icons/share-icon.svg"
        className={BRAND_ICON_CLASS}
        color={BRAND_ICON_COLOR}
      />
    </button>
  );

  const viewButton = (
    <Link
      href={shareHref}
      target="_blank"
      rel="noopener noreferrer"
      className={VIEW_BUTTON_CLASS}
      aria-label="View public job page"
      title="View"
      data-testid="jobs-view-button"
    >
      <BrandedSvgIcon
        src={EXTERNAL_LINK_ICON_SRC}
        className={BRAND_ICON_CLASS}
        color={BRAND_ICON_COLOR}
      />
    </Link>
  );

  if (stacked) {
    return (
      <div className="flex w-full flex-col gap-3" data-testid="jobs-detail-actions">
        <div className="flex items-center justify-center gap-1.5">
          {saveButton}
          {shareButton}
          {viewButton}
        </div>
        <ApplyControl href={applyHref} className={`${applyClassName} w-full`} />
      </div>
    );
  }

  // Desktop Figma order: bookmark → share → Apply now → external link
  return (
    <div
      className="flex shrink-0 items-center justify-end gap-2"
      data-testid="jobs-detail-actions"
    >
      {saveButton}
      {shareButton}
      <ApplyControl href={applyHref} className={applyClassName} />
      {viewButton}
    </div>
  );
}

export function JobDetailPanel({
  job,
  companyName,
  tenantSlug,
  onBack,
  backButtonRef,
  emptyMessage,
  stacked,
}: {
  job: PublicBoardJob | null;
  companyName: string;
  tenantSlug: string;
  onBack?: () => void;
  backButtonRef?: (node: HTMLButtonElement | null) => void;
  emptyMessage?: string;
  stacked?: boolean;
}) {
  if (!job) {
    return (
      <div
        className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-500"
        data-testid="jobs-detail-panel"
      >
        {emptyMessage || "Select a job to view the full description."}
      </div>
    );
  }

  const title = publicBoardJobTitle(job);
  const profession = relationName(job.professions);
  const specialty = relationName(job.specialties);
  const workplace = formatWorkplaceType(job.location_type);
  const locationLine = formatJobLocationLine(job.location, job.location_type);
  const pay = formatPublicJobPay(job);
  const posted = formatPostedDate(job.published_at, job.updated_at);
  const applyHref = selectedJobApplyHref(tenantSlug, job);
  const jobToken = String(job.public_job_token ?? "").trim();
  const shareHref = jobToken ? buildPublicJobSharePath(tenantSlug, jobToken) ?? "" : "";
  const benefits = benefitItems(job.benefits);
  const descriptionHtml = formatPublicJobDescriptionHtml(
    job.public_description || "",
    benefits.length > 0,
    title
  );
  const showResponsibilities =
    Boolean(job.responsibilities?.trim()) && !descriptionHasSection(descriptionHtml, "Responsibilities");
  const showQualifications =
    Boolean(job.qualifications?.trim()) && !descriptionHasSection(descriptionHtml, "Qualifications");
  const showBenefits = benefits.length > 0 && !descriptionHasSection(descriptionHtml, "Benefits");
  const facts = [job.employment_type, workplace, profession, specialty].filter(Boolean);

  return (
    <article
      className="flex h-full min-h-0 flex-col overflow-hidden"
      data-testid="jobs-detail-panel"
      aria-labelledby="jobs-detail-title"
    >
      <style>{DESCRIPTION_STYLES}</style>
      <header className="shrink-0 border-b border-slate-100 bg-white px-4 py-4 min-[1024px]:px-5">
        {onBack && stacked ? (
          <button
            ref={backButtonRef}
            type="button"
            onClick={onBack}
            data-testid="jobs-back-to-jobs"
            className="mb-3 inline-flex min-h-10 items-center gap-1 text-sm font-medium text-[color:var(--brand-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)] focus-visible:ring-offset-2"
          >
            ← Back to jobs
          </button>
        ) : null}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className={JOB_POSTING_COMPANY_CLASS}>{companyName}</p>
            <h2
              id="jobs-detail-title"
              className="mt-1 text-lg font-semibold leading-7 text-[#1D2739] sm:text-xl"
            >
              {title}
            </h2>
            <p className={`mt-1.5 ${JOB_POSTING_METADATA_CLASS}`}>{locationLine}</p>
            {facts.length ? (
              <p className={`mt-1 ${JOB_POSTING_METADATA_CLASS}`}>{facts.join(" · ")}</p>
            ) : null}
            <div className={`mt-2 flex flex-wrap gap-x-3 gap-y-1 ${JOB_POSTING_METADATA_CLASS}`}>
              {pay ? <span>{pay}</span> : null}
              {posted ? <span>{posted}</span> : null}
            </div>
          </div>
          {!stacked && jobToken ? (
            <JobDetailActions
              jobToken={jobToken}
              tenantSlug={tenantSlug}
              applyHref={applyHref}
              shareHref={shareHref}
              title={title}
            />
          ) : null}
        </div>
      </header>

      <div className="jobs-board-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 min-[1024px]:px-5">
        <section aria-label="Job description">
          <JobDescriptionHtml
            html={descriptionHtml}
            className="public-jobs-board-description"
            emptyLabel=""
          />
        </section>
        {showResponsibilities ? (
          <section className="mt-6 w-full">
            <h3 className={JOB_POSTING_SECTION_HEADING_CLASS}>Responsibilities</h3>
            <p className={`mt-2 whitespace-pre-wrap ${JOB_POSTING_BODY_CLASS}`}>
              {job.responsibilities}
            </p>
          </section>
        ) : null}
        {showQualifications ? (
          <section className="mt-6 w-full">
            <h3 className={JOB_POSTING_SECTION_HEADING_CLASS}>Qualifications</h3>
            <p className={`mt-2 whitespace-pre-wrap ${JOB_POSTING_BODY_CLASS}`}>
              {job.qualifications}
            </p>
          </section>
        ) : null}
        {showBenefits ? (
          <section className="mt-6 w-full">
            <h3 className={JOB_POSTING_SECTION_HEADING_CLASS}>Benefits</h3>
            <ul className={`mt-2 list-outside list-disc space-y-1 pl-5 ${JOB_POSTING_BODY_CLASS}`}>
              {benefits.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {(job.schedule || job.employment_type || workplace) &&
        !descriptionHasSection(descriptionHtml, "Employment details") ? (
          <section className="mt-6 w-full">
            <h3 className={JOB_POSTING_SECTION_HEADING_CLASS}>Employment details</h3>
            <ul className={`mt-2 space-y-1 ${JOB_POSTING_BODY_CLASS}`}>
              {job.employment_type ? <li>Employment type: {job.employment_type}</li> : null}
              {workplace ? <li>Workplace: {workplace}</li> : null}
              {job.schedule ? <li>Schedule: {job.schedule}</li> : null}
              {job.application_deadline ? (
                <li>
                  Apply by {new Date(`${job.application_deadline}T00:00:00`).toLocaleDateString()}
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}
      </div>

      {stacked ? (
        <div className="shrink-0 border-t border-slate-100 bg-white p-3">
          {jobToken ? (
            <JobDetailActions
              jobToken={jobToken}
              tenantSlug={tenantSlug}
              applyHref={applyHref}
              shareHref={shareHref}
              title={title}
              stacked
            />
          ) : (
            <ApplyControl href={applyHref} className={`${applyClassName} w-full`} />
          )}
        </div>
      ) : null}
    </article>
  );
}
