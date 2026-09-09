import { NextResponse } from "next/server";
import { enforceRateLimit, envRateLimit } from "@/lib/security/rate-limit";

/** Recruiters analyze full job slates; 40/hour blocked real sessions. Override with env. */
export const MATCH_ANALYSIS_USER_LIMIT = envRateLimit(
  "RATE_LIMIT_MATCH_ANALYSIS_AI_PER_HOUR",
  200
);
export const MATCH_ANALYSIS_TENANT_LIMIT = envRateLimit(
  "RATE_LIMIT_MATCH_ANALYSIS_AI_TENANT_PER_HOUR",
  1000
);

export function matchAnalysisRateLimitMessage(retryAfterSec: number): string {
  const seconds = Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec : 3600;
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Too many match analyses right now. Try again in ${minutes} minute${
    minutes === 1 ? "" : "s"
  }.`;
}

export function matchAnalysisRateLimitedResponse(limited: NextResponse): NextResponse {
  if (limited.status !== 429) return limited;
  const retryAfterSec = Number(limited.headers.get("Retry-After") ?? 3600);
  return NextResponse.json(
    {
      error: matchAnalysisRateLimitMessage(retryAfterSec),
      code: "RATE_LIMIT",
    },
    { status: 429, headers: limited.headers }
  );
}

export async function enforceMatchAnalysisRateLimits(
  req: Request,
  tenantId: string,
  userId: string
): Promise<NextResponse | null> {
  const userLimited = await enforceRateLimit(req, {
    namespace: "match-analysis-ai-user.v2",
    key: `${tenantId}:${userId}`,
    limit: MATCH_ANALYSIS_USER_LIMIT,
    windowMs: 60 * 60 * 1000,
    failClosed: true,
  });
  if (userLimited) return matchAnalysisRateLimitedResponse(userLimited);

  const tenantLimited = await enforceRateLimit(req, {
    namespace: "match-analysis-ai-tenant.v2",
    key: tenantId,
    limit: MATCH_ANALYSIS_TENANT_LIMIT,
    windowMs: 60 * 60 * 1000,
    failClosed: true,
  });
  if (tenantLimited) return matchAnalysisRateLimitedResponse(tenantLimited);

  return null;
}
