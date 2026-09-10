/** Public copy bank (BRASSHR-FS-GEO-001 §6.6). Legal can change text without logic changes. */

export const SERVICE_AREA_COPY = {
  location_not_available:
    "This opening isn’t available for work in the location you selected. Update work location or browse other openings.",
  location_not_enabled: "This work location isn’t enabled for your account yet.",
  signup_waitlist:
    "Thanks — BrassHR isn’t available for this business location yet. We’ll email you when it is. You can update the primary location if this was a mistake.",
  opening_unavailable: "This opening is no longer available.",
  empty_city_search: "No openings in that city right now. Try another location.",
  attach_blocked: "We can’t add this person to this opening for the selected work location.",
} as const;

export type ServiceAreaMessageKey = keyof typeof SERVICE_AREA_COPY;

export function serviceAreaMessage(key: string | null | undefined): string {
  if (key && key in SERVICE_AREA_COPY) {
    return SERVICE_AREA_COPY[key as ServiceAreaMessageKey];
  }
  return SERVICE_AREA_COPY.location_not_available;
}
