import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";
import { saveOnboardingBuilderDraft } from "@/lib/onboarding/load-onboarding-builder-meta";
import {
  getWorkflowTemplateById,
  workflowTemplateDraft,
} from "@/lib/onboarding/workflow-templates";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

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

    const builderDraft = workflowTemplateDraft(row);
    await saveOnboardingBuilderDraft(supabase as OnboardingDbClient, tenantId, {
      builderDraft,
      updatedBy: auth.userId,
      publishStatus: "draft",
    });

    return NextResponse.json({
      ok: true,
      templateName: row.name,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to copy template to workflow";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
