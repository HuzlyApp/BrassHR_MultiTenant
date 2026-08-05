import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { createAdminJobApplication, bulkDeleteJobApplications, parseBulkDeleteIds } from "@/lib/jobs/service";
import { JobValidationError } from "@/lib/jobs/types";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { WORKER_RESUMES_BUCKET } from "@/lib/supabase-storage-buckets";

export const runtime = "nodejs";

const MAX_RESUME_BYTES = Number(process.env.MAX_RESUME_UPLOAD_BYTES ?? 10 * 1024 * 1024);
const ALLOWED_RESUME_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
}

function formatApiError(error: unknown, fallback: string): string {
  if (error instanceof JobValidationError) return error.message;
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

    const jobId = req.nextUrl.searchParams.get("jobId")?.trim();
    if (!jobId) {
      return NextResponse.json(
        { error: "jobId is required", applications: [] },
        { status: 400 }
      );
    }

    let query = supabase
      .from("job_applications")
      .select(
        "id, status, created_at, submitted_at, updated_at, job_requisition_id, workflow_id, applicant_workflow_instance_id, worker_id, job_requisitions(public_title, profession_id, employment_type, location, facility, facility_name, professions(name)), onboarding_flows(name), applicant_profiles(id, first_name, last_name, email, worker_id), worker(id, first_name, last_name, email)"
      )
      .eq("tenant_id", tenantId)
      .eq("job_requisition_id", jobId)
      .order("created_at", { ascending: false });

    const status = req.nextUrl.searchParams.get("status");
    const workflowId = req.nextUrl.searchParams.get("workflowId");
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");
    if (status) query = query.eq("status", status);
    if (workflowId) query = query.eq("workflow_id", workflowId);
    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", to);

    const { data, error } = await query;
    if (error) throw error;

    let applications = data ?? [];
    const professionId = req.nextUrl.searchParams.get("professionId");
    const employmentType = req.nextUrl.searchParams.get("employmentType");
    if (professionId || employmentType) {
      applications = applications.filter((row) => {
        const job = Array.isArray(row.job_requisitions)
          ? row.job_requisitions[0]
          : row.job_requisitions;
        return (
          (!professionId || job?.profession_id === professionId) &&
          (!employmentType || job?.employment_type === employmentType)
        );
      });
    }

    return NextResponse.json({ applications });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load applications" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

    const contentType = req.headers.get("content-type") ?? "";
    let jobRequisitionId = "";
    let name = "";
    let email = "";
    let phone = "";
    let streetAddress = "";
    let cityStateZip = "";
    let country = "";
    let lastJobTitle = "";
    let lastCompany = "";
    let resumeFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      jobRequisitionId = String(form.get("jobId") ?? form.get("jobRequisitionId") ?? "").trim();
      name = String(form.get("name") ?? "").trim();
      email = String(form.get("email") ?? "").trim();
      phone = String(form.get("phone") ?? "").trim();
      streetAddress = String(form.get("streetAddress") ?? form.get("street") ?? "").trim();
      cityStateZip = String(form.get("cityStateZip") ?? "").trim();
      country = String(form.get("country") ?? "").trim();
      lastJobTitle = String(form.get("lastJobTitle") ?? "").trim();
      lastCompany = String(form.get("lastCompany") ?? "").trim();
      const file = form.get("resume");
      if (file instanceof File && file.size > 0) resumeFile = file;
    } else {
      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      jobRequisitionId = String(body?.jobId ?? body?.jobRequisitionId ?? "").trim();
      name = String(body?.name ?? "").trim();
      email = String(body?.email ?? "").trim();
      phone = String(body?.phone ?? "").trim();
      streetAddress = String(body?.streetAddress ?? body?.street ?? "").trim();
      cityStateZip = String(body?.cityStateZip ?? "").trim();
      country = String(body?.country ?? "").trim();
      lastJobTitle = String(body?.lastJobTitle ?? "").trim();
      lastCompany = String(body?.lastCompany ?? "").trim();
    }

    if (!jobRequisitionId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ error: "Phone is required" }, { status: 400 });
    }

    let resumePath: string | null = null;
    let resumeFileName: string | null = null;

    if (resumeFile) {
      if (resumeFile.size > MAX_RESUME_BYTES) {
        return NextResponse.json(
          { error: "Resume must be 10 MB or smaller." },
          { status: 400 }
        );
      }
      const mime = (resumeFile.type || "").toLowerCase();
      const lowerName = resumeFile.name.toLowerCase();
      const extOk =
        lowerName.endsWith(".pdf") || lowerName.endsWith(".doc") || lowerName.endsWith(".docx");
      if (!ALLOWED_RESUME_MIME.has(mime) && !extOk) {
        return NextResponse.json(
          { error: "Resume must be a PDF or Word document." },
          { status: 400 }
        );
      }

      const safeName = sanitizeFileName(resumeFile.name || "resume.pdf");
      resumePath = `admin-candidates/${tenantId}/${randomUUID()}/${safeName}`;
      resumeFileName = safeName;
      const bytes = Buffer.from(await resumeFile.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from(WORKER_RESUMES_BUCKET)
        .upload(resumePath, bytes, {
          contentType: mime || "application/octet-stream",
          upsert: false,
        });
      if (uploadError) {
        return NextResponse.json(
          { error: uploadError.message || "Failed to upload resume" },
          { status: 500 }
        );
      }
    }

    const result = await createAdminJobApplication(supabase, {
      tenantId,
      jobRequisitionId,
      name,
      email,
      phone,
      streetAddress,
      cityStateZip,
      country,
      lastJobTitle,
      lastCompany,
      createdByStaffUserId: auth.devBypass ? null : auth.userId,
      resumePath,
      resumeFileName,
    });

    return NextResponse.json(
      {
        application: result.application,
        applicantProfileId: result.applicantProfileId,
        jobTitle: result.jobTitle,
      },
      { status: 201 }
    );
  } catch (error) {
    const status = error instanceof JobValidationError ? 400 : 500;
    return NextResponse.json({ error: formatApiError(error, "Failed to add candidate") }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

    const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
    const ids = parseBulkDeleteIds(body?.ids);
    if (!ids.length) {
      return NextResponse.json({ error: "At least one application id is required" }, { status: 400 });
    }

    const { deletedIds } = await bulkDeleteJobApplications(supabase, tenantId, ids);
    if (!deletedIds.length) {
      return NextResponse.json({ error: "No candidates were deleted" }, { status: 404 });
    }

    return NextResponse.json({ deletedIds, count: deletedIds.length });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Failed to delete candidates") },
      { status: 500 }
    );
  }
}
