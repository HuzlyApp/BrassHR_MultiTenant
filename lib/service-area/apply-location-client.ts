import type { ServiceAreaLocation } from "@/lib/service-area/types";

export function applyLocationStorageKey(tenantSlug: string, jobToken: string): string {
  return `service-area-apply:${tenantSlug}:${jobToken}`;
}

export function writeStoredApplyLocation(
  tenantSlug: string,
  jobToken: string,
  location: Pick<ServiceAreaLocation, "city" | "state" | "postalCode" | "locationType" | "relocateToJobSite">
): void {
  try {
    sessionStorage.setItem(applyLocationStorageKey(tenantSlug, jobToken), JSON.stringify(location));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readStoredApplyLocation(
  tenantSlug: string,
  jobToken: string
): {
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  locationType: "onsite" | "hybrid" | "remote";
  relocateToJobSite?: boolean;
} | null {
  try {
    const raw = sessionStorage.getItem(applyLocationStorageKey(tenantSlug, jobToken));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const locationType = parsed.locationType;
    if (locationType !== "onsite" && locationType !== "hybrid" && locationType !== "remote") {
      return null;
    }
    return {
      city: typeof parsed.city === "string" ? parsed.city : null,
      state: typeof parsed.state === "string" ? parsed.state : null,
      postalCode: typeof parsed.postalCode === "string" ? parsed.postalCode : null,
      locationType,
      relocateToJobSite: parsed.relocateToJobSite === true,
    };
  } catch {
    return null;
  }
}

export function storedApplyLocationSearchParams(
  tenantSlug: string,
  jobToken: string
): URLSearchParams {
  const location = readStoredApplyLocation(tenantSlug, jobToken);
  const params = new URLSearchParams();
  if (!location) return params;
  if (location.city) params.set("workCity", location.city);
  if (location.state) params.set("workState", location.state);
  if (location.postalCode) params.set("workPostal", location.postalCode);
  params.set("workLocationType", location.locationType);
  params.set("relocateToJobSite", location.relocateToJobSite ? "true" : "false");
  return params;
}
