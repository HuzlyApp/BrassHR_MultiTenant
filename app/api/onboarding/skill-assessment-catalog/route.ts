import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { resolveTenantIdBySlug } from "@/lib/onboarding/resolve-worker-context";
import { stripSkillAssessmentCorrectAnswers } from "@/lib/skill-assessment/catalog";
import {
  loadTenantSkillAssessmentSettings,
  publishedCatalogForApplicants,
} from "@/lib/skill-assessment/load-settings";

export const runtime = "nodejs";

/** Public applicant catalog. Unpublished drafts are never returned. */
export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get("slug")?.trim() || "";
    const tenantIdParam = req.nextUrl.searchParams.get("tenantId")?.trim() || "";
    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const supabase = createClient(url, key);
    let tenantId = tenantIdParam;
    if (!tenantId && slug) {
      tenantId = (await resolveTenantIdBySlug(supabase, slug)) ?? "";
    }
    if (!tenantId) {
      return NextResponse.json({ error: "Missing tenant slug or tenantId" }, { status: 400 });
    }

    const record = await loadTenantSkillAssessmentSettings(supabase, tenantId);
    const published = publishedCatalogForApplicants(record);
    const catalog = published.scoring.showResultsToApplicant
      ? published
      : stripSkillAssessmentCorrectAnswers(published);

    return NextResponse.json({
      catalog,
      enabled: published.enabled,
      allowSkip: published.allowSkip,
      scoring: {
        showResultsToApplicant: published.scoring.showResultsToApplicant,
        scoreByCategory: published.scoring.scoreByCategory,
        showOverallScore: published.scoring.showOverallScore,
        passingScore: published.scoring.passingScore,
      },
      publishedVersion: record.publishedVersion,
    });
  } catch (error) {
    console.error("[onboarding/skill-assessment-catalog]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load skill assessment" },
      { status: 500 }
    );
  }
}
