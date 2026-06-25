import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessInfoValidationContext } from "@/lib/tenant/business-info-validation";

export async function resolveBusinessInfoValidationContext(
  supabase: SupabaseClient,
  stateName: string
): Promise<BusinessInfoValidationContext> {
  const { data: stateRow } = await supabase
    .from("signup_us_states")
    .select("code, name")
    .eq("name", stateName)
    .maybeSingle();

  const stateCode = stateRow?.code ? String(stateRow.code) : undefined;
  let allowedCityNames: string[] | undefined;

  if (stateCode) {
    const { data: cities } = await supabase
      .from("signup_us_cities")
      .select("city_name")
      .eq("state_code", stateCode)
      .order("sort_order", { ascending: true })
      .order("city_name", { ascending: true });

    const names = (cities ?? []).map((row) => String(row.city_name));
    if (names.length > 0) {
      allowedCityNames = names;
    }
  }

  const { data: states } = await supabase
    .from("signup_us_states")
    .select("name")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  return {
    stateCode,
    allowedCityNames,
    allowedStateNames: (states ?? []).map((row) => String(row.name)),
  };
}
