import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { resolveWorkerOnboardingEntry } from "@/lib/onboarding/resolve-worker-onboarding-entry";
import { resolveJobApplicationEntry } from "@/lib/job-requisitions/resolve-job-application-entry";

export const runtime = "nodejs";

/** Resolve the first applicant onboarding step for a tenant or job-specific apply link. */
export async function GET(req: NextRequest) {
  const tenant = req.nextUrl.searchParams.get("tenant");
  const jobId = req.nextUrl.searchParams.get("job_id");
  const jobToken = req.nextUrl.searchParams.get("job_token");

  if (jobId || jobToken) {
    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }
    const supabase = createClient(url, key);
    const result = await resolveJobApplicationEntry({
      supabase,
      tenantSlug: tenant ?? "",
      jobId,
      jobToken,
    });

    if (result.kind === "redirect") {
      return NextResponse.json({
        url: result.url,
        tenantSlug: result.tenantSlug,
        jobRequisitionId: result.jobRequisitionId,
        workflowTemplateId: result.workflowTemplateId,
      });
    }

    const status =
      result.code === "JOB_REQUIRED"
        ? 400
        : result.code === "JOB_INACTIVE" || result.code === "JOB_NO_WORKFLOW"
          ? 403
          : 404;

    return NextResponse.json(
      { code: result.code, message: result.message, tenantSlug: result.tenantSlug },
      { status }
    );
  }

  const result = await resolveWorkerOnboardingEntry(tenant);

  if (result.kind === "redirect") {
    return NextResponse.json({ url: result.url, tenantSlug: result.tenantSlug });
  }

  const status =
    result.code === "TENANT_REQUIRED" ? 400 : result.code === "NOT_PUBLISHED" ? 403 : 404;

  return NextResponse.json(
    { code: result.code, message: result.message, tenantSlug: result.tenantSlug },
    { status }
  );
}
