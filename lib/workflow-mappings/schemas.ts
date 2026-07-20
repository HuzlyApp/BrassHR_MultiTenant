import { z } from "zod";
import { EMPLOYMENT_TYPES, PLACEMENT_TYPES } from "@/lib/jobs/types";

export const workflowMappingInputSchema = z.object({
  id: z.uuid().optional(),
  professionId: z.uuid(),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  placementType: z.enum(PLACEMENT_TYPES),
  workflowId: z.uuid(),
  isActive: z.boolean().default(true),
  priority: z.number().int().min(0).max(10_000).default(100),
});

export const workflowResolveInputSchema = z.object({
  professionId: z.uuid(),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  placementType: z.enum(PLACEMENT_TYPES),
});
