import { normalizeCityKey, normalizePostalCode, normalizeStateCode } from "@/lib/service-area/normalize";
import type { ServiceAreaLocation, ServiceAreaPolicy } from "@/lib/service-area/types";

function policyStates(policy: ServiceAreaPolicy): string[] {
  return policy.states.map((state) => normalizeStateCode(state)).filter(Boolean);
}

function policyCities(policy: ServiceAreaPolicy): string[] {
  return policy.cities.map((city) => normalizeCityKey(city)).filter(Boolean);
}

function zipSet(policy: ServiceAreaPolicy): Set<string> {
  return new Set(
    [...policy.postalCodes, ...(policy.matchType === "zip_list" ? policy.postalCodes : [])]
      .map((zip) => normalizePostalCode(zip))
      .filter(Boolean)
  );
}

export function locationMatchesPolicy(
  location: Pick<ServiceAreaLocation, "state" | "city" | "postalCode">,
  policy: ServiceAreaPolicy,
  zipList?: Set<string>
): boolean {
  if (!policy.isActive) return false;

  const state = normalizeStateCode(location.state);
  const city = normalizeCityKey(location.city);
  const postal = normalizePostalCode(location.postalCode);
  const states = policyStates(policy);
  const cities = policyCities(policy);
  const zips = zipList ?? zipSet(policy);

  if (policy.matchType === "state") {
    return Boolean(state) && states.includes(state);
  }

  if (policy.matchType === "zip_list") {
    return Boolean(postal) && zips.has(postal);
  }

  if (policy.matchType === "postal_prefix") {
    if (!postal) return false;
    return policy.postalCodes.some((prefix) => {
      const normalized = String(prefix).replace(/\D/g, "");
      return normalized.length > 0 && postal.startsWith(normalized);
    });
  }

  if (policy.matchType === "city_state" || policy.matchType === "custom") {
    if (postal && zips.has(postal)) return true;
    if (!state) return false;
    if (states.length && !states.includes(state)) return false;
    if (!city) return false;
    return cities.includes(city);
  }

  return false;
}

export function hiringLocationMatches(
  location: Pick<ServiceAreaLocation, "state" | "city" | "postalCode">,
  allowed: { city: string; state: string; postalCode?: string | null }
): boolean {
  const locState = normalizeStateCode(location.state);
  const allowedState = normalizeStateCode(allowed.state);
  if (!locState || !allowedState || locState !== allowedState) return false;

  const locZip = normalizePostalCode(location.postalCode);
  const allowedZip = normalizePostalCode(allowed.postalCode);
  if (locZip && allowedZip) return locZip === allowedZip;

  const locCity = normalizeCityKey(location.city);
  const allowedCity = normalizeCityKey(allowed.city);
  if (locCity && allowedCity) return locCity === allowedCity;

  return Boolean(locCity || allowedCity);
}
