import type { SupabaseClient } from "@supabase/supabase-js"
import type { UsTimezoneOption } from "./us-timezones"

export type ReferenceUsTimezoneRow = {
  value: string
  label: string
  region: string
  region_sort_order: number
  sort_order: number
  active: boolean
}

function isMissingTableError(error: { message?: string }): boolean {
  return /not find|does not exist|schema cache/i.test(error.message ?? "")
}

export function mapReferenceTimezoneRow(row: ReferenceUsTimezoneRow): UsTimezoneOption {
  return {
    value: row.value,
    label: row.label,
    region: row.region,
    regionSortOrder: row.region_sort_order,
    sortOrder: row.sort_order,
  }
}

export async function loadReferenceUsTimezones(
  supabase: SupabaseClient,
  options?: { includeInactive?: boolean }
): Promise<UsTimezoneOption[]> {
  let query = supabase
    .from("reference_us_timezones")
    .select("value, label, region, region_sort_order, sort_order, active")
    .order("region_sort_order", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true })

  if (!options?.includeInactive) {
    query = query.eq("active", true)
  }

  const { data, error } = await query

  if (error) {
    if (isMissingTableError(error)) return []
    throw error
  }

  return ((data ?? []) as ReferenceUsTimezoneRow[]).map(mapReferenceTimezoneRow)
}

const PREFERRED_DEFAULT_TIMEZONE = "America/New_York"

/** First active timezone from reference catalog, preferring Eastern default. */
export async function resolveDefaultAccountTimezone(
  supabase: SupabaseClient
): Promise<string | null> {
  if (await isActiveReferenceTimezone(supabase, PREFERRED_DEFAULT_TIMEZONE)) {
    return PREFERRED_DEFAULT_TIMEZONE
  }

  const options = await loadReferenceUsTimezones(supabase)
  return options[0]?.value ?? null
}

export async function isActiveReferenceTimezone(
  supabase: SupabaseClient,
  value: string
): Promise<boolean> {
  const trimmed = value.trim()
  if (!trimmed) return false

  const { data, error } = await supabase
    .from("reference_us_timezones")
    .select("value")
    .eq("value", trimmed)
    .eq("active", true)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return false
    throw error
  }

  return Boolean(data?.value)
}

export async function loadReferenceTimezoneByValue(
  supabase: SupabaseClient,
  value: string
): Promise<UsTimezoneOption | null> {
  const trimmed = value.trim()
  if (!trimmed) return null

  const { data, error } = await supabase
    .from("reference_us_timezones")
    .select("value, label, region, region_sort_order, sort_order, active")
    .eq("value", trimmed)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw error
  }

  if (!data) return null
  return mapReferenceTimezoneRow(data as ReferenceUsTimezoneRow)
}
