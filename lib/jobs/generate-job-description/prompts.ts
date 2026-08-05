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

  return payload;
}

export function buildJobDescriptionUserPrompt(
  input: GenerateJobDescriptionRequest
): string {
  const requisitionJson = JSON.stringify(buildJobRequisitionJson(input), null, 2);
  return `Create a suggested job description from the following job information:

${requisitionJson}

Important requirements:
- Use only the supplied information.
- Keep the result concise.
- Do not add salary information.
- Do not add benefits that are not listed.
- Do not add licensing or certification requirements unless supplied or clearly mandatory for the stated profession.
- Mention the employment type and work arrangement naturally.
- Return valid JSON only.`;
}
