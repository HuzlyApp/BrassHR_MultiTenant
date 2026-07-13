import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { computeMappingPriority } from "@/lib/job-requisitions/resolve-workflow-mapping";
import type { EmploymentType, PlacementType } from "@/lib/job-requisitions/types";
import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const tenantId = await resolveEffectiveAdminTenantId(supabase as OnboardingDbClient, {
    userId: auth.userId,
    authUser: auth.authUser,
    godAdmin: auth.godAdmin,
  });
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  }

  const [{ data: mappings, error }, { data: settings }, { data: flows }, { data: jobs }] =
    await Promise.all([
      supabase
        .from("workflow_template_mappings")
        .select(
          "id, job_role, employment_type, placement_type, workflow_template_id, priority, is_active, created_at, updated_at"
        )
        .eq("tenant_id", tenantId)
        .order("priority", { ascending: false }),
      supabase
        .from("tenant_workflow_settings")
        .select("default_workflow_template_id")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      supabase
        .from("onboarding_flows")
        .select("id, name, status, is_active, is_master_template")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("job_requisitions")
        .select("id, workflow_template_id")
        .eq("tenant_id", tenantId)
        .not("workflow_template_id", "is", null),
    ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const jobsUsingFlow = new Map<string, number>();
  for (const job of jobs ?? []) {
    const id = String(job.workflow_template_id);
    jobsUsingFlow.set(id, (jobsUsingFlow.get(id) ?? 0) + 1);
  }

  const flowById = new Map((flows ?? []).map((f) => [String(f.id), f]));

  return NextResponse.json({
    mappings: (mappings ?? []).map((m) => ({
      ...m,
      workflow_name: flowById.get(String(m.workflow_template_id))?.name ?? null,
      workflow_status: flowById.get(String(m.workflow_template_id))?.status ?? null,
      jobs_using_workflow: jobsUsingFlow.get(String(m.workflow_template_id)) ?? 0,
    })),
    flows: flows ?? [],
    defaultWorkflowTemplateId: settings?.default_workflow_template_id ?? null,
    priorityGuide: [
      "1. Exact role + employment + placement",
      "2. Role + employment",
      "3. Role only",
      "4. Tenant default",
    ],
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const tenantId = await resolveEffectiveAdminTenantId(supabase as OnboardingDbClient, {
    userId: auth.userId,
    authUser: auth.authUser,
    godAdmin: auth.godAdmin,
  });
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.action === "set_default") {
    const defaultId =
      typeof body.defaultWorkflowTemplateId === "string"
        ? body.defaultWorkflowTemplateId.trim() || null
        : null;

    if (defaultId) {
      const { data: flow } = await supabase
        .from("onboarding_flows")
        .select("id")
        .eq("id", defaultId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (!flow) {
        return NextResponse.json({ error: "Workflow not found for this tenant" }, { status: 400 });
      }
    }

    const { error } = await supabase.from("tenant_workflow_settings").upsert(
      {
        tenant_id: tenantId,
        default_workflow_template_id: defaultId,
        updated_by: auth.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void writeActivityLog({
      actorUserId: auth.userId,
      action: "tenant_default_workflow_set",
      entityType: "tenant_workflow_settings",
      entityId: tenantId,
      tenantId,
      metadata: { default_workflow_template_id: defaultId },
      request: req,
    });

    return NextResponse.json({ ok: true, defaultWorkflowTemplateId: defaultId });
  }

  const jobRole = typeof body.jobRole === "string" ? body.jobRole.trim() || null : null;
  const employmentType = body.employmentType
    ? (String(body.employmentType) as EmploymentType)
    : null;
  const placementType = body.placementType
    ? (String(body.placementType) as PlacementType)
    : null;
  const workflowTemplateId = String(body.workflowTemplateId ?? "").trim();

  if (!workflowTemplateId) {
    return NextResponse.json({ error: "workflowTemplateId is required" }, { status: 400 });
  }

  const { data: flow } = await supabase
    .from("onboarding_flows")
    .select("id")
    .eq("id", workflowTemplateId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!flow) {
    return NextResponse.json(
      { error: "Workflow must belong to the current tenant." },
      { status: 400 }
    );
  }

  const priority = computeMappingPriority({ jobRole, employmentType, placementType });

  const { data, error } = await supabase
    .from("workflow_template_mappings")
    .insert({
      tenant_id: tenantId,
      job_role: jobRole,
      employment_type: employmentType,
      placement_type: placementType,
      workflow_template_id: workflowTemplateId,
      priority,
      is_active: body.isActive !== false,
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .select("id")
    .single();

  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json(
      {
        error: duplicate
          ? "An active mapping already exists for this attribute combination."
          : error.message,
      },
      { status: duplicate ? 409 : 500 }
    );
  }

  void writeActivityLog({
    actorUserId: auth.userId,
    action: "workflow_mapping_created",
    entityType: "workflow_template_mappings",
    entityId: String(data.id),
    tenantId,
    metadata: { job_role: jobRole, employment_type: employmentType, placement_type: placementType },
    request: req,
  });

  return NextResponse.json({ id: data.id });
}
