import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";
import {
  deleteWorkflowTemplate,
  getWorkflowTemplateById,
  updateWorkflowTemplate,
  workflowTemplateDraft,
  type WorkflowTemplateFolder,
} from "@/lib/onboarding/workflow-templates";
import {
  isSerializableWorkflowState,
  type SerializableWorkflowState,
} from "@/lib/onboarding/workflow-builder-serialization";
import { requireWorkflowAdmin } from "@/lib/auth/workflow-admin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireWorkflowAdmin(auth);
  if (forbidden) return forbidden;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { id } = await context.params;

  try {
    const tenantId = await resolveEffectiveAdminTenantId(supabase as OnboardingDbClient, {
      userId: auth.userId,
      authUser: auth.authUser,
      godAdmin: auth.godAdmin,
    });

    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenant selected", code: "TENANT_REQUIRED" },
        { status: 400 }
      );
    }

    const row = await getWorkflowTemplateById(supabase as OnboardingDbClient, tenantId, id);
    if (!row) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const builderDraft = await workflowTemplateDraft(supabase as OnboardingDbClient, row);
    const folder: WorkflowTemplateFolder = row.type === "preset" ? "presets" : "saved-templates";

    return NextResponse.json({
      template: {
        id: row.id,
        name: row.name,
        folder,
        isPreset: row.type === "preset",
        tenantId: row.tenant_id,
        isReadOnly: row.type === "preset" && row.tenant_id === null,
        flowName: row.flow_name,
        builderDraft,
        updatedAt: row.updated_at,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load template";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

type PatchBody = {
  name?: string;
  flowName?: string;
  builderDraft?: SerializableWorkflowState;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireWorkflowAdmin(auth);
  if (forbidden) return forbidden;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { id } = await context.params;

  let body: PatchBody = {};
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    body.builderDraft !== undefined &&
    !isSerializableWorkflowState(body.builderDraft)
  ) {
    return NextResponse.json({ error: "Invalid builder draft" }, { status: 400 });
  }

  try {
    const tenantId = await resolveEffectiveAdminTenantId(supabase as OnboardingDbClient, {
      userId: auth.userId,
      authUser: auth.authUser,
      godAdmin: auth.godAdmin,
    });

    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenant selected", code: "TENANT_REQUIRED" },
        { status: 400 }
      );
    }

    const template = await updateWorkflowTemplate(supabase as OnboardingDbClient, tenantId, id, {
      name: body.name,
      flowName: body.flowName,
      builderDraft: body.builderDraft,
      updatedBy: auth.userId,
    });

    return NextResponse.json({ template });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update template";
    const status = /not found/i.test(msg) ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireWorkflowAdmin(auth);
  if (forbidden) return forbidden;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { id } = await context.params;

  try {
    const tenantId = await resolveEffectiveAdminTenantId(supabase as OnboardingDbClient, {
      userId: auth.userId,
      authUser: auth.authUser,
      godAdmin: auth.godAdmin,
    });

    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenant selected", code: "TENANT_REQUIRED" },
        { status: 400 }
      );
    }

    await deleteWorkflowTemplate(supabase as OnboardingDbClient, tenantId, id);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete template";
    const status = /not found|cannot modify/i.test(msg) ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
