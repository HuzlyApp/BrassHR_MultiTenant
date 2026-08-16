import { z } from "zod";
import { EMPLOYMENT_TYPES } from "@/lib/jobs/types";

const optionalUuid = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    const trimmed = typeof value === "string" ? value.trim() : "";
    return trimmed || null;
  })
  .pipe(z.uuid().nullable());

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    const trimmed = typeof value === "string" ? value.trim() : "";
    return trimmed || null;
  });

export const workflowMappingInputSchema = z.object({
  id: z.uuid().optional(),
  professionId: optionalUuid,
  specialtyId: optionalUuid,
  employmentType: z.enum(EMPLOYMENT_TYPES),
  location: optionalText,
  locationType: optionalText,
  yearsOfExperience: optionalText,
  workflowId: z.uuid(),
  isActive: z.boolean().default(true),
  priority: z.number().int().min(0).max(10_000).default(100),
});

export const workflowResolveInputSchema = z.object({
  professionId: optionalUuid,
  specialtyId: optionalUuid,
  employmentType: z.enum(EMPLOYMENT_TYPES),
  location: optionalText,
  locationType: optionalText,
  yearsOfExperience: optionalText,
});
