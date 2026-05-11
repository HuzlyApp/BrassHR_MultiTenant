import { z } from "zod";

export const ResumeSchema = z.object({
  full_name: z.string().nullable(),
  email: z.string().email().nullable().or(z.literal("")),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  linkedin: z.string().url().nullable().or(z.literal("")),
  github: z.string().url().nullable().or(z.literal("")),

  summary: z.string().nullable(), // professional summary

  skills: z.array(z.string()).default([]),

  experience: z
    .array(
      z.object({
        company: z.string(),
        position: z.string(),
        start_date: z.string().nullable(), // "Jan 2022" or "2020–2022"
        end_date: z.string().nullable(),
        location: z.string().nullable(),
        description: z.string().nullable(), // bullet points joined or raw
        achievements: z.array(z.string()).optional(),
      })
    )
    .default([]),

  education: z
    .array(
      z.object({
        institution: z.string(),
        degree: z.string(),
        field: z.string().nullable(),
        start_date: z.string().nullable(),
        end_date: z.string().nullable(),
        gpa: z.string().nullable(),
      })
    )
    .default([]),

  certifications: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),

  // optional raw fallback if parsing fails partially
  raw_text_excerpt: z.string().optional(),
});

export type ResumeData = z.infer<typeof ResumeSchema>;