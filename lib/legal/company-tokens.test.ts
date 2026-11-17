import { describe, expect, it } from "vitest";
import {
  applyCompanyNameToLegalDocument,
  applyCompanyNameToText,
} from "@/lib/legal/company-tokens";

describe("applyCompanyNameToText", () => {
  it("replaces ZipStaff variants with the tenant company name", () => {
    const input =
      'ZipStaff Inc. ("ZipStaff") and [ZipStaff Legal Entity] operate {{company_name}}.';
    expect(applyCompanyNameToText(input, "NexusMedPro")).toBe(
      'NexusMedPro ("NexusMedPro") and NexusMedPro operate NexusMedPro.'
    );
  });
});

describe("applyCompanyNameToLegalDocument", () => {
  it("personalizes title and paragraphs", () => {
    const doc = applyCompanyNameToLegalDocument(
      {
        title: "ZipStaff Privacy Policy",
        lastUpdated: null,
        sections: [
          {
            title: "1. Who We Are",
            paragraphs: ["ZipStaff Inc. operates the platform."],
          },
        ],
      },
      "Acme Care"
    );
    expect(doc.title).toBe("Acme Care Privacy Policy");
    expect(doc.sections[0].paragraphs[0]).toBe("Acme Care operates the platform.");
  });
});
