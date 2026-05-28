import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import {
  loadTenantOnboardingConfig,
  type OnboardingDbClient,
} from "@/lib/onboarding/load-tenant-config";
import type { OnboardingStepDraft } from "@/lib/onboarding/default-onboarding-steps";
import {
  loadOnboardingBuilderMeta,
  saveOnboardingBuilderDraft,
} from "@/lib/onboarding/load-onboarding-builder-meta";
import { stepDraftsToSerializableWorkflow } from "@/lib/onboarding/step-drafts-to-workflow-state";
import {
  publishOnboardingFromWorkflow,
  syncBuilderDraftFromStepDrafts,
} from "@/lib/onboarding/config-from-builder-draft";
import {
  isSerializableWorkflowState,
  serializeWorkflowState,
  type SerializableWorkflowState,
} from "@/lib/onboarding/workflow-builder-serialization";

export const runtime = "nodejs";

function tenantRequiredResponse(detail: string): NextResponse {
  return NextResponse.json(
    { error: "No tenant selected", code: "TENANT_REQUIRED", detail },
    { status: 400 }
  );
}

async function resolveTenantId(
  supabase: OnboardingDbClient,
  auth: Awaited<ReturnType<typeof requireStaffApiSession>>,
  req: NextRequest
): Promise<string | null> {
  if (auth instanceof NextResponse) return null;
  const requestedTenantId = req.nextUrl.searchParams.get("tenantId")?.trim();
  if (requestedTenantId && !auth.godAdmin) {
    return await resolveEffectiveAdminTenantId(supabase, {
      userId: auth.userId,
      authUser: auth.authUser,
      godAdmin: auth.godAdmin,
    });
  }
  return (
    (auth.godAdmin ? requestedTenantId : null) ||
    (await resolveEffectiveAdminTenantId(supabase, {
      userId: auth.userId,
      authUser: auth.authUser,
      godAdmin: auth.godAdmin,
    }))
  );
}

export async function GET(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const tenantId = await resolveTenantId(supabase, auth, req);

    if (!tenantId) {
      return tenantRequiredResponse(
        auth.godAdmin
          ? "Select a tenant using the tenant switcher in the header."
          : "Your account is not linked to a tenant. Contact an administrator."
      );
    }

    const config = await loadTenantOnboardingConfig(
      supabase as OnboardingDbClient,
      tenantId,
      { workerFacing: false }
    );
    const builder = await loadOnboardingBuilderMeta(supabase as OnboardingDbClient, tenantId);

    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("name, slug")
      .eq("id", tenantId)
      .maybeSingle();

    return NextResponse.json({
      config,
      tenantId,
      tenantName: tenantRow?.name ? String(tenantRow.name) : null,
      tenantSlug: tenantRow?.slug ? String(tenantRow.slug) : null,
      flowName: builder.flowName,
      publishStatus: builder.publishStatus,
      builderDraft: builder.builderDraft,
      builderUpdatedAt: builder.updatedAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

type SaveBody = {
  steps?: OnboardingStepDraft[];
  builderDraft?: SerializableWorkflowState;
  flowName?: string;
  publish?: boolean;
  saveTemplate?: boolean;
};

export async function PUT(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  let body: SaveBody = {};
  try {
    body = (await req.json()) as SaveBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const tenantId = await resolveTenantId(supabase, auth, req);

    if (!tenantId) {
      return tenantRequiredResponse(
        auth.godAdmin
          ? "Select a tenant before saving onboarding settings."
          : "Your account is not linked to a tenant. Contact an administrator."
      );
    }

    if (body.builderDraft && isSerializableWorkflowState(body.builderDraft)) {
      if (body.publish) {
        await publishOnboardingFromWorkflow(
          supabase as OnboardingDbClient,
          tenantId,
          body.builderDraft,
          auth.userId,
          body.flowName
        );
      } else {
        await saveOnboardingBuilderDraft(supabase as OnboardingDbClient, tenantId, {
          flowName: body.flowName,
          builderDraft: body.builderDraft,
          updatedBy: auth.userId,
          publishStatus: "draft",
        });
      }
    } else if (Array.isArray(body.steps) && body.steps.length) {
      if (body.publish) {
        const builderDraft = stepDraftsToSerializableWorkflow(body.steps);
        await publishOnboardingFromWorkflow(
          supabase as OnboardingDbClient,
          tenantId,
          builderDraft,
          auth.userId,
          body.flowName
        );
      } else {
        await syncBuilderDraftFromStepDrafts(
          supabase as OnboardingDbClient,
          tenantId,
          body.steps,
          auth.userId,
          body.flowName
        );
      }
    } else if (body.publish && body.builderDraft) {
      return NextResponse.json({ error: "Invalid builder draft" }, { status: 400 });
    }

    const config = await loadTenantOnboardingConfig(supabase as OnboardingDbClient, tenantId);
    const builder = await loadOnboardingBuilderMeta(supabase as OnboardingDbClient, tenantId);

    return NextResponse.json({
      config,
      tenantId,
      flowName: builder.flowName,
      publishStatus: builder.publishStatus,
      builderDraft: builder.builderDraft,
      builderUpdatedAt: builder.updatedAt,
    });
  } catch (err: unknown) {
    console.error("[admin/onboarding/config]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Re-export for route handlers that need to serialize client workflow state. */
export { serializeWorkflowState };
