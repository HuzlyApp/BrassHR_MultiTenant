import { z } from "zod";

export const sendCandidateEmailSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(500),
  body: z.string().min(1, "Message is required").max(50_000),
  bodyHtml: z.string().max(50_000).optional().nullable(),
});

export const sendCandidateSmsSchema = z.object({
  body: z.string().min(1, "Message is required").max(1600),
});
