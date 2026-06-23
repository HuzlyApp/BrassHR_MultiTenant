import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { resolveTenantIdBySlug } from "@/lib/onboarding/resolve-worker-context";
import { getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation";
import { tenantConfigToPublishedWorkflow } from "@/lib/onboarding/applicant-workflow";
import { loadOnboardingBuilderMeta } from "@/lib/onboarding/load-onboarding-builder-meta";
import {
  getApplicantWorkflow as getApplicantWorkflowFromStore,
  resolvePublishedWorkflowForApplicant,
} from "@/lib/onboarding/applicant-workflow-persistence";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ applicationId: string }> };

/**
 * Returns the published onboarding workflow for an applicant session.
 * Uses in-memory test store when populated; otherwise reads tenant config from Supabase.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { applicationId } = await context.params;
    const tenant = req.nextUrl.searchParams.get("tenant")?.trim().toLowerCase() || "";

    if (!applicationId?.trim()) {
      return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
    }
    if (!tenant) {
      return NextResponse.json({ error: "Missing tenant" }, { status: 400 });
    }

    const inMemory = resolvePublishedWorkflowForApplicant(tenant, applicationId.trim());
    if (inMemory) {
      return NextResponse.json(inMemory);
    }

    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      try {
        const workflow = await getApplicantWorkflowFromStore({
          tenant,
          applicationId: applicationId.trim(),
        });
        return NextResponse.json(workflow);
      } catch {
        return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
      }
    }

    const supabase = createClient(url, key);
    const tenantId = (await resolveTenantIdBySlug(supabase, tenant)) ?? "";
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const builder = await loadOnboardingBuilderMeta(supabase, tenantId);
    const config = await loadTenantOnboardingConfig(supabase, tenantId, { workerFacing: true });

    if (!config || !getEnabledTenantSteps(config).length) {
      return NextResponse.json({ error: "Published workflow not found" }, { status: 404 });
    }

    const workflow = tenantConfigToPublishedWorkflow(
      config,
      tenant,
      "worker_onboarding",
      builder.publishStatus === "draft" ? "published" : "published"
    );

    return NextResponse.json({
      ...workflow,
      status: "published",
    });
  } catch (err: unknown) {
    console.error("[applications/onboarding-workflow]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
