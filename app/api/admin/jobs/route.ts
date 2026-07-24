import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { JobValidationError } from "@/lib/jobs/types";
import { jobMutationSchema } from "@/lib/jobs/validation";
import {
  closeExpiredPublishedJobs,
  listInternalJobs,
  publishExistingJob,
  saveJobRequisition,
  transitionJobStatus,
} from "@/lib/jobs/service";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

function formatApiError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const record = error as { message?: unknown; details?: unknown; hint?: unknown };
    const parts = [record.message, record.details, record.hint]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter(Boolean);
    if (parts.length) return parts.join(" — ");
  }
  return fallback;
}

export async function GET(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

    await closeExpiredPublishedJobs(supabase, tenantId, auth.userId);

    const status = req.nextUrl.searchParams.get("status") || undefined;
    const jobs = await listInternalJobs(supabase, tenantId, {
      status:
        status === "draft" ||
        status === "published" ||
        status === "closed" ||
        status === "archived"
          ? status
          : undefined,
      professionId: req.nextUrl.searchParams.get("professionId") || undefined,
      employmentType: req.nextUrl.searchParams.get("employmentType") || undefined,
      createdBy: req.nextUrl.searchParams.get("createdBy") || undefined,
    });
    return NextResponse.json({ jobs, tenantId });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Failed to load jobs") },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const raw = await req.json().catch(() => null);
  const rawRecord = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const action = typeof rawRecord.action === "string" ? rawRecord.action : "";
  const jobId = typeof rawRecord.jobId === "string" ? rawRecord.jobId.trim() : "";

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

    if (
      (action === "unpublish" || action === "close" || action === "archive") &&
      !jobId
    ) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    const hasJobPayload = rawRecord.job != null && typeof rawRecord.job === "object";

    // List-page republish: action=publish + jobId, no job body.
    // Create/edit "Save and Publish": action=publish + job body (+ optional jobId).
    if (action === "publish" && !hasJobPayload) {
      if (!jobId) {
        return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
      }
      const result = await publishExistingJob(supabase, tenantId, auth.userId, jobId);
      return NextResponse.json({ job: result });
    }

    if (action === "unpublish" || action === "close" || action === "archive") {
      const status = action === "unpublish" ? "draft" : action === "close" ? "closed" : "archived";
      const result = await transitionJobStatus(supabase, tenantId, auth.userId, jobId, status);
      return NextResponse.json({ job: result });
    }

    const parsed = jobMutationSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid job requisition", fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await saveJobRequisition(supabase, tenantId, auth.userId, parsed.data.job, {
      jobId: jobId || undefined,
      publish: parsed.data.action === "publish",
      confirmRoutingChange: rawRecord.confirmRoutingChange === true,
    });
    return NextResponse.json(result, { status: jobId ? 200 : 201 });
  } catch (error) {
    if (error instanceof JobValidationError) {
      return NextResponse.json(
        { error: error.message, code: error.code, fieldErrors: error.fieldErrors },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: formatApiError(error, "Failed to save job") },
      { status: 500 }
    );
  }
}
