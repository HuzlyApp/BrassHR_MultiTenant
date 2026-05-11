// lib/resumeSchema.ts
import { z } from "zod";
import type { ZodTypeAny } from "zod/v3";
import { zodToJsonSchema } from "zod-to-json-schema";

// ────────────────────────────────────────────────
// Main Zod schema for resume parsing
// ────────────────────────────────────────────────
export const ResumeSchema = z.object({
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  fullName: z.string().nullable().optional(),

  email: z.string().email().nullable().optional().or(z.literal("")),
  phone: z.string().nullable().optional(),

  address: z.string().nullable().optional(),
  address2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zipCode: z.string().nullable().optional(),

  jobRole: z.string().nullable().optional(),

  // Optional richer fields (expand as needed)
  summary: z.string().nullable().optional(),
  skills: z.array(z.string()).optional().default([]),

  experience: z
    .array(
      z.object({
        company: z.string().nullable(),
        position: z.string().nullable(),
        startDate: z.string().nullable(),
        endDate: z.string().nullable(),
        description: z.string().nullable(),
      })
    )
    .optional()
    .default([]),

  education: z
    .array(
      z.object({
        school: z.string().nullable(),
        degree: z.string().nullable(),
        field: z.string().nullable(),
        graduationYear: z.string().nullable(),
      })
    )
    .optional()
    .default([]),
});

// TypeScript type inferred from schema
export type ResumeData = z.infer<typeof ResumeSchema>;

// ────────────────────────────────────────────────
// Convert Zod schema → JSON Schema for Grok/OpenAI structured output
// ────────────────────────────────────────────────
// zod-to-json-schema types target zod/v3; Zod 4 schemas work at runtime.
export const resumeJsonSchema = zodToJsonSchema(ResumeSchema as unknown as ZodTypeAny, {
  target: "openApi3",          // best compatibility
  $refStrategy: "none",        // avoid $ref to keep it simple & flat
  definitionPath: "#/definitions", // optional, but clean
});
