"use client";

import Link from "next/link";
import {
  JOB_POSTING_BODY_CLASS,
  JOB_POSTING_COMPANY_CLASS,
  JOB_POSTING_DESCRIPTION_CSS,
  JOB_POSTING_METADATA_CLASS,
  JOB_POSTING_PAGE_TITLE_CLASS,
  JOB_POSTING_SECTION_HEADING_CLASS,
} from "@/app/admin_recruiter/jobs/job-posting-typography";
import { JobDescriptionHtml } from "@/lib/jobs/job-description-html";
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
  .public-jobs-board-description.job-description-html { max-width: 42rem; }
  ${JOB_POSTING_DESCRIPTION_CSS.replaceAll(".job-posting-description", ".public-jobs-board-description")}
`;

function ApplyControl({
  href,
  className,
}: {
  href: string | null;
  className?: string;
}) {
  if (href) {
    return (
      <Link
        href={href}
        data-testid="jobs-apply-button"
        className={className}
      >
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

const applyClassName =
  "inline-flex min-h-11 min-w-[10.5rem] items-center justify-center rounded-xl bg-[color:var(--brand-primary)] px-5 text-sm font-semibold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)] focus-visible:ring-offset-2 motion-reduce:transition-none";

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
    <article className="flex h-full min-h-0 flex-col overflow-hidden" data-testid="jobs-detail-panel" aria-labelledby="jobs-detail-title">
      <style>{DESCRIPTION_STYLES}</style>
      <header className="shrink-0 border-b border-slate-100 bg-white px-4 py-4 min-[1024px]:px-6">
        {onBack && stacked ? (
          <button
            ref={backButtonRef}
            type="button"
            onClick={onBack}
            data-testid="jobs-back-to-jobs"
            className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-[color:var(--brand-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)] focus-visible:ring-offset-2"
          >
            ← Back to jobs
          </button>
        ) : null}
        <p className={JOB_POSTING_COMPANY_CLASS}>
          {companyName}
        </p>
        <h2 id="jobs-detail-title" className={`mt-1 ${JOB_POSTING_PAGE_TITLE_CLASS}`}>
          {title}
        </h2>
        <p className={`mt-1.5 ${JOB_POSTING_METADATA_CLASS}`}>{locationLine}</p>
        {facts.length ? <p className={`mt-1 ${JOB_POSTING_METADATA_CLASS}`}>{facts.join(" · ")}</p> : null}
        <div className={`mt-2 flex flex-wrap gap-x-3 gap-y-1 ${JOB_POSTING_METADATA_CLASS}`}>
          {pay ? <span>{pay}</span> : null}
          {posted ? <span>{posted}</span> : null}
        </div>
        {!stacked ? (
          <div className="mt-4">
            <ApplyControl href={applyHref} className={applyClassName} />
          </div>
        ) : null}
      </header>

      <div className="jobs-board-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 min-[1024px]:px-6">
        <section aria-label="Job description">
          <JobDescriptionHtml html={descriptionHtml} className="public-jobs-board-description" emptyLabel="" />
        </section>
        {showResponsibilities ? (
          <section className="mt-6 max-w-2xl">
            <h3 className={JOB_POSTING_SECTION_HEADING_CLASS}>Responsibilities</h3>
            <p className={`mt-2 whitespace-pre-wrap ${JOB_POSTING_BODY_CLASS}`}>{job.responsibilities}</p>
          </section>
        ) : null}
        {showQualifications ? (
          <section className="mt-6 max-w-2xl">
            <h3 className={JOB_POSTING_SECTION_HEADING_CLASS}>Qualifications</h3>
            <p className={`mt-2 whitespace-pre-wrap ${JOB_POSTING_BODY_CLASS}`}>{job.qualifications}</p>
          </section>
        ) : null}
        {showBenefits ? (
          <section className="mt-6 max-w-2xl">
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
          <section className="mt-6 max-w-2xl">
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
          <ApplyControl href={applyHref} className={`${applyClassName} w-full`} />
        </div>
      ) : null}
    </article>
  );
}
