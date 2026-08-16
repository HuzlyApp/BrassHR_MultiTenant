import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { preExtractResumeFields } from "@/lib/resume/normalize-resume-text";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const tenantId = await resolveStaffTenantId(supabase, auth).catch(() => null);
  if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

  const { id } = await context.params;
  const { data: application } = await supabase
    .from("job_applications")
    .select("id, worker_id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  let query = supabase
    .from("worker_resumes")
    .select("extracted_text, parsed_data, original_file_name, file_name")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false })
    .limit(1);
  query = query.or(
    application.worker_id
      ? `job_application_id.eq.${id},worker_id.eq.${application.worker_id}`
      : `job_application_id.eq.${id}`
  );
  const { data: resume } = await query.maybeSingle();
  const text = String(resume?.extracted_text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "No extracted résumé text available." }, { status: 404 });
  }

  const extracted = preExtractResumeFields(text);
  return NextResponse.json({
    extracted: {
      firstName: extracted.first_name || "",
      lastName: extracted.last_name || "",
      email: extracted.email || "",
      phone: extracted.phone || "",
      specialty: extracted.job_role || "",
      location: extracted.zip || "",
    },
  });
}
