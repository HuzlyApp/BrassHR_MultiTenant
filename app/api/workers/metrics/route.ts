import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";
import {
  buildCandidateKpiCardsFromMetrics,
  normalizeCandidateKpiMetricsPayload,
  type CandidateKpiMetricsPayload,
} from "@/lib/workers/candidate-kpi-metrics";

async function loadMetrics(
  supabase: SupabaseClient,
  tenantId: string,
  pipelineStatus: string | null
): Promise<CandidateKpiMetricsPayload> {
  const { data, error } = await supabase.rpc("candidate_kpi_metrics", {
    p_tenant_id: tenantId,
    p_pipeline_status: pipelineStatus,
  });
  if (error) throw error;
  return normalizeCandidateKpiMetricsPayload(data);
}

export async function GET(req: Request) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;
    const tenantScope = await resolveStaffTenantScope(auth.authUser);

    if (tenantScope.mode !== "scoped") {
      return Response.json(
        { error: "Candidate metrics require a tenant-scoped staff session" },
        { status: 403 }
      );
    }

    const urlObj = new URL(req.url);
    const status = (urlObj.searchParams.get("status") ?? "").trim().toLowerCase() || null;

    const url = getSupabaseUrl();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const anonKey = getSupabaseAnonKey();
    const keys = [serviceKey, anonKey].filter((k): k is string => Boolean(k));
    if (!url || keys.length === 0) {
      return Response.json({ error: "Supabase is not configured" }, { status: 503 });
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
        lastError = err instanceof Error ? err.message : "Failed to load candidate metrics";
        const retry = lastError === "Invalid API key" && key === serviceKey && anonKey;
        if (!retry) {
          console.error("[api/workers/metrics]", err);
          return Response.json({ error: lastError }, { status: 500 });
        }
      }
    }

    return Response.json({ error: lastError }, { status: 500 });
  } catch (err: unknown) {
    console.error("[api/workers/metrics]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
