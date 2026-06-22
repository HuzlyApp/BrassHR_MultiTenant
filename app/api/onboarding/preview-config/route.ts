import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { loadOnboardingBuilderMeta } from "@/lib/onboarding/load-onboarding-builder-meta";
import { resolveTenantIdBySlug } from "@/lib/onboarding/resolve-worker-context";
import { configFromWorkflowDraft } from "@/lib/onboarding/config-from-builder-draft";
import { applyApplicantConfigFilters } from "@/lib/onboarding/filter-applicant-steps";
import { getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation";

export const runtime = "nodejs";

/**
 * Returns applicant-facing config from the saved builder draft (not published steps).
 * Used when `?preview=draft` is set and localStorage preview is unavailable.
 */
export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get("slug")?.trim() || "";
    if (!slug || slug.length < 2) {
      return NextResponse.json({ error: "Missing tenant slug" }, { status: 400 });
    }

    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const supabase = createClient(url, key);
    const tenantId = await resolveTenantIdBySlug(supabase, slug);
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const published = await loadTenantOnboardingConfig(supabase, tenantId, { workerFacing: false });
    if (!published) {
      return NextResponse.json({ error: "Configuration not found" }, { status: 404 });
    }

    const builder = await loadOnboardingBuilderMeta(supabase, tenantId);
    if (!builder.builderDraft?.nodes?.length) {
      return NextResponse.json(
        {
          error: "No builder draft found for this tenant.",
          code: "NO_DRAFT",
        },
        { status: 404 }
      );
    }

    const draftConfig = configFromWorkflowDraft(published, builder.builderDraft);
    if (!draftConfig) {
      return NextResponse.json({ error: "Could not build draft preview config" }, { status: 500 });
    }

    const config = applyApplicantConfigFilters(draftConfig);
    if (!getEnabledTenantSteps(config).length) {
      return NextResponse.json(
        {
          error: "Draft workflow has no applicant-visible steps.",
          code: "NO_VISIBLE_STEPS",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      config,
      tenantSlug: slug,
      publishStatus: builder.publishStatus,
      source: "draft",
    });
  } catch (err: unknown) {
    console.error("[onboarding/preview-config]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
