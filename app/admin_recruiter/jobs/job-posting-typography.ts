/**
 * Shared Job Posting typography. Equivalent content uses the same token
 * across form, preview, card, modal, admin details, and public applicant views.
 * Different semantic roles keep different sizes.
 */

export const JOB_POSTING_PAGE_TITLE_CLASS =
  "text-xl font-semibold leading-snug text-[#1D2739] sm:text-2xl sm:leading-8";

export const JOB_POSTING_CARD_TITLE_CLASS =
  "text-base font-semibold leading-snug text-[#1D2739]";

export const JOB_POSTING_SECTION_HEADING_CLASS =
  "text-lg font-semibold leading-7 text-[#1D2739]";

export const JOB_POSTING_FIELD_LABEL_CLASS =
  "text-sm font-normal leading-5 text-[#64748B]";

export const JOB_POSTING_FIELD_VALUE_CLASS =
  "text-sm font-medium leading-5 text-[#1D2739]";

export const JOB_POSTING_BODY_CLASS = "text-sm font-normal leading-6 text-[#334155]";

export const JOB_POSTING_HELPER_CLASS = "text-sm font-normal leading-5 text-[#64748B]";

export const JOB_POSTING_VALIDATION_CLASS = "text-sm font-normal leading-5 text-rose-600";

export const JOB_POSTING_BUTTON_TEXT_CLASS = "text-sm font-medium";

export const JOB_POSTING_TAB_CLASS = "text-sm font-medium";

export const JOB_POSTING_BADGE_CLASS = "text-xs font-medium leading-4";

export const JOB_POSTING_METADATA_CLASS = "text-sm font-normal leading-5 text-[#64748B]";

export const JOB_POSTING_COMPANY_CLASS =
  "text-sm font-semibold uppercase tracking-wide text-[color:var(--brand-primary)]";

/** Shared job-description HTML hierarchy for admin preview and public views. */
export const JOB_POSTING_DESCRIPTION_CSS = `
  .job-posting-description.job-description-html > :first-child { margin-top: 0 !important; }
  .job-posting-description.job-description-html h2,
  .job-posting-description.job-description-html h3,
  .job-posting-description.job-description-html h4 {
    margin-top: 1.35rem;
    margin-bottom: 0.4rem;
    font-size: 1rem;
    line-height: 1.5rem;
    font-weight: 600;
    color: #1d2739;
  }
  .job-posting-description.job-description-html p,
  .job-posting-description.job-description-html ul,
  .job-posting-description.job-description-html ol {
    margin-top: 0;
    margin-bottom: 0.65rem;
    color: #334155;
    font-size: 0.875rem;
    line-height: 1.5rem;
    font-weight: 400;
  }
  .job-posting-description.job-description-html ul {
    list-style-type: disc;
    list-style-position: outside;
    padding-left: 1.2rem;
  }
  .job-posting-description.job-description-html ol {
    list-style-type: decimal;
    list-style-position: outside;
    padding-left: 1.2rem;
  }
  .job-posting-description.job-description-html li {
    display: list-item;
    margin-top: 0.2rem;
    margin-bottom: 0.2rem;
    font-weight: 400;
  }
`;
