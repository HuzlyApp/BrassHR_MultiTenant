import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessInfoValidationContext } from "@/lib/tenant/business-info-validation";
import { getStateCodeFromName } from "@/lib/us-state-names";

export async function resolveBusinessInfoValidationContext(
  supabase: SupabaseClient,
  stateName: string
): Promise<BusinessInfoValidationContext> {
  const { data: stateRow } = await supabase
    .from("signup_us_states")
    .select("code, name")
    .eq("name", stateName)
    .maybeSingle();

  // Fall back to the static name→code map when signup_us_states is empty/out of date
  // (otherwise ZIP validation falsely asks to "Select a state" after a state was chosen).
  // Accepts "Texas" or "TX".
  const stateCode =
    (stateRow?.code ? String(stateRow.code) : undefined) ||
    getStateCodeFromName(stateName);

  const { data: states } = await supabase
    .from("signup_us_states")
    .select("name")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  return {
    stateCode,
    allowedStateNames: (states ?? []).map((row) => String(row.name)),
  };
}
