import OpenAI from "openai";
import { ensureBulletListHtml } from "@/lib/jobs/job-description-html";
import { extractJsonObjectFromModelText } from "@/lib/resumeParseQuality";

export const GROK_JOB_DESCRIPTION_MODEL =
  process.env.XAI_JOB_DESCRIPTION_MODEL?.trim() || "grok-4-fast";

export type JobDescriptionAiContext = {
  roleAbout: string;
  tone: string;
  focusAreas: string[];
  /** When true, ground generation in filled create-job form fields. */
  useJobPostFields?: boolean;
  jobTitle?: string;
  professionName?: string;
  specialtyName?: string;
  employmentType?: string;
  location?: string;
  locationType?: string;
  yearsOfExperience?: string;
  benefits?: string[];
  compensationType?: string;
  currency?: string;
  showPayBy?: string;
  payRatePeriod?: string;
  payRateMin?: number | null;
  payRateMax?: number | null;
  duration?: string;
  shiftType?: string;
  facility?: string;
  department?: string;
  requiredCredentials?: string;
  specialRequirements?: string;
  numberOfPositions?: number | null;
  applicationDeadline?: string;
};

export type GeneratedJobDescription = {
  /** Structured About the Role (+ optional Qualifications/Benefits headings) for Job Description. */
  descriptionHtml: string;
  /** Key Responsibilities list for Job Responsibilities. */
  responsibilitiesHtml: string;
  qualificationsHtml: string;
  benefitsHtml: string;
  /** Full structured HTML with all four sections. */
  combinedHtml: string;
};

let client: OpenAI | null = null;

function getGrokClient(): OpenAI {
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("XAI_API_KEY is not configured.");
  }
  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL: process.env.GROK_BASE_URL?.trim() || "https://api.x.ai/v1",
    });
  }
  return client;
}

function sanitizeJobHtml(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";

  let html = trimmed
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/javascript:/gi, "");

  html = html.replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (match, tagName: string) => {
    const tag = tagName.toLowerCase();
    const allowed = new Set(["p", "ul", "ol", "li", "strong", "b", "em", "i", "br", "h1", "h2", "h3", "h4"]);
    if (!allowed.has(tag)) return "";
    if (tag === "br") return "<br>";
    const isClose = match.startsWith("</");
    return isClose ? `</${tag}>` : `<${tag}>`;
  });

  const plain = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, "")
    .trim();
  if (!plain) return "";
  return html;
}

function plainTextToParagraphHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function benefitsListHtml(benefits: string[]): string {
  const items = benefits.map((b) => b.trim()).filter(Boolean);
  if (!items.length) return "";
  return `<ul>${items.map((item) => `<li>${escapeText(item)}</li>`).join("")}</ul>`;
}

function sectionBlock(title: string, bodyHtml: string): string {
  const body = bodyHtml.trim();
  if (!body) return "";
  return `<p><strong>${escapeText(title)}</strong></p>${body}`;
}

function buildSystemPrompt(input: JobDescriptionAiContext): string {
  const useForm = Boolean(input.useJobPostFields);
  return `
You are an expert healthcare recruiting copywriter.

Write a compelling job description for a staffing/HR platform.

Return JSON ONLY (no markdown fences, no commentary) with this schema:
{
  "aboutTheRoleHtml": "<p>...</p>",
  "responsibilitiesHtml": "<ul><li>...</li></ul>",
  "qualificationsHtml": "<ul><li>...</li></ul>",
  "benefitsHtml": "<ul><li>...</li></ul>"
}

HTML rules:
- Use only these tags: p, ul, ol, li, strong, em, b, i, br
- aboutTheRoleHtml: 2–4 short paragraphs (About the Role). Use separate <p> tags; do not insert blank spacer paragraphs between them.
- responsibilitiesHtml: 5–8 concrete bullet responsibilities inside a real <ul><li>…</li></ul> (Key Responsibilities). Never return plain sentences without <li>.
- qualificationsHtml: 4–7 bullet qualifications inside a real <ul><li>…</li></ul>. Never return plain sentences without <li>.
- benefitsHtml: bullet list of benefits inside <ul><li>…</li></ul> — ONLY when real benefits are provided in the user prompt; otherwise return an empty string
- Match the requested tone
- Emphasize selected focus areas naturally (do not dump them as a keyword list)
- Do not invent salary, unrealistic credentials, or benefits that were not provided
- Always use proper HTML lists (<ul>/<li>) for responsibilities, qualifications, and benefits so bullet points render on job detail pages
${
  useForm
    ? `- The user enabled "generate as per job post filled fields". Ground About the Role, Key Responsibilities, and Qualifications in the provided job post fields. Prefer factual details from the form over generic filler.`
    : `- Use the primary role description and focus areas as the main source.`
}
`.trim();
}

function buildUserPrompt(input: JobDescriptionAiContext): string {
  const lines = [
    `Tone: ${input.tone || "Professional"}`,
    `Use job post filled fields: ${input.useJobPostFields ? "yes" : "no"}`,
    `Primary role about: ${input.roleAbout.trim() || "(not provided)"}`,
    `Focus areas: ${input.focusAreas.length ? input.focusAreas.join(", ") : "General clinical excellence"}`,
  ];

  const push = (label: string, value?: string | number | null) => {
    if (value == null) return;
    const text = String(value).trim();
    if (!text) return;
    lines.push(`${label}: ${text}`);
  };

  if (input.useJobPostFields) {
    push("Job title", input.jobTitle);
    push("Profession", input.professionName);
    push("Specialty", input.specialtyName);
    push("Employment type", input.employmentType);
    push("Location", input.location);
    push("Location type", input.locationType);
    push("Years of experience", input.yearsOfExperience);
    push("Duration", input.duration);
    push("Job / shift type", input.shiftType);
    push("Facility", input.facility);
    push("Department", input.department);
    push("Required credentials", input.requiredCredentials);
    push("Special requirements", input.specialRequirements);
    push("Number of positions", input.numberOfPositions);
    push("Application deadline", input.applicationDeadline);
    push("Compensation type", input.compensationType);
    push("Currency", input.currency);
    push("Show pay by", input.showPayBy);
    push("Pay rate period", input.payRatePeriod);
    if (input.payRateMin != null || input.payRateMax != null) {
      lines.push(
        `Pay range: ${input.payRateMin ?? "—"} to ${input.payRateMax ?? "—"}`
      );
    }
  } else {
    // Still send light context when available.
    push("Job title", input.jobTitle);
    push("Profession", input.professionName);
    push("Specialty", input.specialtyName);
    push("Employment type", input.employmentType);
    push("Location", input.location);
  }

  if (input.benefits?.length) {
    lines.push(`Filled benefits (use ONLY these for benefitsHtml): ${input.benefits.join(", ")}`);
  } else {
    lines.push("Filled benefits: (none — return empty benefitsHtml)");
  }

  return lines.join("\n");
}

function pickHtml(
  parsed: Record<string, unknown> | null,
  htmlKey: string,
  plainKey: string
): string {
  const htmlVal = parsed?.[htmlKey];
  const plainVal = parsed?.[plainKey];
  if (typeof htmlVal === "string") return sanitizeJobHtml(htmlVal);
  if (typeof plainVal === "string") return sanitizeJobHtml(plainTextToParagraphHtml(plainVal));
  return "";
}

export async function generateJobDescriptionWithGrok(
  input: JobDescriptionAiContext
): Promise<GeneratedJobDescription> {
  const roleAbout = input.roleAbout.trim();
  const hasFormAnchor =
    Boolean(input.useJobPostFields) &&
    Boolean(
      input.jobTitle?.trim() ||
        input.professionName?.trim() ||
        input.specialtyName?.trim() ||
        input.location?.trim()
    );

  if (roleAbout.length < 12 && !hasFormAnchor) {
    throw new Error("Please describe the primary role in a bit more detail.");
  }

  const filledBenefits = (input.benefits ?? []).map((b) => b.trim()).filter(Boolean);
  // Prefer deterministic benefits list from form when present.
  const formBenefitsHtml = benefitsListHtml(filledBenefits);

  const completion = await getGrokClient().chat.completions.create({
    model: GROK_JOB_DESCRIPTION_MODEL,
    temperature: 0.6,
    messages: [
      { role: "system", content: buildSystemPrompt(input) },
      { role: "user", content: buildUserPrompt({ ...input, roleAbout }) },
    ],
  });

  const content = completion.choices?.[0]?.message?.content || "";
  const parsed = extractJsonObjectFromModelText(content) as Record<string, unknown> | null;

  let aboutHtml = pickHtml(parsed, "aboutTheRoleHtml", "aboutTheRole");
  if (!aboutHtml) {
    aboutHtml = pickHtml(parsed, "jobSummaryHtml", "jobSummary");
  }

  let responsibilitiesHtml = ensureBulletListHtml(
    pickHtml(parsed, "responsibilitiesHtml", "responsibilities")
  );
  let qualificationsHtml = ensureBulletListHtml(
    pickHtml(parsed, "qualificationsHtml", "qualifications")
  );
  let benefitsHtml = formBenefitsHtml || pickHtml(parsed, "benefitsHtml", "benefits");

  // Never invent benefits when form has none.
  if (!filledBenefits.length) {
    benefitsHtml = "";
  } else {
    benefitsHtml = formBenefitsHtml;
  }
  if (benefitsHtml) {
    benefitsHtml = ensureBulletListHtml(benefitsHtml);
  }

  if (!aboutHtml && !responsibilitiesHtml && content.trim()) {
    aboutHtml = sanitizeJobHtml(
      plainTextToParagraphHtml(content.replace(/```[\s\S]*?```/g, "").trim())
    );
  }

  if (!aboutHtml && !responsibilitiesHtml && !qualificationsHtml) {
    throw new Error("AI did not return a usable job description. Please try again.");
  }

  const combinedHtml = [
    sectionBlock("About the Role", aboutHtml),
    sectionBlock("Key Responsibilities", responsibilitiesHtml),
    sectionBlock("Qualifications", qualificationsHtml),
    sectionBlock("Benefits", benefitsHtml),
  ]
    .filter(Boolean)
    .join("");

  // Job Description editor: About + Qualifications + Benefits (and Key Responsibilities heading for full structure).
  const descriptionHtml = [
    sectionBlock("About the Role", aboutHtml),
    sectionBlock("Key Responsibilities", responsibilitiesHtml),
    sectionBlock("Qualifications", qualificationsHtml),
    sectionBlock("Benefits", benefitsHtml),
  ]
    .filter(Boolean)
    .join("");

  return {
    descriptionHtml,
    responsibilitiesHtml,
    qualificationsHtml,
    benefitsHtml,
    combinedHtml,
  };
}
