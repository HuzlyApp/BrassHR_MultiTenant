import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import {
  readOnboardingTenantSlugFromRequest,
} from "@/lib/onboarding/resolve-onboarding-worker";
import { submitOnboardingApplication } from "@/lib/onboarding/submit-onboarding-application";

export const runtime = "nodejs";

type Body = {
  applicantId?: string;
  tenantSlug?: string;
  jobApplicationId?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const applicantId = typeof body.applicantId === "string" ? body.applicantId.trim() : "";
    const tenantSlug =
      (typeof body.tenantSlug === "string" ? body.tenantSlug.trim().toLowerCase() : "") ||
      readOnboardingTenantSlugFromRequest(req) ||
      "";

    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const supabase = createClient(url, key);
    const result = await submitOnboardingApplication(supabase, { applicantId, tenantSlug });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const jobApplicationId =
      typeof body.jobApplicationId === "string" ? body.jobApplicationId.trim() : "";
    if (jobApplicationId) {
      const submittedAt = result.submittedAt ?? new Date().toISOString();
      const { data: application, error: applicationError } = await supabase
        .from("job_applications")
        .update({ status: "submitted", submitted_at: submittedAt })
        .eq("id", jobApplicationId)
        .eq("applicant_auth_user_id", applicantId)
        .select("id, applicant_workflow_instance_id, tenant_id")
        .single();
      if (applicationError) {
        return NextResponse.json({ error: "Could not submit the selected job application." }, { status: 409 });
      }
      if (application.applicant_workflow_instance_id) {
        const { error: workflowError } = await supabase
          .from("applicant_workflow_instances")
          .update({ status: "completed", completed_at: submittedAt })
          .eq("id", application.applicant_workflow_instance_id)
          .eq("tenant_id", application.tenant_id);
        if (workflowError) throw workflowError;
      }
    }

    return NextResponse.json({
      ok: true,
      submittedAt: result.submittedAt,
      submittedWithIncompleteSteps: result.submittedWithIncompleteSteps,
      incompleteStepKeys: result.incompleteStepKeys,
      applicationStatus: result.applicationStatus,
      progress: result.progress,
    });
  } catch (err: unknown) {
    console.error("[onboarding/submit]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
