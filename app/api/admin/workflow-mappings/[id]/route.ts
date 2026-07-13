import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { computeMappingPriority } from "@/lib/job-requisitions/resolve-workflow-mapping";
import type { EmploymentType, PlacementType } from "@/lib/job-requisitions/types";
import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
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

  const { id } = await context.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const { data: existing, error: loadErr } = await supabase
    .from("workflow_template_mappings")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Mapping not found" }, { status: 404 });

  const jobRole =
    body.jobRole !== undefined
      ? typeof body.jobRole === "string"
        ? body.jobRole.trim() || null
        : null
      : existing.job_role;
  const employmentType =
    body.employmentType !== undefined
      ? body.employmentType
        ? (String(body.employmentType) as EmploymentType)
        : null
      : existing.employment_type;
  const placementType =
    body.placementType !== undefined
      ? body.placementType
        ? (String(body.placementType) as PlacementType)
        : null
      : existing.placement_type;
  const workflowTemplateId =
    body.workflowTemplateId !== undefined
      ? String(body.workflowTemplateId).trim()
      : existing.workflow_template_id;

  if (workflowTemplateId) {
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
  }

  const patch = {
    job_role: jobRole,
    employment_type: employmentType,
    placement_type: placementType,
    workflow_template_id: workflowTemplateId,
    priority: computeMappingPriority({ jobRole, employmentType, placementType }),
    is_active: body.isActive !== undefined ? Boolean(body.isActive) : existing.is_active,
    updated_by: auth.userId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("workflow_template_mappings")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("id, is_active, priority")
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
    action: "workflow_mapping_updated",
    entityType: "workflow_template_mappings",
    entityId: id,
    tenantId,
    metadata: { previous: existing, next: patch },
    request: req,
  });

  return NextResponse.json({ mapping: data });
}

export async function DELETE(req: NextRequest, context: RouteContext) {
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

  const { id } = await context.params;

  const { data: mapping } = await supabase
    .from("workflow_template_mappings")
    .select("id, workflow_template_id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!mapping) {
    return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
  }

  const { count } = await supabase
    .from("job_requisitions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("workflow_template_id", mapping.workflow_template_id)
    .eq("status", "Open");

  if ((count ?? 0) > 0) {
    // Soft-disable instead of hard delete when Open jobs still reference the mapped workflow.
    const { error } = await supabase
      .from("workflow_template_mappings")
      .update({ is_active: false, updated_by: auth.userId })
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      softDisabled: true,
      message: "Mapping disabled because Open jobs still use this workflow.",
    });
  }

  const { error } = await supabase
    .from("workflow_template_mappings")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void writeActivityLog({
    actorUserId: auth.userId,
    action: "workflow_mapping_deleted",
    entityType: "workflow_template_mappings",
    entityId: id,
    tenantId,
    request: req,
  });

  return NextResponse.json({ ok: true });
}
