import { describe, expect, it } from "vitest";
import {
  JOB_POSTING_BADGE_CLASS,
  JOB_POSTING_BODY_CLASS,
  JOB_POSTING_CARD_TITLE_CLASS,
  JOB_POSTING_DESCRIPTION_CSS,
  JOB_POSTING_FIELD_LABEL_CLASS,
  JOB_POSTING_FIELD_VALUE_CLASS,
  JOB_POSTING_HELPER_CLASS,
  JOB_POSTING_METADATA_CLASS,
  JOB_POSTING_PAGE_TITLE_CLASS,
  JOB_POSTING_SECTION_HEADING_CLASS,
  JOB_POSTING_VALIDATION_CLASS,
} from "./job-posting-typography";
import { JOB_FORM_LABEL_CLASS, JOB_FORM_SECTION_TITLE_CLASS } from "./job-form-shared";

describe("job posting typography tokens", () => {
  it("keeps field labels aligned with the job form", () => {
    expect(JOB_FORM_LABEL_CLASS).toContain("text-sm");
    expect(JOB_POSTING_FIELD_LABEL_CLASS).toContain("text-sm");
  });

  it("keeps section headings aligned with the job form", () => {
    expect(JOB_FORM_SECTION_TITLE_CLASS).toContain("text-lg");
    expect(JOB_POSTING_SECTION_HEADING_CLASS).toContain("text-lg");
  });

  it("uses a consistent page-title size instead of shrinking per surface", () => {
    expect(JOB_POSTING_PAGE_TITLE_CLASS).toContain("text-xl");
    expect(JOB_POSTING_PAGE_TITLE_CLASS).toContain("sm:text-2xl");
    expect(JOB_POSTING_PAGE_TITLE_CLASS).not.toContain("md:text-3xl");
  });

  it("keeps card titles smaller than page titles", () => {
    expect(JOB_POSTING_CARD_TITLE_CLASS).toContain("text-base");
    expect(JOB_POSTING_CARD_TITLE_CLASS).not.toContain("text-xl");
  });

  it("uses matching body, helper, metadata, and validation sizes", () => {
    expect(JOB_POSTING_BODY_CLASS).toContain("text-sm");
    expect(JOB_POSTING_HELPER_CLASS).toContain("text-sm");
    expect(JOB_POSTING_METADATA_CLASS).toContain("text-sm");
    expect(JOB_POSTING_VALIDATION_CLASS).toContain("text-sm");
    expect(JOB_POSTING_FIELD_VALUE_CLASS).toContain("text-sm");
    expect(JOB_POSTING_BADGE_CLASS).toContain("text-xs");
  });

  it("keeps description CSS on the shared 14px / 24px body scale", () => {
    expect(JOB_POSTING_DESCRIPTION_CSS).toContain("font-size: 0.875rem");
    expect(JOB_POSTING_DESCRIPTION_CSS).toContain("line-height: 1.5rem");
  });
});
