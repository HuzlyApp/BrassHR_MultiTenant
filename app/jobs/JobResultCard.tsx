"use client";

import {
  JOB_POSTING_BADGE_CLASS,
  JOB_POSTING_CARD_TITLE_CLASS,
  JOB_POSTING_METADATA_CLASS,
} from "@/app/admin_recruiter/jobs/job-posting-typography";
import {
  formatJobLocationLine,
  formatPostedDate,
  formatPublicJobPay,
  publicBoardJobTitle,
  relationName,
  type PublicBoardJob,
} from "@/lib/jobs/public-jobs-board";

export function JobResultCard({
  job,
  companyName,
  selected,
  onSelect,
  buttonRef,
}: {
  job: PublicBoardJob;
  companyName: string;
  selected: boolean;
  onSelect: () => void;
  buttonRef?: (node: HTMLButtonElement | null) => void;
}) {
  const title = publicBoardJobTitle(job);
  const profession = relationName(job.professions);
  const locationLine = formatJobLocationLine(job.location, job.location_type);
  const pay = formatPublicJobPay(job);
  const posted = formatPostedDate(job.published_at, job.updated_at);
  const meta = [profession, pay, posted].filter(Boolean).join(" · ");

  return (
    <article>
      <button
        ref={buttonRef}
        type="button"
        id={`job-card-${job.public_job_token}`}
        data-testid={`job-card-${job.public_job_token}`}
        aria-pressed={selected}
        aria-current={selected ? "true" : undefined}
        aria-label={`${title}${selected ? ", selected" : ""}`}
        onClick={onSelect}
        className={`relative w-full rounded-none px-3.5 py-3 text-left transition motion-reduce:transition-none min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)] focus-visible:ring-offset-2 ${
          selected
            ? "bg-[color:color-mix(in_srgb,var(--brand-primary)_7%,white)]"
            : "bg-white hover:bg-slate-50"
        }`}
      >
        {selected ? (
          <span
            aria-hidden
            className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[color:var(--brand-primary)]"
          />
        ) : null}
        <div className="flex items-start justify-between gap-3 pl-2">
          <div className="min-w-0">
            <p className={`line-clamp-2 ${JOB_POSTING_CARD_TITLE_CLASS}`}>{title}</p>
            {companyName ? (
              <p className={`mt-0.5 truncate ${JOB_POSTING_METADATA_CLASS}`}>{companyName}</p>
            ) : null}
          </div>
          {job.employment_type ? (
            <span className={`shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 ${JOB_POSTING_BADGE_CLASS}`}>
              {job.employment_type}
            </span>
          ) : null}
        </div>
        <p className={`mt-1 truncate pl-2 ${JOB_POSTING_METADATA_CLASS}`}>{locationLine}</p>
        {meta ? <p className={`mt-1 truncate pl-2 ${JOB_POSTING_METADATA_CLASS}`}>{meta}</p> : null}
      </button>
    </article>
  );
}
