import { describe, expect, it } from "vitest";
import { buildJobRequisitionJson } from "@/lib/jobs/generate-job-description/prompts";
import { generateJobDescriptionRequestSchema } from "@/lib/jobs/generate-job-description/schema";
import {
  boldJobDescriptionSectionTitles,
  htmlToPlainText,
  sanitizeJobDescriptionHtml,
} from "@/lib/jobs/generate-job-description/sanitize-html";

describe("generateJobDescriptionRequestSchema", () => {
  it("requires title, profession, or specialty", () => {
    const result = generateJobDescriptionRequestSchema.safeParse({
      location: "Austin, TX",
    });
    expect(result.success).toBe(false);
  });

  it("accepts profession alone and strips empty arrays", () => {
    const result = generateJobDescriptionRequestSchema.safeParse({
      profession: "Nursing",
      requiredSkills: ["  BLS  ", "", "ACLS"],
      benefits: [],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.profession).toBe("Nursing");
    expect(result.data.requiredSkills).toEqual(["BLS", "ACLS"]);
    expect(result.data.benefits).toEqual([]);
  });
});

describe("sanitizeJobDescriptionHtml", () => {
  it("removes scripts and disallowed tags/attrs", () => {
    const dirty =
      '<h3 onclick="alert(1)">About</h3><p>Hello<script>evil()</script></p><a href="https://x">x</a>';
    const clean = sanitizeJobDescriptionHtml(dirty);
    expect(clean).toContain("<h3>About</h3>");
    expect(clean).toContain("<p>Hello</p>");
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("<a");
  });

  it("converts sanitized html to plain text", () => {
    const plain = htmlToPlainText("<h3>About the Role</h3><p>Lead care.<br>More</p>");
    expect(plain).toContain("About the Role");
    expect(plain).toContain("Lead care.");
  });

  it("bolds known section titles without changing body copy", () => {
    const input =
      "<p>About the Role</p><p>Lead care.</p><h3>Key Responsibilities</h3><ul><li>Assist patients</li></ul><p>Required Qualifications</p><p>CNA license</p>";
    const bolded = boldJobDescriptionSectionTitles(input);
    expect(bolded).toContain("<p><strong>About the Role</strong></p>");
    expect(bolded).toContain("<h3><strong>Key Responsibilities</strong></h3>");
    expect(bolded).toContain("<p><strong>Required Qualifications</strong></p>");
    expect(bolded).toContain("<p>Lead care.</p>");
    expect(bolded).toContain("<li>Assist patients</li>");
    expect(bolded).toContain("<p>CNA license</p>");
  });
});

describe("buildJobRequisitionJson", () => {
  it("omits empty fields", () => {
    const parsed = generateJobDescriptionRequestSchema.parse({
      jobTitle: "RN",
      profession: "Nursing",
    });
    const json = buildJobRequisitionJson(parsed);
    expect(json).toEqual({ jobTitle: "RN", profession: "Nursing" });
  });

  it("includes MSP source details when sourceType is MSP", () => {
    const parsed = generateJobDescriptionRequestSchema.parse({
      jobTitle: "RN",
      sourceType: "MSP",
      sourceJobTitle: "Registered Nurse - Acute Care",
      sourceJobDetails: "Travel Assignment",
      mspClient: "Novant",
      facility: "Texas City, Texas",
      duration: "8 weeks",
      specialRequirements: "BLS required",
    });
    const json = buildJobRequisitionJson(parsed);
    expect(json.sourceType).toBe("MSP");
    expect(json.sourceJobTitle).toBe("Registered Nurse - Acute Care");
    expect(json.sourceJobDetails).toBe("Travel Assignment");
    expect(json.mspClient).toBe("Novant");
    expect(json.facility).toBe("Texas City, Texas");
    expect(json.duration).toBe("8 weeks");
    expect(json.specialRequirements).toBe("BLS required");
  });

  it("keeps Internal payloads free of MSP-only empty fields", () => {
    const parsed = generateJobDescriptionRequestSchema.parse({
      jobTitle: "CNA",
      sourceType: "Internal",
      profession: "Allied Health",
    });
    const json = buildJobRequisitionJson(parsed);
    expect(json).toEqual({
      jobTitle: "CNA",
      profession: "Allied Health",
      sourceType: "Internal",
    });
  });
});

describe("resolvePreferredJobTitle", () => {
  it("prefers MSP sourceJobTitle over opaque public titles", async () => {
    const { resolvePreferredJobTitle } = await import(
      "@/lib/jobs/generate-job-description/prompts"
    );
    const parsed = generateJobDescriptionRequestSchema.parse({
      jobTitle: "RN - 100",
      sourceType: "MSP",
      sourceJobTitle: "Registered Nurse - Home Health",
      profession: "Nursing",
    });
    expect(resolvePreferredJobTitle(parsed)).toBe("Registered Nurse - Home Health");
  });

  it("falls back to profession when MSP title is opaque", async () => {
    const { resolvePreferredJobTitle } = await import(
      "@/lib/jobs/generate-job-description/prompts"
    );
    const parsed = generateJobDescriptionRequestSchema.parse({
      jobTitle: "RN - 100",
      sourceType: "MSP",
      profession: "Nursing",
      specialty: "Home Health",
    });
    expect(resolvePreferredJobTitle(parsed)).toBe("Nursing (Home Health)");
  });

  it("keeps Internal title unchanged", async () => {
    const { resolvePreferredJobTitle } = await import(
      "@/lib/jobs/generate-job-description/prompts"
    );
    const parsed = generateJobDescriptionRequestSchema.parse({
      jobTitle: "Certified Nursing Assistant",
      sourceType: "Internal",
      profession: "Allied Health",
    });
    expect(resolvePreferredJobTitle(parsed)).toBe("Certified Nursing Assistant");
  });
});
