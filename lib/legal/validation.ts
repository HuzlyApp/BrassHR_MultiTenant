import { z } from "zod";

const sectionSchema = z.object({
  title: z.string().trim().min(1).max(300),
  paragraphs: z.array(z.string().trim().min(1).max(20000)).min(1).max(200),
});

export const legalDocumentKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9_-]{0,63}$/, "Use lowercase letters, numbers, underscores, or hyphens.");

export const legalDocumentAudienceSchema = z.enum(["all", "tenant", "worker", "applicant"]);

export const legalDocumentSectionsSchema = z.array(sectionSchema).min(1).max(100);

export const createLegalDocumentSchema = z.object({
  document_key: legalDocumentKeySchema.optional(),
  title: z.string().trim().min(1).max(200),
  last_updated_label: z.string().trim().max(200).nullable().optional(),
  audience: legalDocumentAudienceSchema.default("all"),
  sections: legalDocumentSectionsSchema,
  is_published: z.boolean().optional().default(true),
  sort_order: z.number().int().min(0).max(9999).optional(),
});

export const updateLegalDocumentSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  last_updated_label: z.string().trim().max(200).nullable().optional(),
  audience: legalDocumentAudienceSchema.optional(),
  sections: legalDocumentSectionsSchema.optional(),
  is_published: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
});

export type CreateLegalDocumentInput = z.infer<typeof createLegalDocumentSchema>;
export type UpdateLegalDocumentInput = z.infer<typeof updateLegalDocumentSchema>;
