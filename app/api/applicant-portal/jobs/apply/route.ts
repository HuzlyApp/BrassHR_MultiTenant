import { NextRequest, NextResponse } from "next/server";
import { formatApiError } from "@/lib/api/format-api-error";
import { applyWorkerToJobWithResume } from "@/lib/applicant-portal/apply-worker-to-job";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";
import { JobValidationError } from "@/lib/jobs/types";
import { jobValidationServiceAreaResponse } from "@/lib/service-area/http";
import { parseServiceAreaLocation } from "@/lib/service-area/parse-location";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const body = (await req.json().catch(() => ({}))) as {
      jobToken?: string;
      workLocation?: unknown;
    };

    const result = await applyWorkerToJobWithResume(auth.supabase, {
      applicant: auth.applicant,
      authUserId: auth.user.id,
      jobToken: typeof body.jobToken === "string" ? body.jobToken : "",
      workLocation: parseServiceAreaLocation(body.workLocation),
    });

    return NextResponse.json({
      applicationId: result.applicationId,
      resumeId: result.resumeId,
      message: "Application submitted successfully.",
    });
  } catch (err) {
    if (err instanceof JobValidationError) {
      const serviceArea = jobValidationServiceAreaResponse(err, true);
      if (serviceArea) return serviceArea;
      const status = err.code === "ALREADY_APPLIED" ? 409 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error("[applicant-portal/jobs/apply:post]", err);
    return NextResponse.json({ error: formatApiError(err) }, { status: 500 });
  }
}
