import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import {
  CandidateImportError,
  importExistingCandidatesToWorkspace,
  searchCandidatesForImport,
} from "@/lib/jobs/candidate-import";
import { parseImportSearchParams } from "@/lib/jobs/candidate-import-match";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { enforceRateLimit, envRateLimit } from "@/lib/security/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEARCH_LIMIT = envRateLimit("RATE_LIMIT_ADMIN_IMPORT_SEARCH_PER_MINUTE", 60);
const IMPORT_LIMIT = envRateLimit("RATE_LIMIT_ADMIN_IMPORT_CANDIDATES_PER_HOUR", 80);

function formatApiError(error: unknown, fallback: string): string {
  if (error instanceof CandidateImportError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

async function requireImportContext(req: NextRequest, jobId: string) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const tenantId = await resolveStaffTenantId(supabase, auth);
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant selected" }, { status: 403 });
  }
  if (!isUuid(jobId)) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return { auth, supabase, tenantId, request: req };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await context.params;
  const ctx = await requireImportContext(req, jobId);
  if (ctx instanceof NextResponse) return ctx;

  const limited = await enforceRateLimit(req, {
    namespace: "candidates.import.search",
    key: ctx.auth.userId,
    limit: SEARCH_LIMIT,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  try {
    const result = await searchCandidatesForImport(ctx.supabase, {
      tenantId: ctx.tenantId,
      jobId,
      params: parseImportSearchParams(req.nextUrl.searchParams),
    });
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof CandidateImportError ? error.status : 500;
    if (status >= 500) console.error("[jobs/candidates/import GET]", error);
    return NextResponse.json({ error: formatApiError(error, "Failed to search candidates") }, { status });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await context.params;
  const ctx = await requireImportContext(req, jobId);
  if (ctx instanceof NextResponse) return ctx;

  const limited = await enforceRateLimit(req, {
    namespace: "candidates.import",
    key: ctx.auth.userId,
    limit: IMPORT_LIMIT,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const candidateIds = body && typeof body === "object" ? (body as { candidateIds?: unknown }).candidateIds : undefined;

  try {
    const result = await importExistingCandidatesToWorkspace(ctx.supabase, {
      tenantId: ctx.tenantId,
      jobId,
      staffUserId: ctx.auth.devBypass ? null : ctx.auth.userId,
      candidateIds,
      request: ctx.request,
    });
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof CandidateImportError ? error.status : 500;
    if (status >= 500) console.error("[jobs/candidates/import POST]", error);
    return NextResponse.json({ error: formatApiError(error, "Failed to import candidates") }, { status });
  }
}
