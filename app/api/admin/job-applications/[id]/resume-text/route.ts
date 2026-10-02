import { NextRequest, NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { pickResumeForApplication } from "@/lib/jobs/match-analysis/pick-resume-for-application";
import { normalizeResumeWhitespace } from "@/lib/jobs/match-analysis/sanitize-resume";
import {
  emailChangeTarget,
  planExtractedResumeSave,
  type ContactFieldPatch,
} from "@/lib/jobs/match-analysis/candidate-contact-update";
import { stampQuestionSetsStale } from "@/lib/jobs/match-analysis/stage-questions";
import { syncApplicantProfileFromWorkerField } from "@/lib/admin/sync-applicant-profile-from-worker";
import {
  normalizeWorkerFieldValue,
  type WorkerProfileFieldKey,
} from "@/lib/admin/worker-profile-field-update";
import {
  findWorkerTenantEmailConflict,
  TENANT_EMAIL_TAKEN_MESSAGE,
} from "@/lib/tenant/tenant-email-uniqueness";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const PROFILE_FIELDS: Array<{
  patchKey: keyof ContactFieldPatch;
  field: WorkerProfileFieldKey;
}> = [
  { patchKey: "email", field: "email" },
  { patchKey: "phone", field: "phone" },
  { patchKey: "firstName", field: "first_name" },
  { patchKey: "lastName", field: "last_name" },
  { patchKey: "city", field: "city" },
  { patchKey: "state", field: "state" },
];

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const tenantId = await resolveStaffTenantId(supabase, auth).catch(() => null);
  if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

  const { id } = await context.params;
  const body = (await req.json().catch(() => ({}))) as { extractedText?: string };
  const extractedText = normalizeResumeWhitespace(String(body.extractedText ?? ""));
  if (!extractedText) {
    return NextResponse.json({ error: "Extracted text cannot be empty." }, { status: 400 });
  }

  const { data: application } = await supabase
    .from("job_applications")
    .select("id, worker_id, ai_match_stage, ai_match_status, ai_analysis")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const { data: resumeRows } = await supabase
    .from("worker_resumes")
    .select("id, job_application_id, extracted_text")
    .eq("tenant_id", tenantId)
    .eq("job_application_id", id)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false })
    .limit(5);
  const resume = pickResumeForApplication(resumeRows, id);
  if (!resume?.id) {
    return NextResponse.json({ error: "No résumé file found for this application." }, { status: 404 });
  }

  const workerId = typeof application.worker_id === "string" ? application.worker_id : null;
  const plan = planExtractedResumeSave({
    previousText: String(resume.extracted_text ?? ""),
    nextText: extractedText,
    workerId,
    stage: application.ai_match_stage,
    status: application.ai_match_status,
    analysis: application.ai_analysis,
  });

  if (plan.contactPatch.email && workerId) {
    const conflict = await findWorkerTenantEmailConflict(supabase, {
      tenantId,
      email: plan.contactPatch.email,
      excludeWorkerId: workerId,
    });
    const target = emailChangeTarget({
      currentWorkerId: workerId,
      conflictingWorkerId: conflict?.id ?? null,
    });
    if (target.action === "conflict") {
      return NextResponse.json(
        {
          error: TENANT_EMAIL_TAKEN_MESSAGE,
          stage: plan.stage,
          profileUpdated: false,
        },
        { status: 409 }
      );
    }
  }

  const { error } = await supabase
    .from("worker_resumes")
    .update({ extracted_text: extractedText, text_length: extractedText.length })
    .eq("id", resume.id)
    .eq("tenant_id", tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const profile: Record<string, string> = {};
  if (workerId && Object.keys(plan.contactPatch).length) {
    const workerPatch: Record<string, string> = { updated_at: new Date().toISOString() };
    for (const { patchKey, field } of PROFILE_FIELDS) {
      const raw = plan.contactPatch[patchKey];
      if (!raw) continue;
      const normalized = normalizeWorkerFieldValue(field, raw);
      if (!normalized.ok || typeof normalized.dbValue !== "string") continue;
      workerPatch[field] = normalized.dbValue;
      profile[field] = normalized.dbValue;
    }
    if (Object.keys(profile).length) {
      const { error: workerError } = await supabase
        .from("worker")
        .update(workerPatch)
        .eq("id", workerId)
        .eq("tenant_id", tenantId);
      if (workerError) return NextResponse.json({ error: workerError.message }, { status: 500 });
      for (const { field } of PROFILE_FIELDS) {
        if (!profile[field]) continue;
        try {
          await syncApplicantProfileFromWorkerField({
            supabase,
            tenantId,
            workerId,
            field,
            dbValue: profile[field],
          });
        } catch (syncErr) {
          console.warn("[resume-text] applicant_profiles sync failed", field, syncErr);
        }
      }
    }
  }

  const analysisRecord =
    application.ai_analysis &&
    typeof application.ai_analysis === "object" &&
    !Array.isArray(application.ai_analysis)
      ? (application.ai_analysis as Record<string, unknown>)
      : null;
  if (analysisRecord) {
    const stamped = stampQuestionSetsStale(analysisRecord, "resume");
    const { error: stampError } = await supabase
      .from("job_applications")
      .update({ ai_analysis: stamped, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (stampError) {
      console.warn("[resume-text] could not mark deep questions stale", stampError.message);
    }
  }

  void writeActivityLog({
    actorUserId: auth.devBypass ? null : auth.userId,
    action: "job_application.resume_text_corrected",
    entityType: "job_application",
    entityId: id,
    tenantId,
    request: req,
    metadata: {
      stage: plan.stage,
      profileFields: Object.keys(profile),
      resetStage: plan.resetStage,
    },
  });

  return NextResponse.json({
    ok: true,
    stage: plan.stage,
    workerId,
    profileUpdated: Object.keys(profile).length > 0,
    profile,
  });
}
