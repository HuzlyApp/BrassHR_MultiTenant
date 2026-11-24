import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { loadTenantFeatures, EditionFeatureError } from "@/lib/tenant/edition-features";
import { SchedulingError } from "./v1-contract";

export type ScheduleValidationHint = {
  /** Required query/body fields for this endpoint. */
  required?: string[];
  /** Optional filters callers may pass. */
  optional?: string[];
  /** Concrete URL or JSON example that satisfies the contract. */
  example?: string;
};

type ZodLikeError = Pick<ZodError, "issues"> | null | undefined;

function issueEntries(error: ZodLikeError) {
  return (error?.issues ?? []).map((issue) => ({
    field: issue.path.map(String).join(".") || undefined,
    message: issue.message,
  }));
}

/** Shared 422 body so browser/API clients know which params are required. */
export function validationErrorResponse(
  defaultMessage: string,
  error?: ZodLikeError,
  hint?: ScheduleValidationHint,
) {
  const issues = issueEntries(error);
  const detail =
    issues.length === 0
      ? null
      : issues
          .map((issue) => (issue.field ? `${issue.field}: ${issue.message}` : issue.message))
          .join("; ");
  const requiredLine =
    hint?.required?.length ? `Required: ${hint.required.join(", ")}` : null;
  const message = [defaultMessage, requiredLine, detail].filter(Boolean).join(". ");

  return NextResponse.json(
    {
      error: message,
      code: "VALIDATION_ERROR" as const,
      ...(hint?.required?.length ? { required: hint.required } : {}),
      ...(hint?.optional?.length ? { optional: hint.optional } : {}),
      ...(hint?.example ? { example: hint.example } : {}),
      ...(issues.length ? { issues } : {}),
    },
    { status: 422 },
  );
}

export function schedulingError(error: unknown) {
  if (error instanceof SchedulingError || error instanceof EditionFeatureError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  const code = (error as { code?: string } | null)?.code;
  if (["23503", "23514", "23505", "P0002"].includes(code ?? "")) {
    const status = code === "23505" ? 409 : code === "P0002" ? 404 : 422;
    return NextResponse.json({ error: status === 409 ? "Record already exists" : status === 404 ? "Shift not found" : "Invalid schedule reference, dates or assignment",
      code: status === 409 ? "CONFLICT" : status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR" }, { status });
  }
  console.error("[v1/scheduling]", error);
  return NextResponse.json({ error: "Schedule data unavailable", code: "DATA_UNAVAILABLE" }, { status: 503 });
}

export function invalidSchedule(error?: ZodLikeError, hint?: ScheduleValidationHint) {
  return validationErrorResponse("Invalid scheduling input", error, hint);
}

/** Timesheet/clock routes — same guidance shape, domain-specific default message. */
export function invalidTimeInput(error?: ZodLikeError, hint?: ScheduleValidationHint) {
  return validationErrorResponse("Invalid timesheet input", error, hint);
}

export async function requireSchedulingContext(request: Request, checkSchedulingFeature = true) {
  const auth = await requireStaffApiSession(request);
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) throw new SchedulingError("Supabase not configured", "DATA_UNAVAILABLE", 503);
  const tenantId = await resolveStaffTenantId(supabase, auth);
  if (!tenantId) throw new SchedulingError("No authorized tenant selected", "TENANT_REQUIRED", 403);
  const resolved = await loadTenantFeatures(supabase, tenantId);
  if (checkSchedulingFeature && !resolved.features.internal_scheduling && !resolved.features.manage_clients) {
    throw new SchedulingError("Scheduling is disabled for this tenant", "FEATURE_DISABLED", 403);
  }
  return { auth, supabase, tenantId, ...resolved };
}
