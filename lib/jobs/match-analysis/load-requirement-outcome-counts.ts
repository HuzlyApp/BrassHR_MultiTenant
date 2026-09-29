import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseQuickRoute } from "./quick-route";
import type { QuickRoute } from "./schema";
import {
  EMPTY_LISTING_REQUIREMENT_COUNTS,
  groupRequirementOutcomeCountsByApplication,
  type ListingRequirementOutcomeCounts,
  type RequirementOutcomeCountRow,
} from "./workspace";

/** One `.in()` stays exact in JS. Larger lists use the grouped RPC. */
const APPLICATION_ID_CHUNK = 70;
/** Page size for requirement-row reads (PostgREST default max_rows is 1000). */
const REQUIREMENT_ROW_PAGE = 1000;

type RequirementCountQueryRow = RequirementOutcomeCountRow & {
  job_application_id: string;
};

async function loadQuickRoutesByApplication(
  supabase: SupabaseClient,
  tenantId: string,
  applicationIds: string[]
): Promise<Map<string, QuickRoute>> {
  const chunks: string[][] = [];
  for (let offset = 0; offset < applicationIds.length; offset += APPLICATION_ID_CHUNK) {
    chunks.push(applicationIds.slice(offset, offset + APPLICATION_ID_CHUNK));
  }
  const pages = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase
        .from("job_applications")
        .select("id, quick_route:ai_analysis->quick_match->>quick_route")
        .eq("tenant_id", tenantId)
        .eq("ai_match_status", "ANALYZED")
        .in("id", chunk);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; quick_route: unknown }>;
    })
  );
  const routes = new Map<string, QuickRoute>();
  for (const row of pages.flat()) {
    const route = parseQuickRoute(row.quick_route);
    if (route) routes.set(String(row.id), route);
  }
  return routes;
}

/**
 * Load Conf / Verify / Not Met aggregates for listing screens, plus the stored Quick Match route.
 * Pages past the PostgREST 1000-row cap so limit=100 listings are not silently truncated.
 */
export async function loadRequirementOutcomeCountsByApplication(
  supabase: SupabaseClient,
  tenantId: string,
  applicationIds: string[]
): Promise<Map<string, ListingRequirementOutcomeCounts>> {
  const unique = [...new Set(applicationIds.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) return new Map();
  const [grouped, routes] = await Promise.all([
    loadOutcomeCounts(supabase, tenantId, unique),
    loadQuickRoutesByApplication(supabase, tenantId, unique),
  ]);
  for (const [id, quickRoute] of routes) {
    grouped.set(id, { ...(grouped.get(id) ?? EMPTY_LISTING_REQUIREMENT_COUNTS), quickRoute });
  }
  return grouped;
}

async function loadOutcomeCounts(
  supabase: SupabaseClient,
  tenantId: string,
  unique: string[]
): Promise<Map<string, ListingRequirementOutcomeCounts>> {
  if (unique.length > APPLICATION_ID_CHUNK) {
    const { data, error } = await supabase.rpc("job_application_requirement_counts", {
      p_tenant_id: tenantId,
      p_application_ids: unique,
    });
    if (error) throw error;
    const grouped = new Map<string, ListingRequirementOutcomeCounts>();
    for (const row of (data ?? []) as Array<{
      job_application_id?: string;
      confirmed?: number;
      verify?: number;
      not_met?: number;
      mandatory?: number;
      blocking?: number;
    }>) {
      const id = String(row.job_application_id ?? "").trim();
      if (!id) continue;
      grouped.set(id, {
        confirmed: Number(row.confirmed ?? 0),
        verify: Number(row.verify ?? 0),
        notMet: Number(row.not_met ?? 0),
        mandatory: Number(row.mandatory ?? 0),
        blocking: Number(row.blocking ?? 0),
      });
    }
    return grouped;
  }

  const allRows: RequirementCountQueryRow[] = [];

  for (let offset = 0; offset < unique.length; offset += APPLICATION_ID_CHUNK) {
    const chunk = unique.slice(offset, offset + APPLICATION_ID_CHUNK);
    for (let from = 0; ; from += REQUIREMENT_ROW_PAGE) {
      const { data, error } = await supabase
        .from("job_application_match_requirements")
        .select(
          "job_application_id, requirement_type, status, requirement_outcome, verification_required, recruiter_verified"
        )
        .eq("tenant_id", tenantId)
        .in("job_application_id", chunk)
        .range(from, from + REQUIREMENT_ROW_PAGE - 1);
      if (error) throw error;
      const page = (data ?? []) as RequirementCountQueryRow[];
      allRows.push(...page);
      if (page.length < REQUIREMENT_ROW_PAGE) break;
    }
  }

  return groupRequirementOutcomeCountsByApplication(allRows);
}

/** Listing counts for an ANALYZED application — never null (avoids "—" when checklist is empty). */
export function listingCountsForAnalyzedApplication(
  countsByApplication: Map<string, ListingRequirementOutcomeCounts>,
  applicationId: string,
  status: string | null | undefined
): ListingRequirementOutcomeCounts | null {
  const id = applicationId.trim();
  if (!id) return null;
  const existing = countsByApplication.get(id);
  if (existing) return existing;
  if (String(status ?? "").toUpperCase() === "ANALYZED") {
    return { ...EMPTY_LISTING_REQUIREMENT_COUNTS };
  }
  return null;
}
