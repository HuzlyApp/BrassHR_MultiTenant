import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { prepareResumeCandidate } from "@/lib/jobs/admin-add-candidate-from-resume";
import { JobValidationError } from "@/lib/jobs/types";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export type AdminResumeParsePreview = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobRole: string;
  location: string;
};

/** Parse a resume before the candidate is created, so the recruiter can review the names. */
export async function POST(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const limited = await enforceRateLimit(req, {
    namespace: "admin-parse-candidate-resume",
    key: getClientIp(req),
    limit: Number(process.env.RATE_LIMIT_AI_PER_HOUR ?? 20),
    windowMs: 60 * 60 * 1000,
    failClosed: true,
  });
  if (limited) return limited;

  try {
    const form = await req.formData();
    const resumeFile = form.get("resume");
    const file = resumeFile instanceof File && resumeFile.size > 0 ? resumeFile : null;
    const resumeText = String(form.get("resumeText") ?? "").trim();
    const resumeTitle = String(form.get("resumeTitle") ?? "").trim();

    if (!file && !resumeText) {
      return NextResponse.json(
        { error: "Please upload a resume file or paste resume text." },
        { status: 400 }
      );
    }

    const { parsed, qualityOk, qualityMessage } = await prepareResumeCandidate({
      resumeFile: file,
      resumeText: resumeText || null,
      resumeTitle: resumeTitle || null,
    });

    const preview: AdminResumeParsePreview = {
      firstName: parsed.first_name,
      lastName: parsed.last_name,
      email: parsed.email,
      phone: parsed.phone,
      jobRole: parsed.job_role,
      location: [parsed.city, parsed.state].map((part) => part.trim()).filter(Boolean).join(", "),
    };

    return NextResponse.json({
      ok: true,
      parsed: preview,
      qualityOk,
      warning: qualityOk ? null : qualityMessage,
    });
  } catch (error) {
    if (error instanceof JobValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("[admin/add-candidate-from-resume/parse]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse resume" },
      { status: 500 }
    );
  }
}
