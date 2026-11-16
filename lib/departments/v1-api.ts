import { NextResponse } from "next/server";
import { z } from "zod";

export const departmentCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(40).nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  parent_department_id: z.uuid().nullable().optional(),
}).strict();
export const departmentPatchSchema = departmentCreateSchema.partial()
  .extend({ is_active: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const departmentListSchema = z.object({
  include_inactive: z.enum(["true", "false"]).default("false"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export function departmentApiError(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  const status = code === "23505" ? 409 : ["23503", "23514", "VALIDATION_ERROR"].includes(code ?? "") ? 422 : 503;
  if (status === 503) console.error("[v1/departments]", error);
  const message = code === "23505" ? "A department with this name already exists"
    : code === "23503" ? "Parent department not found in tenant"
    : code === "23514" ? "Invalid department hierarchy or values"
    : code === "VALIDATION_ERROR" && error instanceof Error ? error.message : "Department data unavailable";
  return NextResponse.json({ error: message, code: status === 503 ? "DATA_UNAVAILABLE" : "INVALID_DEPARTMENT" }, { status });
}

export function invalidDepartment() {
  return NextResponse.json({ error: "Invalid department input", code: "VALIDATION_ERROR" }, { status: 422 });
}
