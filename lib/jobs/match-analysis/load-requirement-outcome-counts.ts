import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  groupRequirementOutcomeCountsByApplication,
  type ListingRequirementOutcomeCounts,
  type RequirementOutcomeCountRow,
} from "./workspace";

const CHUNK = 200;

type RequirementCountQueryRow = RequirementOutcomeCountRow & {
  job_application_id: string;
};

export async function loadRequirementOutcomeCountsByApplication(
  supabase: SupabaseClient,
  tenantId: string,
  applicationIds: string[]
): Promise<Map<string, ListingRequirementOutcomeCounts>> {
  const unique = [...new Set(applicationIds.map((id) => id.trim()).filter(Boolean))];
  const allRows: RequirementCountQueryRow[] = [];

  for (let offset = 0; offset < unique.length; offset += CHUNK) {
    const chunk = unique.slice(offset, offset + CHUNK);
    const { data, error } = await supabase
      .from("job_application_match_requirements")
      .select(
        "job_application_id, requirement_type, status, requirement_outcome, verification_required, recruiter_verified"
      )
      .eq("tenant_id", tenantId)
      .in("job_application_id", chunk);
    if (error) throw error;
    allRows.push(...((data ?? []) as RequirementCountQueryRow[]));
  }

  return groupRequirementOutcomeCountsByApplication(allRows);
}
