/**
 * Shared Job Posting typography. Job posting copy uses one 14px size
 * across form, editor, preview, card, modal, admin details, and public views.
 * Bold/italic remain available; heading tags must not change size.
 */

export const JOB_POSTING_TEXT_SIZE_CLASS = "text-sm";

export const JOB_POSTING_PAGE_TITLE_CLASS =
  "text-sm font-semibold leading-6 text-[#1D2739]";

export const JOB_POSTING_CARD_TITLE_CLASS =
  "text-sm font-semibold leading-6 text-[#1D2739]";

export const JOB_POSTING_SECTION_HEADING_CLASS =
  "text-sm font-semibold leading-6 text-[#1D2739]";

export const JOB_POSTING_FIELD_LABEL_CLASS =
  "text-sm font-normal leading-5 text-[#64748B]";

export const JOB_POSTING_FIELD_VALUE_CLASS =
  "text-sm font-medium leading-5 text-[#1D2739]";

export const JOB_POSTING_BODY_CLASS = "text-sm font-normal leading-6 text-[#334155]";

export const JOB_POSTING_HELPER_CLASS = "text-sm font-normal leading-5 text-[#64748B]";

export const JOB_POSTING_VALIDATION_CLASS = "text-sm font-normal leading-5 text-rose-600";

export const JOB_POSTING_BUTTON_TEXT_CLASS = "text-sm font-medium";

export const JOB_POSTING_TAB_CLASS = "text-sm font-medium";

export const JOB_POSTING_BADGE_CLASS = "text-sm font-medium leading-5";

export const JOB_POSTING_METADATA_CLASS = "text-sm font-normal leading-5 text-[#64748B]";

export const JOB_POSTING_COMPANY_CLASS =
  "text-sm font-semibold uppercase tracking-wide text-[color:var(--brand-primary)]";

const JOB_DESCRIPTION_FLAT_TEXT = `
    font-size: 14px !important;
    line-height: 1.5rem !important;
    font-family: inherit !important;
`;

/** Shared job-description HTML: one 14px size, no heading size hierarchy. */
export const JOB_POSTING_DESCRIPTION_CSS = `
  .job-posting-description.job-description-html,
  .job-posting-description.job-description-html * {
    ${JOB_DESCRIPTION_FLAT_TEXT}
  }
  .job-posting-description.job-description-html > :first-child { margin-top: 0 !important; }
  .job-posting-description.job-description-html h1,
  .job-posting-description.job-description-html h2,
  .job-posting-description.job-description-html h3,
  .job-posting-description.job-description-html h4,
  .job-posting-description.job-description-html h5,
  .job-posting-description.job-description-html h6 {
    margin-top: 1.35rem;
    margin-bottom: 0.4rem;
    font-weight: 600;
    color: #1d2739;
  }
  .job-posting-description.job-description-html p,
  .job-posting-description.job-description-html ul,
  .job-posting-description.job-description-html ol {
    margin-top: 0;
    margin-bottom: 0.65rem;
    color: #334155;
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
  .job-posting-description.job-description-html strong,
  .job-posting-description.job-description-html b {
    font-weight: 600;
    color: #1d2739;
  }
`;
