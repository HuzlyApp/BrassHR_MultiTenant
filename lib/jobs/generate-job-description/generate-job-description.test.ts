import { describe, expect, it } from "vitest";
import { buildJobRequisitionJson, buildJobDescriptionUserPrompt } from "@/lib/jobs/generate-job-description/prompts";
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
    expect(clean).toContain("<p>About</p>");
    expect(clean).toContain("<p>Hello</p>");
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("<a");
    expect(clean).not.toContain("<h3");
  });

  it("converts heading tags to paragraphs so size hierarchy cannot leak in", () => {
    const clean = sanitizeJobDescriptionHtml(
      '<h1 style="font-size:32px">Full job description</h1><h2>Position Details:</h2><p>Join the team.</p>'
    );
    expect(clean).toBe("<p>Full job description</p><p>Position Details:</p><p>Join the team.</p>");
  });

  it("decodes leftover &nbsp; entities so they are not shown as text", () => {
    const clean = sanitizeJobDescriptionHtml("<p>Lead&amp;nbsp;patient care.</p>");
    expect(clean).toContain("Lead patient care.");
    expect(clean).not.toContain("&nbsp;");
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

  it("includes MSP placementType when provided", () => {
    const parsed = generateJobDescriptionRequestSchema.parse({
      jobTitle: "CNA",
      sourceType: "MSP",
      placementType: "Recruit_and_Release",
    });
    expect(buildJobRequisitionJson(parsed).placementType).toBe("Recruit_and_Release");
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
    const prompt = buildJobDescriptionUserPrompt(parsed);
    expect(prompt).toContain("Keep the existing Internal behavior");
    expect(prompt).not.toContain("HTML lists are mandatory");
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

describe("ensureJobDescriptionBulletLists", () => {
  it("splits inline bullet characters into list items", async () => {
    const { ensureJobDescriptionBulletLists } = await import(
      "@/lib/jobs/job-description-html"
    );
    const html =
      "<p><strong>Key Responsibilities</strong></p><p>Provide personal care. • Support daily living. • Record vital signs.</p>";
    const next = ensureJobDescriptionBulletLists(html);
    expect(next).toContain("<ul>");
    expect(next).toContain("<li>Provide personal care.</li>");
    expect(next).toContain("<li>Support daily living.</li>");
    expect(next).toContain("<li>Record vital signs.</li>");
    expect(next).not.toContain("•");
  });

  it("leaves existing Internal-style ul lists unchanged", async () => {
    const { ensureJobDescriptionBulletLists } = await import(
      "@/lib/jobs/job-description-html"
    );
    const html =
      "<p><strong>Key Responsibilities</strong></p><ul><li>Assist patients</li><li>Document care</li></ul>";
    expect(ensureJobDescriptionBulletLists(html)).toBe(html);
  });
});
