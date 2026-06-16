import { z } from "zod";
import {
  APP_DATA_SOURCES,
  RECRUITER_TEMPLATE_CATEGORIES,
  RECRUITER_TEMPLATE_DESIGNATIONS,
  RECRUITER_TEMPLATE_FIELD_TYPES,
  RECRUITER_TEMPLATE_STATUSES,
  SIGNING_ROLE_KEYS,
} from "@/lib/recruiter-templates/constants";
import type { RecruiterTemplateRoleInput } from "@/lib/recruiter-templates/types";

const roleSchema = z.object({
  role_key: z.enum(SIGNING_ROLE_KEYS),
  label: z.string().trim().min(1).max(120),
  designation: z.enum(RECRUITER_TEMPLATE_DESIGNATIONS).default("Signer"),
  signing_order: z.number().int().min(1).max(20),
});

const fieldSchema = z.object({
  variable_name: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[a-z][a-z0-9_]*$/, "Use snake_case starting with a letter"),
  label: z.string().trim().min(1).max(200),
  field_type: z.enum(RECRUITER_TEMPLATE_FIELD_TYPES).default("text"),
  app_data_source: z.enum(APP_DATA_SOURCES),
  assigned_role_key: z.enum(SIGNING_ROLE_KEYS).nullable().optional(),
  required: z.boolean().default(false),
  sort_order: z.number().int().min(0).default(0),
});

export const saveRecruiterTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  category: z.enum(RECRUITER_TEMPLATE_CATEGORIES),
  expiration_hours: z.number().int().min(1).max(8760).default(168),
  roles: z.array(roleSchema).min(1).max(10),
  fields: z.array(fieldSchema).max(100).default([]),
  document_file_name: z.string().trim().max(255).nullable().optional(),
  document_storage_path: z.string().trim().max(500).nullable().optional(),
});

export type SaveRecruiterTemplatePayload = z.infer<typeof saveRecruiterTemplateSchema>;

export const listRecruiterTemplatesQuerySchema = z.object({
  status: z.enum(RECRUITER_TEMPLATE_STATUSES).optional(),
  category: z.enum(RECRUITER_TEMPLATE_CATEGORIES).optional(),
  search: z.string().trim().max(200).optional(),
});

export const createSigningRequestSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  recipients: z
    .array(
      z.object({
        template_user_id: z.string().uuid().optional(),
        order: z.number().int().min(1).optional(),
        first_name: z.string().trim().min(1).max(120),
        last_name: z.string().trim().max(120).optional(),
        email: z.string().email(),
      })
    )
    .min(1)
    .max(10),
});

export const syncRecruiterTemplateSchema = z.object({
  event: z.enum(["editor.saved", "editor.published", "editor.closed"]).optional(),
  firma_template_id: z.string().trim().min(1).optional(),
  updated_at: z.string().trim().optional(),
  draft: z.boolean().optional(),
});

export function validateRoleOrders(roles: RecruiterTemplateRoleInput[]): string[] {
  const issues: string[] = [];
  const orders = roles.map((r) => r.signing_order);
  const uniqueOrders = new Set(orders);
  if (uniqueOrders.size !== orders.length) {
    issues.push("Signing roles must have unique order values");
  }
  const keys = roles.map((r) => r.role_key);
  if (new Set(keys).size !== keys.length) {
    issues.push("Signing roles must have unique role keys");
  }
  return issues;
}

export function validateFieldMappings(
  fields: Array<{ variable_name: string; app_data_source: string; assigned_role_key?: string | null }>,
  roleKeys: Set<string>
): string[] {
  const issues: string[] = [];
  const vars = new Set<string>();
  for (const field of fields) {
    if (vars.has(field.variable_name)) {
      issues.push(`Duplicate variable name: ${field.variable_name}`);
    }
    vars.add(field.variable_name);
    if (field.assigned_role_key && !roleKeys.has(field.assigned_role_key)) {
      issues.push(
        `Field "${field.variable_name}" references unknown role "${field.assigned_role_key}"`
      );
    }
  }
  return issues;
}

export type PublishValidationResult = {
  ok: boolean;
  issues: string[];
};

export function validatePublishReady(input: {
  name: string;
  category: string;
  roles: RecruiterTemplateRoleInput[];
  fields: Array<{ variable_name: string; app_data_source: string; assigned_role_key?: string | null }>;
  document_storage_path?: string | null;
  firma_template_id?: string | null;
}): PublishValidationResult {
  const issues: string[] = [];

  if (!input.name.trim()) issues.push("Template name is required");
  if (!input.category) issues.push("Workflow type is required");
  if (input.roles.length === 0) issues.push("At least one signing role is required");
  issues.push(...validateRoleOrders(input.roles));

  const roleKeys = new Set(input.roles.map((r) => r.role_key));
  issues.push(...validateFieldMappings(input.fields, roleKeys));

  if (!input.firma_template_id && !input.document_storage_path) {
    issues.push("Upload a document before publishing");
  }

  return { ok: issues.length === 0, issues };
}

export function canPublish(input: Parameters<typeof validatePublishReady>[0]): boolean {
  return validatePublishReady(input).ok;
}
