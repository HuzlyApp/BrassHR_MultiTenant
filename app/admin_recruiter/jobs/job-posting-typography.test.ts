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
  it("uses one 14px size for labels, titles, and body copy", () => {
    expect(JOB_FORM_LABEL_CLASS).toContain("text-sm");
    expect(JOB_FORM_SECTION_TITLE_CLASS).toContain("text-sm");
    expect(JOB_POSTING_FIELD_LABEL_CLASS).toContain("text-sm");
    expect(JOB_POSTING_SECTION_HEADING_CLASS).toContain("text-sm");
    expect(JOB_POSTING_PAGE_TITLE_CLASS).toContain("text-sm");
    expect(JOB_POSTING_CARD_TITLE_CLASS).toContain("text-sm");
    expect(JOB_POSTING_BODY_CLASS).toContain("text-sm");
    expect(JOB_POSTING_HELPER_CLASS).toContain("text-sm");
    expect(JOB_POSTING_METADATA_CLASS).toContain("text-sm");
    expect(JOB_POSTING_VALIDATION_CLASS).toContain("text-sm");
    expect(JOB_POSTING_FIELD_VALUE_CLASS).toContain("text-sm");
    expect(JOB_POSTING_BADGE_CLASS).toContain("text-sm");
  });

  it("does not use a heading size hierarchy on job posting surfaces", () => {
    expect(JOB_POSTING_PAGE_TITLE_CLASS).not.toContain("text-xl");
    expect(JOB_POSTING_PAGE_TITLE_CLASS).not.toContain("text-2xl");
    expect(JOB_POSTING_CARD_TITLE_CLASS).not.toContain("text-base");
    expect(JOB_POSTING_SECTION_HEADING_CLASS).not.toContain("text-lg");
    expect(JOB_FORM_SECTION_TITLE_CLASS).not.toContain("text-lg");
  });

  it("forces description HTML including headings to 14px", () => {
    expect(JOB_POSTING_DESCRIPTION_CSS).toContain("font-size: 14px !important");
    expect(JOB_POSTING_DESCRIPTION_CSS).toContain("line-height: 1.5rem");
    expect(JOB_POSTING_DESCRIPTION_CSS).not.toContain("font-size: 1rem");
    expect(JOB_POSTING_DESCRIPTION_CSS).not.toContain("font-size: 0.875rem");
  });
});
