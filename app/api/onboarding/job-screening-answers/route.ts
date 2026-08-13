import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { normalizeJobToken } from "@/lib/jobs/public-application-routing";
import { startOrResumeJobApplication } from "@/lib/jobs/service";
import {
  loadApplicationScreeningContext,
  loadJobScreeningQuestions,
  upsertApplicationScreeningAnswers,
  type ApplicationScreeningAnswerInput,
} from "@/lib/jobs/screening-questions";
import { readOnboardingTenantSlugFromRequest, resolveOnboardingWorker } from "@/lib/onboarding/resolve-onboarding-worker";
import { resolvePublicTenant } from "@/lib/jobs/tenant";

export const runtime = "nodejs";

type Body = {
  applicantId?: string;
  tenantSlug?: string;
  jobToken?: string;
  answers?: ApplicationScreeningAnswerInput[];
};

export async function GET(req: NextRequest) {
  try {
    const applicantId = req.nextUrl.searchParams.get("applicantId")?.trim() ?? "";
    const jobToken = normalizeJobToken(req.nextUrl.searchParams.get("jobToken"));
    if (!applicantId || !jobToken) {
      return NextResponse.json({ error: "applicantId and jobToken are required" }, { status: 400 });
    }

    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const supabase = createClient(url, key);
    const tenantSlug =
      req.nextUrl.searchParams.get("tenantSlug")?.trim().toLowerCase() ||
      readOnboardingTenantSlugFromRequest(req);
    const ctx = await resolveOnboardingWorker(supabase, applicantId, tenantSlug);
    if (!ctx) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    const tenant = await resolvePublicTenant(supabase, tenantSlug);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { data: job, error: jobError } = await supabase
      .from("job_requisitions")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("public_job_token", jobToken)
      .maybeSingle();
    if (jobError) throw jobError;
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const application = await startOrResumeJobApplication(supabase, {
      tenantId: tenant.id,
      jobToken,
      applicantAuthUserId: applicantId,
      workerId: ctx.workerId,
    });

    const questions = await loadJobScreeningQuestions(supabase, tenant.id, String(job.id), {
      activeOnly: true,
    });
    const context = await loadApplicationScreeningContext(
      supabase,
      tenant.id,
      String(application.application.id),
      String(job.id)
    );

    return NextResponse.json({
      applicationId: application.application.id,
      jobId: job.id,
      questions: context.questions,
      hasQuestions: questions.length > 0,
      assessment: context.assessment,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load screening questions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const applicantId = typeof body.applicantId === "string" ? body.applicantId.trim() : "";
    const jobToken = normalizeJobToken(body.jobToken);
    const answers = Array.isArray(body.answers) ? body.answers : [];
    if (!applicantId || !jobToken) {
      return NextResponse.json({ error: "applicantId and jobToken are required" }, { status: 400 });
    }

    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const supabase = createClient(url, key);
    const tenantSlug =
      (typeof body.tenantSlug === "string" ? body.tenantSlug.trim().toLowerCase() : "") ||
      readOnboardingTenantSlugFromRequest(req);
    const ctx = await resolveOnboardingWorker(supabase, applicantId, tenantSlug);
    if (!ctx) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    const tenant = await resolvePublicTenant(supabase, tenantSlug);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { data: job, error: jobError } = await supabase
      .from("job_requisitions")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("public_job_token", jobToken)
      .maybeSingle();
    if (jobError) throw jobError;
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const application = await startOrResumeJobApplication(supabase, {
      tenantId: tenant.id,
      jobToken,
      applicantAuthUserId: applicantId,
      workerId: ctx.workerId,
    });

    const saved = await upsertApplicationScreeningAnswers(supabase, {
      tenantId: tenant.id,
      applicationId: String(application.application.id),
      jobId: String(job.id),
      answers: answers.filter(
        (item) => item && typeof item.questionId === "string" && item.questionId.trim()
      ),
    });

    const context = await loadApplicationScreeningContext(
      supabase,
      tenant.id,
      String(application.application.id),
      String(job.id)
    );

    return NextResponse.json({
      applicationId: application.application.id,
      questions: saved,
      assessment: context.assessment,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save screening answers" },
      { status: 500 }
    );
  }
}
