import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import {
  isApplicationPipelineStatus,
  type ApplicationPipelineStatus,
} from "@/lib/jobs/application-status";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

    const { id } = await context.params;
    const applicationId = id?.trim();
    if (!applicationId) {
      return NextResponse.json({ error: "Application id is required" }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as { status?: unknown } | null;
    const status =
      typeof body?.status === "string" ? body.status.trim().toLowerCase() : "";
    if (!isApplicationPipelineStatus(status)) {
      return NextResponse.json({ error: "Invalid application status" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("job_applications")
      .update({ status: status as ApplicationPipelineStatus })
      .eq("id", applicationId)
      .eq("tenant_id", tenantId)
      .select(
        "id, status, created_at, submitted_at, updated_at, job_requisition_id, workflow_id, applicant_workflow_instance_id, worker_id"
      )
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    return NextResponse.json({ application: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update application" },
      { status: 500 }
    );
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

    const { id } = await context.params;
    const applicationId = id?.trim();
    if (!applicationId) {
      return NextResponse.json({ error: "Application id is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("job_applications")
      .select(
        "id, status, created_at, submitted_at, updated_at, job_requisition_id, workflow_id, applicant_workflow_instance_id, worker_id, job_requisitions(public_title, location, facility, facility_name, professions(name)), onboarding_flows(name), applicant_profiles(id, first_name, last_name, email, worker_id), worker(id, first_name, last_name, email)"
      )
      .eq("id", applicationId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    return NextResponse.json({ application: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load application" },
      { status: 500 }
    );
  }
}
