import { NextRequest, NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import {
  getMatchAnalysisModelName,
  MATCH_ANALYSIS_ERROR,
  MatchAnalysisGenerationError,
  runMatchAnalysisForApplication,
} from "@/lib/jobs/match-analysis";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { loadMatchAnalysisWorkspace } from "@/lib/jobs/match-analysis/load-workspace";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";
export const maxDuration = 120;

const USER_LIMIT = Number(process.env.RATE_LIMIT_MATCH_ANALYSIS_AI_PER_HOUR ?? 40);
const TENANT_LIMIT = Number(
  process.env.RATE_LIMIT_MATCH_ANALYSIS_AI_TENANT_PER_HOUR ?? 200
);

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const tenantId = await resolveStaffTenantId(supabase, auth).catch(() => null);
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Application id required" }, { status: 400 });
  }

  try {
    const workspace = await loadMatchAnalysisWorkspace(supabase, tenantId, id);
    if (!workspace) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    return NextResponse.json(workspace);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load match analysis" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const tenantId = await resolveStaffTenantId(supabase, auth).catch(() => null);
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Application id required" }, { status: 400 });
  }

  const userLimited = await enforceRateLimit(req, {
    namespace: "match-analysis-ai-user",
    key: `${tenantId}:${auth.userId}`,
    limit: USER_LIMIT,
    windowMs: 60 * 60 * 1000,
    failClosed: true,
  });
  if (userLimited) {
    return NextResponse.json(
      { error: MATCH_ANALYSIS_ERROR, code: "RATE_LIMIT" },
      { status: 429, headers: userLimited.headers }
    );
  }

  const tenantLimited = await enforceRateLimit(req, {
    namespace: "match-analysis-ai-tenant",
    key: tenantId,
    limit: TENANT_LIMIT,
    windowMs: 60 * 60 * 1000,
    failClosed: true,
  });
  if (tenantLimited) {
    return NextResponse.json(
      { error: MATCH_ANALYSIS_ERROR, code: "RATE_LIMIT" },
      { status: 429, headers: tenantLimited.headers }
    );
  }

  const body = await req.json().catch(() => ({}));
  const recruiterNotes =
    typeof body?.recruiterNotes === "string" ? body.recruiterNotes : null;
  const verifiedRecruiterInfo =
    body?.verifiedRecruiterInfo && typeof body.verifiedRecruiterInfo === "object"
      ? (body.verifiedRecruiterInfo as Record<string, unknown>)
      : null;

  try {
    const result = await runMatchAnalysisForApplication({
      supabase,
      tenantId,
      jobApplicationId: id,
      recruiterNotes,
      verifiedRecruiterInfo,
      analyzedByUserId: auth.devBypass ? null : auth.userId,
    });

    void writeActivityLog({
      actorUserId: auth.userId,
      action: "job_application.match_analyzed",
      entityType: "job_application",
      entityId: id,
      tenantId,
      request: req,
      metadata: {
        model: result.model ?? getMatchAnalysisModelName(),
        status: result.status,
        score: result.score,
        category: result.category,
        repaired: result.repaired,
      },
    });

    const { data: requirements } = await supabase
      .from("job_application_match_requirements")
      .select(
        "id, requirement_text, requirement_type, status, requirement_outcome, candidate_evidence, evidence_source, impact, verification_required, confidence, sort_order, recruiter_verified, recruiter_note, recruiter_verified_at"
      )
      .eq("job_application_id", id)
      .eq("tenant_id", tenantId)
      .order("sort_order", { ascending: true });

    return NextResponse.json({
      ...result,
      requirements: requirements ?? [],
    });
  } catch (error) {
    const code =
      error instanceof MatchAnalysisGenerationError ? error.code : "UNKNOWN";

    console.error("[job-applications/match-analysis]", {
      code,
      tenantId,
      userId: auth.userId,
      applicationId: id,
      message: error instanceof Error ? error.message : "unknown",
    });

    const status =
      code === "AUTH"
        ? 502
        : code === "RATE_LIMIT"
          ? 429
          : code === "TIMEOUT" || code === "NETWORK"
            ? 504
            : code === "MISSING_CONFIG"
              ? 503
              : 502;

    return NextResponse.json({ error: MATCH_ANALYSIS_ERROR, code }, { status });
  }
}
