import { normalizeServiceAreaLocationType } from "@/lib/service-area/location-type";
import { normalizeRemoteStates, normalizeStateCode } from "@/lib/service-area/normalize";
import type { ServiceAreaLocation } from "@/lib/service-area/types";

function asRecord(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
}

export function parseServiceAreaLocation(raw: unknown): ServiceAreaLocation | null {
  const body = asRecord(raw);
  if (!body) return null;
  const locationType = normalizeServiceAreaLocationType(
    String(body.locationType ?? body.location_type ?? "")
  );
  if (!locationType) return null;
  const remoteRaw = body.remoteAllowedStates ?? body.remote_allowed_states;
  return {
    country: "US",
    state: normalizeStateCode(String(body.state ?? "")) || String(body.state ?? "").trim() || null,
    city: String(body.city ?? "").trim() || null,
    postalCode: String(body.postalCode ?? body.postal_code ?? "").trim() || null,
    locationType,
    relocateToJobSite: body.relocateToJobSite === true || body.relocate_to_job_site === true,
    remoteAllowedStates: Array.isArray(remoteRaw) ? normalizeRemoteStates(remoteRaw.map(String)) : [],
  };
}

export function parseServiceAreaLocationFromSearchParams(
  params: URLSearchParams
): ServiceAreaLocation | null {
  const city = params.get("workCity")?.trim() || "";
  const state = params.get("workState")?.trim() || "";
  const postalCode = params.get("workPostal")?.trim() || params.get("workPostalCode")?.trim() || "";
  const relocate = params.get("relocateToJobSite") === "true";
  const locationType =
    normalizeServiceAreaLocationType(params.get("workLocationType") ?? "") ||
    (relocate ? "onsite" : city && state ? "onsite" : null);
  if (!locationType) return null;
  if (!state && locationType !== "remote") return null;
  return {
    country: "US",
    city: city || null,
    state: state || null,
    postalCode: postalCode || null,
    locationType,
    relocateToJobSite: relocate,
    remoteAllowedStates: [],
  };
}

export function parseServiceAreaLocationFromFormData(form: FormData): ServiceAreaLocation | null {
  const json = String(form.get("workLocation") ?? "").trim();
  if (json) {
    try {
      return parseServiceAreaLocation(JSON.parse(json));
    } catch {
      /* fall through to discrete fields */
    }
  }
  const city = String(form.get("workCity") ?? "").trim();
  const state = String(form.get("workState") ?? "").trim();
  const postalCode = String(form.get("workPostalCode") ?? form.get("workPostal") ?? "").trim();
  const relocate = String(form.get("relocateToJobSite") ?? "") === "true";
  const locationType =
    normalizeServiceAreaLocationType(String(form.get("workLocationType") ?? "")) ||
    (city && state ? "onsite" : null);
  if (!locationType || (!state && locationType !== "remote")) return null;
  return {
    country: "US",
    city: city || null,
    state: state || null,
    postalCode: postalCode || null,
    locationType,
    relocateToJobSite: relocate,
    remoteAllowedStates: [],
  };
}
