import { NextRequest, NextResponse } from "next/server";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";
import { assertApplicantApplication, importApplicantApplicationResume } from "@/lib/applicant-portal/application-resume";
import { reuploadWorkerResumeForApplicant, uploadWorkerResumeForApplicant } from "@/lib/applicant-portal/worker-resume-service";
import { isResumeUploadValidationError } from "@/lib/resume/validate-resume-upload";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;
    const { id } = await context.params;
    const form = await req.formData();
    const resumeId = form.get("resumeId");
    const file = form.get("file");
    if (typeof resumeId === "string" && resumeId.trim() && !(file instanceof File)) {
      const result = await importApplicantApplicationResume(auth.supabase, auth.applicant, auth.user.id, id, resumeId.trim());
      return NextResponse.json(result);
    }
    if (!(file instanceof File) || resumeId) {
      return NextResponse.json({ error: "Choose a new file or one saved resume." }, { status: 400 });
    }
    await assertApplicantApplication(auth.supabase, auth.applicant, id);
    const { data: current, error } = await auth.supabase.from("worker_resumes").select("id")
      .eq("worker_id", auth.applicant.id).eq("tenant_id", auth.applicant.tenant_id)
      .eq("job_application_id", id).is("deleted_at", null)
      .order("uploaded_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    const result = current
      ? await reuploadWorkerResumeForApplicant(auth.supabase, auth.applicant, auth.user.id, current.id, file, id)
      : await uploadWorkerResumeForApplicant(auth.supabase, auth.applicant, auth.user.id, file, id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[applicant-portal/application-resume]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update resume." },
      { status: isResumeUploadValidationError(error) ? 400 : 500 });
  }
}
