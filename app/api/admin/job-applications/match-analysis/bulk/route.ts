import { NextRequest, NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import {
  MATCH_ANALYSIS_ERROR,
  MatchAnalysisGenerationError,
  runMatchAnalysisBulk,
} from "@/lib/jobs/match-analysis";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 300;

const USER_LIMIT = Number(process.env.RATE_LIMIT_MATCH_ANALYSIS_AI_PER_HOUR ?? 40);
const TENANT_LIMIT = Number(
  process.env.RATE_LIMIT_MATCH_ANALYSIS_AI_TENANT_PER_HOUR ?? 200
);
const MAX_BULK = 25;

const bodySchema = z.object({
  jobApplicationIds: z.array(z.string().uuid()).min(1).max(MAX_BULK),
});

export async function POST(req: NextRequest) {
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

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: `Provide 1–${MAX_BULK} jobApplicationIds`,
        code: "VALIDATION",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  // Ensure all applications belong to tenant
  const { data: owned, error: ownedError } = await supabase
    .from("job_applications")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("id", parsed.data.jobApplicationIds);

  if (ownedError) {
    return NextResponse.json({ error: ownedError.message }, { status: 500 });
  }

  const ownedIds = new Set((owned ?? []).map((row) => row.id as string));
  const missing = parsed.data.jobApplicationIds.filter((id) => !ownedIds.has(id));
  if (missing.length) {
    return NextResponse.json(
      { error: "One or more applications were not found for this tenant", missing },
      { status: 404 }
    );
  }

  try {
    const results = await runMatchAnalysisBulk({
      supabase,
      tenantId,
      jobApplicationIds: parsed.data.jobApplicationIds,
    });

    void writeActivityLog({
      actorUserId: auth.userId,
      action: "job_application.match_analyzed_bulk",
      entityType: "job_application",
      tenantId,
      request: req,
      metadata: {
        count: results.length,
        analyzed: results.filter((r) => "status" in r.result && r.result.status === "ANALYZED")
          .length,
        failed: results.filter((r) => "status" in r.result && r.result.status === "FAILED")
          .length,
      },
    });

    return NextResponse.json({ results });
  } catch (error) {
    const code =
      error instanceof MatchAnalysisGenerationError ? error.code : "UNKNOWN";
    console.error("[job-applications/match-analysis/bulk]", {
      code,
      tenantId,
      userId: auth.userId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: MATCH_ANALYSIS_ERROR, code }, { status: 502 });
  }
}
