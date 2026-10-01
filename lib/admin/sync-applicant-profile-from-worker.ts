import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkerProfileFieldKey } from "@/lib/admin/worker-profile-field-update";

/** Worker identity fields that must stay mirrored on applicant_profiles. */
export const APPLICANT_PROFILE_SYNC_FIELDS = new Set<WorkerProfileFieldKey>([
  "first_name",
  "last_name",
  "email",
  "phone",
  "address1",
  "city",
  "state",
  "zip",
]);

function buildCityStateZip(parts: {
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): string | null {
  const city = String(parts.city ?? "").trim();
  const state = String(parts.state ?? "").trim();
  const zip = String(parts.zip ?? "").trim();
  const left = [city, state].filter(Boolean).join(", ");
  const combined = [left, zip].filter(Boolean).join(" ").trim();
  return combined || null;
}

/**
 * Keep applicant_profiles in sync when staff edit the worker record.
 * Applications list and some résumé paths still read profile columns.
 */
export async function syncApplicantProfileFromWorkerField(args: {
  supabase: SupabaseClient;
  tenantId: string;
  workerId: string;
  field: WorkerProfileFieldKey;
  dbValue: string | number | null;
}): Promise<void> {
  const { supabase, tenantId, workerId, field, dbValue } = args;
  if (!APPLICANT_PROFILE_SYNC_FIELDS.has(field)) return;

  const { data: profiles, error: findError } = await supabase
    .from("applicant_profiles")
    .select("id, city_state_zip, street_address, email, phone, first_name, last_name")
    .eq("tenant_id", tenantId)
    .eq("worker_id", workerId);
  if (findError) throw findError;
  if (!profiles?.length) return;

  const now = new Date().toISOString();
  const stringValue =
    dbValue == null ? null : typeof dbValue === "number" ? String(dbValue) : dbValue.trim() || null;

  for (const profile of profiles) {
    const patch: Record<string, unknown> = { updated_at: now };

    switch (field) {
      case "first_name":
        patch.first_name = stringValue;
        break;
      case "last_name":
        patch.last_name = stringValue;
        break;
      case "email":
        patch.email = stringValue;
        if (stringValue) patch.normalized_email = stringValue.toLowerCase();
        break;
      case "phone":
        patch.phone = stringValue;
        break;
      case "address1":
        patch.street_address = stringValue;
        break;
      case "city":
      case "state":
      case "zip": {
        const { data: worker } = await supabase
          .from("worker")
          .select("city, state, zip")
          .eq("id", workerId)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        patch.city_state_zip = buildCityStateZip({
          city: field === "city" ? stringValue : worker?.city,
          state: field === "state" ? stringValue : worker?.state,
          zip: field === "zip" ? stringValue : worker?.zip,
        });
        break;
      }
      default:
        continue;
    }

    const { error: updateError } = await supabase
      .from("applicant_profiles")
      .update(patch)
      .eq("id", profile.id)
      .eq("tenant_id", tenantId);
    if (updateError) throw updateError;
  }
}
