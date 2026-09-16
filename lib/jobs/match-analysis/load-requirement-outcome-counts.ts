import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMPTY_LISTING_REQUIREMENT_COUNTS,
  groupRequirementOutcomeCountsByApplication,
  type ListingRequirementOutcomeCounts,
  type RequirementOutcomeCountRow,
} from "./workspace";

/** Keep each `.in()` batch small so requirement rows stay under PostgREST's ~1000-row cap. */
const APPLICATION_ID_CHUNK = 40;
/** Page size for requirement-row reads (PostgREST default max_rows is 1000). */
const REQUIREMENT_ROW_PAGE = 1000;

type RequirementCountQueryRow = RequirementOutcomeCountRow & {
  job_application_id: string;
};

/**
 * Load Conf / Verify / Not Met aggregates for listing screens.
 * Pages past the PostgREST 1000-row cap so limit=100 listings are not silently truncated.
 */
export async function loadRequirementOutcomeCountsByApplication(
  supabase: SupabaseClient,
  tenantId: string,
  applicationIds: string[]
): Promise<Map<string, ListingRequirementOutcomeCounts>> {
  const unique = [...new Set(applicationIds.map((id) => id.trim()).filter(Boolean))];
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
