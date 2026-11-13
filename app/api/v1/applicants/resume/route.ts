import { NextRequest, NextResponse } from "next/server";
import { auditInboundApiCall, requireInboundApiAuth } from "@/lib/integrations/auth";
import { uploadInboundApplicantResume } from "@/lib/integrations/applicants";
import { integrationError } from "@/lib/integrations/http";
import { JobValidationError } from "@/lib/jobs/types";

export const runtime = "nodejs";
export const maxDuration = 180;

function mapResumeError(error: unknown): NextResponse {
  if (error instanceof JobValidationError) {
    const details = Object.entries(error.fieldErrors ?? {}).map(([field, message]) => ({
      field,
      message: String(message),
    }));
    if (error.code === "PAYLOAD_TOO_LARGE") {
      return integrationError(413, "PAYLOAD_TOO_LARGE", error.message, details);
    }
    if (error.code === "UNPROCESSABLE") {
      return integrationError(422, "UNPROCESSABLE", error.message, details);
    }
    if (error.code === "NOT_FOUND") {
      return integrationError(404, "NOT_FOUND", error.message, details);
    }
    return integrationError(400, "VALIDATION_ERROR", error.message, details);
  }
  console.error("[api/v1/applicants/resume]", error);
  return integrationError(
    500,
    "INTERNAL",
    "Failed to process resume"
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireInboundApiAuth(req, { kind: "write" });
  if (auth instanceof NextResponse) return auth;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    auditInboundApiCall({
      req,
      auth,
      action: "inbound_api.applicants.resume",
      entityType: "applicant",
      outcome: "failure",
      metadata: { reason: "invalid_multipart" },
    });
    return integrationError(400, "VALIDATION_ERROR", "Content-Type must be multipart/form-data");
  }

  const fileValue = form.get("file");
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  if (!file) {
    auditInboundApiCall({
      req,
      auth,
      action: "inbound_api.applicants.resume",
      entityType: "applicant",
      outcome: "failure",
      metadata: { reason: "missing_file" },
    });
    return integrationError(400, "VALIDATION_ERROR", "file is required", [
      { field: "file", message: "Resume file is required" },
    ]);
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 10 * 1024 * 1024 + 1024 * 512) {
    return integrationError(413, "PAYLOAD_TOO_LARGE", "Resume exceeds the 10 MB limit");
  }

  try {
    const result = await uploadInboundApplicantResume(auth.supabase, {
      tenantId: auth.tenantId,
      actorUserId: auth.createdByUserId,
      file,
      jobId: String(form.get("job_id") ?? "").trim() || null,
      externalReqId: String(form.get("external_req_id") ?? "").trim() || null,
      source: String(form.get("source") ?? "").trim() || null,
      workCity: String(form.get("work_city") ?? "").trim() || null,
      workState: String(form.get("work_state") ?? "").trim() || null,
      willRelocate:
        String(form.get("will_relocate") ?? "").trim().toLowerCase() === "true" ||
        String(form.get("will_relocate") ?? "").trim() === "1",
    });

    auditInboundApiCall({
      req,
      auth,
      action: "inbound_api.applicants.resume",
      entityType: "applicant",
      entityId: result.applicant_id,
      outcome: "success",
      metadata: {
        created: result.created,
        linked_job_id: result.linked_job_id,
        application_id: result.application_id,
      },
    });

    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    auditInboundApiCall({
      req,
      auth,
      action: "inbound_api.applicants.resume",
      entityType: "applicant",
      outcome: "failure",
      metadata: {
        message: error instanceof Error ? error.message : "unknown",
        code: error instanceof JobValidationError ? error.code : null,
      },
    });
    return mapResumeError(error);
  }
}
