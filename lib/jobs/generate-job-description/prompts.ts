import type { GenerateJobDescriptionRequest } from "./schema";

export const JOB_DESCRIPTION_SYSTEM_PROMPT = `You are a professional HR job-description writer. Create an accurate, inclusive, concise, and appealing job description using only the supplied job information.

Do not invent compensation, benefits, certifications, schedules, company details, legal requirements, or responsibilities that were not supplied or reasonably implied by the job title.

Write in clear professional English. Avoid exaggerated marketing language, discriminatory wording, gendered language, and unnecessary repetition.

Target approximately 300–450 words.

Use these sections:

1. About the Role
2. Key Responsibilities
3. Required Qualifications
4. Preferred Qualifications, only when supported by the input
5. Work Location and Schedule, only when supplied
6. Benefits, only when supplied

Use short paragraphs and bullet points. Do not include introductory commentary such as ‘Here is the description.’

Wrap each section title in <strong> tags, for example: <p><strong>About the Role</strong></p>, <p><strong>Key Responsibilities</strong></p>, <p><strong>Required Qualifications</strong></p>, <p><strong>Work Location and Schedule</strong></p>, and <p><strong>Benefits</strong></p> when those sections are included. Do not bold the body text under each section.

MSP source rules (only when sourceType is "MSP"):
- Write "About the Role" as 2–3 candidate-facing sentences. Tailor the opening to placementType:
  - Recruit_and_Release / R&R: this is a contract assignment for the MSP client. The candidate works at the client/facility for the assignment period. Do not describe the tenant as the employer.
  - Recruit_and_EOR: the recruiting employer (tenant) hires the worker (W2 or 1099 when supplied) and assigns them to the MSP client/facility.
- Ground that paragraph in filled MSP details (sourceJobTitle, sourceJobDetails, mspClient, facility, profession, specialty, employment type, location type, duration, specialRequirements, requiredCredentials when relevant).
- Prefer sourceJobTitle as the role name. Never use requisition IDs, job codes, or opaque labels (for example "RN - 100") as the role name when a real title, profession, or specialty is available.
- Weave details naturally. Do not dump fields as a dry list of facts.
- Put duration and target start date primarily under Work Location and Schedule when those fields are supplied.
- HTML structure is required: after each list-section title, use a real <ul> with one <li> per item. Never put bullet characters (•) inside a single paragraph or on the same line as another item. Each responsibility, qualification, schedule fact, and benefit must be its own <li>.
- Example list markup: <p><strong>Key Responsibilities</strong></p><ul><li>Provide personal care.</li><li>Record vital signs.</li></ul>
- Work Location and Schedule: one <li> each for Location, Schedule, Duration, and Target start date when supplied.
- Do not invent MSP client, facility, duration, credential, or assignment details that were not supplied.

Internal source rules (when sourceType is "Internal" or omitted):
- Write "About the Role" from the standard job fields (title, profession, specialty, location, employment type, experience, and company/facility when supplied), as usual. Do not change this behavior.
- Keep the existing Internal HTML style. Do not apply MSP placement-type language.

Return valid JSON only with:

{
  "descriptionHtml": "sanitized HTML description",
  "plainText": "plain-text description",
  "warnings": ["missing or uncertain information"]
}`;

/** Compact requisition payload for the model (omit empty fields). */
export function buildJobRequisitionJson(
  input: GenerateJobDescriptionRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const put = (key: string, value: unknown) => {
    if (value == null) return;
    if (typeof value === "string" && !value.trim()) return;
    if (Array.isArray(value) && value.length === 0) return;
    payload[key] = value;
  };

  put("jobTitle", input.jobTitle);
  put("profession", input.profession);
  put("specialty", input.specialty);
  put("employmentType", input.employmentType);
  put("location", input.location);
  put("locationType", input.locationType);
  put("yearsOfExperience", input.yearsOfExperience);
  put("educationRequirements", input.educationRequirements);
  put("requiredSkills", input.requiredSkills);
  put("preferredSkills", input.preferredSkills);
  put("numberOfPositions", input.numberOfPositions);
  put("shiftOrSchedule", input.shiftOrSchedule);
  put("benefits", input.benefits);
  put("responsibilities", input.responsibilities);
  put("qualifications", input.qualifications);
  put("companyName", input.companyName);
  put("department", input.department);
  put("facility", input.facility);
  put("duration", input.duration);
  put("requiredCredentials", input.requiredCredentials);
  put("specialRequirements", input.specialRequirements);
  put("additionalLocations", input.additionalLocations);
  put("sourceType", input.sourceType);
  put("mspName", input.mspName);
  put("mspClient", input.mspClient);
  put("sourceJobTitle", input.sourceJobTitle);
  put("sourceJobDetails", input.sourceJobDetails);
  put("targetStartDate", input.targetStartDate);
  put("placementType", input.placementType);

  return payload;
}

function looksLikeOpaqueJobCode(value: string | undefined): boolean {
  const raw = value?.trim() ?? "";
  if (!raw) return false;
  // e.g. "RN - 100", "CNA-12", "Job 445"
  return /^(?:[a-z]{1,6}\s*[-#]?\s*)?\d{2,}$/i.test(raw) || /^[a-z]{1,8}\s*[-–—]\s*\d{2,}$/i.test(raw);
}

/** Prefer a human role title for MSP generation; avoid opaque codes. */
export function resolvePreferredJobTitle(
  input: GenerateJobDescriptionRequest
): string | undefined {
  const sourceTitle = input.sourceJobTitle?.trim();
  const jobTitle = input.jobTitle?.trim();
  const profession = input.profession?.trim();
  const specialty = input.specialty?.trim();

  if (input.sourceType === "MSP") {
    if (sourceTitle) return sourceTitle;
    if (jobTitle && !looksLikeOpaqueJobCode(jobTitle)) return jobTitle;
    if (specialty && profession) return `${profession} (${specialty})`;
    return profession || specialty || jobTitle || undefined;
  }

  return jobTitle || sourceTitle || undefined;
}

export function buildJobDescriptionUserPrompt(
  input: GenerateJobDescriptionRequest
): string {
  const preferredTitle = resolvePreferredJobTitle(input);
  const payload = {
    ...buildJobRequisitionJson(input),
    ...(preferredTitle ? { preferredRoleTitle: preferredTitle } : {}),
  };
  const requisitionJson = JSON.stringify(payload, null, 2);
  const isMsp = input.sourceType === "MSP";

  const placement = String(input.placementType ?? "").trim();
  const isRnr =
    /recruit_and_release/i.test(placement) ||
    /^r\s*&\s*r$/i.test(placement) ||
    /recruit\s*&\s*release/i.test(placement);
  const isEor =
    /recruit_and_eor/i.test(placement) ||
    /recruit\s*&\s*eor/i.test(placement) ||
    /eor/i.test(placement);

  const mspAboutRoleGuidance = isMsp
    ? `
MSP About the Role and HTML structure (required):
- sourceType is MSP. placementType is ${placement || "MSP assignment"}.
${
  isEor && !isRnr
    ? "- Recruit & EOR: the recruiting employer hires the worker (W2 or 1099 when supplied) and assigns them to the MSP client/facility. Write About the Role from that relationship."
    : "- Recruit & Release (R&R): this is a contract assignment for the MSP client. The candidate works at the client/facility for the assignment. Do not describe the tenant as the employer."
}
- Write a helpful, candidate-facing "About the Role" (2–3 sentences).
- Open with the preferredRoleTitle (or sourceJobTitle / profession), not an ID or code.
- Naturally include what is supplied: assignment type (sourceJobDetails), client (mspClient), setting/facility, city/location, employment type, and work arrangement.
- Do NOT write a dry field dump.
- Place start date and fuller schedule/duration detail under Work Location and Schedule when available.
- HTML lists are mandatory for Key Responsibilities, Required Qualifications, Preferred Qualifications, Work Location and Schedule, and Benefits:
  use <ul><li>Item</li><li>Next item</li></ul>. Never join items with "•" on one line. Each point must be its own <li> on its own row.
- Work Location and Schedule example:
  <ul><li>Location: Dallas, TX</li><li>Schedule: Days</li><li>Duration: 8 weeks</li></ul>
- Do not invent missing MSP source details.
`
    : `
Internal About the Role guidance:
- sourceType is Internal (or not MSP).
- Keep the existing Internal behavior: write "About the Role" from the standard job fields already supplied.
- Do not require or invent MSP source fields.
- Do not change the Internal description structure.
`;

  return `Create a suggested job description from the following job information:

${requisitionJson}
${mspAboutRoleGuidance}
Important requirements:
- Use only the supplied information.
- Keep the result concise.
- Do not add salary information.
- Do not add benefits that are not listed.
- Do not add licensing or certification requirements unless supplied or clearly mandatory for the stated profession.
- Mention the employment type and work arrangement naturally.
- Make section titles bold with <strong> (About the Role, Key Responsibilities, Required Qualifications, Work Location and Schedule, Benefits, etc.).
${isMsp ? "- For MSP jobs, every bullet must be a separate <li>. Do not put multiple points in one <p> separated by •.\n" : ""}- Return valid JSON only.`;
}
