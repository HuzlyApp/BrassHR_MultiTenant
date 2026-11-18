import { describe, expect, it } from "vitest";
import {
  legalHtmlToSections,
  legalSectionsToHtml,
  sanitizeLegalPolicyHtml,
} from "@/lib/legal/policy-html";

describe("legalSectionsToHtml / legalHtmlToSections", () => {
  it("arranges existing section titles and paragraphs into one editor body", () => {
    const html = legalSectionsToHtml([
      {
        title: "1. Who We Are",
        paragraphs: [
          "This Privacy Policy describes how Test Company collects information.",
          "• Applicants and candidates",
          "• Workers and employees",
        ],
      },
      {
        title: "2. Who This Policy Covers",
        paragraphs: ["This single Policy covers the people who use BrassHR."],
      },
    ]);

    expect(html).toContain("<strong>1. Who We Are</strong>");
    expect(html).toContain("<li>Applicants and candidates</li>");
    expect(html).toContain("<strong>2. Who This Policy Covers</strong>");

    const roundTrip = legalHtmlToSections(html);
    expect(roundTrip[0]?.title).toBe("1. Who We Are");
    expect(roundTrip[0]?.paragraphs[0]).toContain("Test Company");
    expect(roundTrip[0]?.paragraphs.some((p) => p.startsWith("•"))).toBe(true);
    expect(roundTrip[1]?.title).toBe("2. Who This Policy Covers");
  });
});

describe("sanitizeLegalPolicyHtml", () => {
  it("keeps formatting tags and font-size spans", () => {
    const cleaned = sanitizeLegalPolicyHtml(
      '<p><strong>Title</strong></p><p><span style="font-size:18px">Bigger</span> <em>note</em></p><script>alert(1)</script>'
    );
    expect(cleaned).toContain("<strong>Title</strong>");
    expect(cleaned).toContain('style="font-size:18px"');
    expect(cleaned).toContain("<em>note</em>");
    expect(cleaned).not.toContain("script");
  });
});
