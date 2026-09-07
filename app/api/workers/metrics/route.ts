import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";
import { queryInChunks } from "@/lib/supabase/chunked-in-query";
import {
  buildCandidateKpiCardsFromMetrics,
  emptyCandidateKpiMetricsPayload,
  normalizeCandidateKpiMetricsPayload,
  type CandidateKpiMetricsPayload,
} from "@/lib/workers/candidate-kpi-metrics";
import { ACTIVE_CANDIDATE_PIPELINE_STATUSES } from "@/lib/workers/candidate-status-label";

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "Failed to load candidate metrics";
}

function isPipelineBaseStatus(status: string): boolean {
  if (!status) return true;
  return (ACTIVE_CANDIDATE_PIPELINE_STATUSES as readonly string[]).includes(status);
}

async function loadMetricsViaRpc(
  supabase: SupabaseClient,
  tenantId: string,
  pipelineStatus: string | null
): Promise<CandidateKpiMetricsPayload> {
  const args = {
    p_tenant_id: tenantId,
    p_pipeline_status: pipelineStatus,
  };
  let { data, error } = await supabase.rpc("candidate_kpi_metrics", args);
  // PostgREST schema cache can lag CREATE OR REPLACE; one short retry usually clears it.
  if (error && /schema cache/i.test(error.message)) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    ({ data, error } = await supabase.rpc("candidate_kpi_metrics", args));
  }
  if (error) throw error;
  return normalizeCandidateKpiMetricsPayload(data);
}

/**
 * Lightweight fallback when the RPC is missing from PostgREST schema cache.
 * Matches the same KPI semantics as closely as practical with simple counts.
 * Avoids giant `.in(worker_id, …)` URLs (Bad Request on large tenants).
 */
async function loadMetricsFallback(
  supabase: SupabaseClient,
  tenantId: string,
  pipelineStatus: string | null
): Promise<CandidateKpiMetricsPayload> {
  const now = Date.now();
  const currentStart = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const previousStart = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch tenant workers without fragile PostgREST enum filters; filter pipeline in JS.
  // Page past the default 1000-row API cap so large tenants are not silently undercounted.
  type WorkerMetricRow = { id?: string; status?: string | null; created_at?: string | null };
  type EmploymentMetricRow = { candidate_id?: string; created_at?: string | null };
  const pageSize = 1000;
  const workerRows: WorkerMetricRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("worker")
      .select("id, status, created_at")
      .eq("tenant_id", tenantId)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as WorkerMetricRow[];
    workerRows.push(...page);
    if (page.length < pageSize) break;
  }

  const employmentRows: EmploymentMetricRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("workers")
      .select("candidate_id, created_at")
      .eq("tenant_id", tenantId)
      .not("candidate_id", "is", null)
      .range(from, from + pageSize - 1);
    if (error) {
      if (!String(error.message ?? "").includes("does not exist")) throw error;
      break;
    }
    const page = (data ?? []) as EmploymentMetricRow[];
    employmentRows.push(...page);
    if (page.length < pageSize) break;
  }

  const converted = new Set(
    employmentRows.map((row) => String(row.candidate_id ?? "")).filter(Boolean)
  );

  const base = workerRows.filter((row) => {
    const id = String(row.id ?? "");
    const status = String(row.status ?? "").trim().toLowerCase();
    if (!id || converted.has(id) || status === "converted") return false;
    if (pipelineStatus) {
      if (pipelineStatus === "pending") return status === "pending" || status === "under_review";
      if (pipelineStatus === "new") return !status || status === "new";
      return status === pipelineStatus;
    }
    return isPipelineBaseStatus(status);
  });

  const inWindow = (iso: string | null | undefined, start: string, end: number) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t >= new Date(start).getTime() && t < end;
  };

  const newCurrent = base.filter((row) => inWindow(row.created_at, currentStart, now)).length;
  const newPrevious = base.filter((row) =>
    inWindow(row.created_at, previousStart, new Date(currentStart).getTime())
  ).length;
  const active = base.filter((row) => {
    const status = String(row.status ?? "").trim().toLowerCase();
    return status !== "disapproved" && status !== "rejected";
  });
  const activeCurrent = active.filter((row) => inWindow(row.created_at, currentStart, now)).length;
  const activePrevious = active.filter((row) =>
    inWindow(row.created_at, previousStart, new Date(currentStart).getTime())
  ).length;

  const workerIds = base.map((row) => String(row.id)).filter(Boolean);
  const analyzedIds = new Set<string>();
  const analyzedAtByWorker = new Map<string, string>();
  if (workerIds.length > 0) {
    const { data: analyzedRows, error: analyzedErr } = await queryInChunks(
      workerIds,
      async (chunk) =>
        supabase
          .from("job_applications")
          .select("worker_id, ai_analyzed_at, status")
          .eq("tenant_id", tenantId)
          .eq("ai_match_status", "ANALYZED")
          .in("worker_id", chunk)
    );
    // Analyzed is best-effort in fallback; don't zero the other cards if this fails.
    if (analyzedErr) {
      console.warn("[api/workers/metrics] analyzed fallback failed", errorMessage(analyzedErr));
    } else {
      for (const row of (analyzedRows ?? []) as Array<{
        worker_id?: string | null;
        ai_analyzed_at?: string | null;
        status?: string | null;
      }>) {
        const status = String(row.status ?? "").toLowerCase();
        if (status === "rejected" || status === "withdrawn") continue;
        const id = String(row.worker_id ?? "");
        if (!id) continue;
        analyzedIds.add(id);
        const at = row.ai_analyzed_at;
        if (at) {
          const prev = analyzedAtByWorker.get(id);
          if (!prev || new Date(at).getTime() > new Date(prev).getTime()) {
            analyzedAtByWorker.set(id, at);
          }
        }
      }
    }
  }

  const analyzedCurrent = [...analyzedAtByWorker.values()].filter((at) =>
    inWindow(at, currentStart, now)
  ).length;
  const analyzedPrevious = [...analyzedAtByWorker.values()].filter((at) =>
    inWindow(at, previousStart, new Date(currentStart).getTime())
  ).length;

  const hiredRows = employmentRows;
  const hiredCurrent = hiredRows.filter((row) => inWindow(row.created_at, currentStart, now)).length;
  const hiredPrevious = hiredRows.filter((row) =>
    inWindow(row.created_at, previousStart, new Date(currentStart).getTime())
  ).length;

  return {
    newCandidates: { value: newCurrent, previous: newPrevious },
    activeCandidates: {
      value: active.length,
      currentWindow: activeCurrent,
      previousWindow: activePrevious,
    },
    analyzed: {
      value: analyzedIds.size,
      currentWindow: analyzedCurrent,
      previousWindow: analyzedPrevious,
    },
    hired: {
      value: hiredRows.length,
      currentWindow: hiredCurrent,
      previousWindow: hiredPrevious,
    },
    totalCandidates: base.length,
  };
}

async function loadMetrics(
  supabase: SupabaseClient,
  tenantId: string,
  pipelineStatus: string | null
): Promise<CandidateKpiMetricsPayload> {
  try {
    return await loadMetricsViaRpc(supabase, tenantId, pipelineStatus);
  } catch (err) {
    console.warn("[api/workers/metrics] RPC failed, using fallback counts", errorMessage(err));
    return await loadMetricsFallback(supabase, tenantId, pipelineStatus);
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;
    const tenantScope = await resolveStaffTenantScope(auth.authUser);

    const emptyCards = buildCandidateKpiCardsFromMetrics(emptyCandidateKpiMetricsPayload());

    if (tenantScope.mode !== "scoped") {
      // Still return the four cards so the Candidates header never blanks out.
      return Response.json({
        metrics: emptyCandidateKpiMetricsPayload(),
        cards: emptyCards,
        timingMs: 0,
        warning: "Candidate metrics require a tenant-scoped staff session",
      });
    }

    const urlObj = new URL(req.url);
    const status = (urlObj.searchParams.get("status") ?? "").trim().toLowerCase() || null;

    const url = getSupabaseUrl();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const anonKey = getSupabaseAnonKey();
    const keys = [serviceKey, anonKey].filter((k): k is string => Boolean(k));
    if (!url || keys.length === 0) {
      return Response.json(
        {
          metrics: emptyCandidateKpiMetricsPayload(),
          cards: emptyCards,
          error: "Supabase is not configured",
        },
        { status: 503 }
      );
    }

    let lastError = "Failed to load candidate metrics";
    for (const key of keys) {
      try {
        const supabase = createClient(url, key);
        const started = Date.now();
        const metrics = await loadMetrics(supabase, tenantScope.tenantId, status);
        const cards = buildCandidateKpiCardsFromMetrics(metrics);
        return Response.json({
          metrics,
          cards,
          timingMs: Date.now() - started,
        });
      } catch (err) {
        lastError = errorMessage(err);
        const retry = lastError === "Invalid API key" && key === serviceKey && anonKey;
        if (!retry) {
          console.error("[api/workers/metrics]", err);
          return Response.json(
            {
              metrics: emptyCandidateKpiMetricsPayload(),
              cards: emptyCards,
              error: lastError,
            },
            { status: 500 }
          );
        }
      }
    }

    return Response.json(
      {
        metrics: emptyCandidateKpiMetricsPayload(),
        cards: emptyCards,
        error: lastError,
      },
      { status: 500 }
    );
  } catch (err: unknown) {
    console.error("[api/workers/metrics]", err);
    const message = errorMessage(err);
    const emptyCards = buildCandidateKpiCardsFromMetrics(emptyCandidateKpiMetricsPayload());
    return Response.json(
      {
        metrics: emptyCandidateKpiMetricsPayload(),
        cards: emptyCards,
        error: message,
      },
      { status: 500 }
    );
  }
}
