import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { requireWorkflowAdmin } from "@/lib/auth/workflow-admin";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { invalidateTenantCache } from "@/lib/cache";
import { catalogsAreEqual, normalizeSkillAssessmentCatalog } from "@/lib/skill-assessment/catalog";
import {
  loadTenantSkillAssessmentSettings,
  publishTenantSkillAssessment,
  saveTenantSkillAssessmentDraft,
} from "@/lib/skill-assessment/load-settings";

function handleError(error: unknown) {
  console.error("[admin/assessment-settings]", error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Failed to manage assessment settings" },
    { status: 500 }
  );
}

export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
    const record = await loadTenantSkillAssessmentSettings(supabase, tenantId);
    return NextResponse.json({
      canManage: auth.role === "admin" || auth.godAdmin,
      settings: {
        draft: record.draft,
        published: record.published,
        publishedVersion: record.publishedVersion,
        publishedAt: record.publishedAt,
        draftUpdatedAt: record.draftUpdatedAt,
        hasUnpublishedChanges: !record.published || !catalogsAreEqual(record.draft, record.published),
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireWorkflowAdmin(auth);
  if (forbidden) return forbidden;

  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
    const body = (await req.json().catch(() => null)) as { catalog?: unknown } | null;
    const catalog = normalizeSkillAssessmentCatalog(body?.catalog);
    const record = await saveTenantSkillAssessmentDraft(supabase, tenantId, catalog);
    return NextResponse.json({
      ok: true,
      settings: {
        draft: record.draft,
        published: record.published,
        publishedVersion: record.publishedVersion,
        publishedAt: record.publishedAt,
        draftUpdatedAt: record.draftUpdatedAt,
        hasUnpublishedChanges: !record.published || !catalogsAreEqual(record.draft, record.published),
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireWorkflowAdmin(auth);
  if (forbidden) return forbidden;

  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
    const body = (await req.json().catch(() => null)) as { catalog?: unknown; action?: unknown } | null;
    if (body?.action !== "publish") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }
    const catalog = body.catalog ? normalizeSkillAssessmentCatalog(body.catalog) : undefined;
    const record = await publishTenantSkillAssessment(supabase, tenantId, catalog);
    await invalidateTenantCache("tenant_onboarding_configs", tenantId);
    await invalidateTenantCache("tenant_skill_assessment_settings", tenantId);
    return NextResponse.json({
      ok: true,
      settings: {
        draft: record.draft,
        published: record.published,
        publishedVersion: record.publishedVersion,
        publishedAt: record.publishedAt,
        draftUpdatedAt: record.draftUpdatedAt,
        hasUnpublishedChanges: false,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
