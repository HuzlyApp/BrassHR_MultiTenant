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
- Write "About the Role" in the same polished, helpful style used for internal jobs: 2–3 flowing sentences that introduce the opportunity to a candidate.
- Ground that paragraph in the filled MSP source details (sourceJobTitle, sourceJobDetails, mspClient, facility, profession, specialty, employment type, location type, duration, specialRequirements, requiredCredentials when relevant).
- Prefer sourceJobTitle as the role name. Never use requisition IDs, job codes, or opaque labels (for example "RN - 100") as the role name when a real title, profession, or specialty is available.
- Weave details naturally (for example “part-time W2 home health assignment with [client] in [facility/location]”). Do not dump fields as a dry list of facts.
- Put duration and target start date primarily under Work Location and Schedule when those fields are supplied; mention duration briefly in About the Role only if it helps describe the assignment.
- Do not invent MSP client, facility, duration, credential, or assignment details that were not supplied.
- Other sections may still use shared job fields (profession, specialty, employment type, location type, benefits) when provided.

Internal source rules (when sourceType is "Internal" or omitted):
- Write "About the Role" from the standard job fields (title, profession, specialty, location, employment type, experience, and company/facility when supplied), as usual. Do not change this behavior.

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

  const mspAboutRoleGuidance = isMsp
    ? `
MSP About the Role guidance (required):
- sourceType is MSP.
- Write a helpful, candidate-facing "About the Role" (2–3 sentences), similar in quality to a strong internal job post.
- Open with the preferredRoleTitle (or sourceJobTitle / profession), not an ID or code.
- Naturally include what is supplied: assignment type (sourceJobDetails), client (mspClient), setting/facility, city/location, employment type, and work arrangement.
- Example tone (do not copy verbatim): "[Client] is seeking a [role] for a [assignment type] in [location]. This [employment type], [schedule/arrangement] opportunity supports [setting] care over a [duration] assignment."
- Do NOT write a dry field dump such as "[title] is a W2, part-time ... The assignment is scheduled for 8 weeks and has a target start date of ..."
- Place start date and fuller schedule/duration detail under Work Location and Schedule when available.
- Do not invent missing MSP source details.
`
    : `
Internal About the Role guidance:
- sourceType is Internal (or not MSP).
- Keep the existing Internal behavior: write "About the Role" from the standard job fields already supplied.
- Do not require or invent MSP source fields.
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
- Return valid JSON only.`;
}
