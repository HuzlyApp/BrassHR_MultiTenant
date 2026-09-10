import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { adminAddCandidateFromResume } from "@/lib/jobs/admin-add-candidate-from-resume";
import { JobValidationError } from "@/lib/jobs/types";
import { jobValidationServiceAreaResponse } from "@/lib/service-area/http";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { enforceRateLimit, envRateLimit } from "@/lib/security/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

/** Same bulk-load path as parse preview. Override with env. */
const CREATE_LIMIT = envRateLimit("RATE_LIMIT_ADMIN_ADD_CANDIDATE_PER_HOUR", 400);

function formatApiError(error: unknown, fallback: string): string {
  if (error instanceof JobValidationError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const limited = await enforceRateLimit(req, {
    namespace: "admin-add-candidate-from-resume.v2",
    key: auth.userId,
    limit: CREATE_LIMIT,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) {
    const retryAfterSec = Number(limited.headers.get("Retry-After") ?? 3600);
    const seconds = Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec : 3600;
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    return NextResponse.json(
      {
        error: `Too many candidate uploads right now. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      },
      { status: 429, headers: limited.headers }
    );
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
    }

    const form = await req.formData();
    const jobRequisitionId = String(form.get("jobId") ?? form.get("jobRequisitionId") ?? "").trim();
    const resumeText = String(form.get("resumeText") ?? "").trim();
    const resumeTitle = String(form.get("resumeTitle") ?? "").trim();
    const firstName = String(form.get("firstName") ?? "").trim();
    const lastName = String(form.get("lastName") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const workCity = String(form.get("workCity") ?? "").trim();
    const workState = String(form.get("workState") ?? "").trim();
    const workPostalCode = String(form.get("workPostalCode") ?? "").trim();
    const relocateToJobSite = String(form.get("relocateToJobSite") ?? "") === "true";
    const resumeFile = form.get("resume");
    const file = resumeFile instanceof File && resumeFile.size > 0 ? resumeFile : null;

    if (!jobRequisitionId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }
    if (!file && !resumeText) {
      return NextResponse.json(
        { error: "Please upload a resume file or paste resume text." },
        { status: 400 }
      );
    }

    const result = await adminAddCandidateFromResume(supabase, {
      tenantId,
      jobRequisitionId,
      staffUserId: auth.devBypass ? null : auth.userId,
      resumeFile: file,
      resumeText: file ? null : resumeText || null,
      resumeTitle: resumeTitle || null,
      firstName: firstName || null,
      lastName: lastName || null,
      email: email || null,
      phone: phone || null,
      workCity: workCity || null,
      workState: workState || null,
      workPostalCode: workPostalCode || null,
      relocateToJobSite,
    });

    return NextResponse.json(
      {
        ok: true,
        applicationId: result.applicationId,
        applicantProfileId: result.applicantProfileId,
        jobTitle: result.jobTitle,
        candidateName: result.candidateName,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof JobValidationError) {
      const serviceArea = jobValidationServiceAreaResponse(error);
      if (serviceArea) return serviceArea;
      return NextResponse.json(
        { error: formatApiError(error, "Failed to add candidate from resume") },
        { status: error.code === "ALREADY_APPLIED" ? 409 : 400 }
      );
    }
    console.error("[admin/add-candidate-from-resume]", error);
    return NextResponse.json(
      { error: formatApiError(error, "Failed to add candidate from resume") },
      { status: 500 }
    );
  }
}
