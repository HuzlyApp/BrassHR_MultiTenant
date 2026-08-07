import { z } from "zod";

const stringList = z
  .array(z.string().max(200))
  .max(40)
  .optional()
  .transform((value) =>
    (value ?? [])
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 40)
  );

const optionalTrimmed = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .optional()
  .transform((value) => {
    if (value == null) return undefined;
    const text = String(value).trim();
    if (!text) return undefined;
    return text.slice(0, 500);
  });

export const generateJobDescriptionRequestSchema = z
  .object({
    jobTitle: optionalTrimmed,
    profession: optionalTrimmed,
    specialty: optionalTrimmed,
    employmentType: optionalTrimmed,
    location: optionalTrimmed,
    locationType: optionalTrimmed,
    yearsOfExperience: optionalTrimmed,
    educationRequirements: optionalTrimmed,
    requiredSkills: stringList,
    preferredSkills: stringList,
    numberOfPositions: z
      .union([z.number(), z.string(), z.null(), z.undefined()])
      .optional()
      .transform((value) => {
        if (value == null || value === "") return undefined;
        const n = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(n) || n < 1) return undefined;
        return Math.min(Math.floor(n), 999);
      }),
    shiftOrSchedule: optionalTrimmed,
    benefits: stringList,
    responsibilities: optionalTrimmed,
    qualifications: optionalTrimmed,
    companyName: optionalTrimmed,
    department: optionalTrimmed,
    facility: optionalTrimmed,
    duration: optionalTrimmed,
    requiredCredentials: optionalTrimmed,
    specialRequirements: optionalTrimmed,
    additionalLocations: stringList,
    /** Internal vs MSP — changes how About the Role is written. */
    sourceType: z
      .union([z.literal("Internal"), z.literal("MSP"), z.string(), z.null(), z.undefined()])
      .optional()
      .transform((value) => {
        const raw = String(value ?? "").trim();
        if (raw.toLowerCase() === "msp") return "MSP" as const;
        if (raw.toLowerCase() === "internal") return "Internal" as const;
        return undefined;
      }),
    mspName: optionalTrimmed,
    mspClient: optionalTrimmed,
    sourceJobTitle: optionalTrimmed,
    sourceJobDetails: optionalTrimmed,
    targetStartDate: optionalTrimmed,
  })
  .superRefine((data, ctx) => {
    if (!data.jobTitle && !data.profession && !data.specialty && !data.sourceJobTitle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least a job title, profession, or specialty.",
        path: ["jobTitle"],
      });
    }
  });

export type GenerateJobDescriptionRequest = z.infer<
  typeof generateJobDescriptionRequestSchema
>;

export type GenerateJobDescriptionResult = {
  descriptionHtml: string;
  plainText: string;
  warnings: string[];
};

export const JOB_DESCRIPTION_GENERATE_ERROR =
  "We couldn’t generate a description right now. You can try again or enter it manually.";
