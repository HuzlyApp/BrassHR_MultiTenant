/** Public copy bank (BRASSHR-FS-GEO-001 §6.6). Legal can change text without logic changes. */

export const SERVICE_AREA_COPY = {
  location_not_available: "This work location isn’t available yet.",
  location_not_enabled: "This work location isn’t available yet.",
  signup_waitlist: "BrassHR isn’t available for this business location yet.",
  opening_unavailable: "This opening is no longer available.",
  empty_city_search: "No openings in that city right now. Try another location.",
  attach_blocked: "This work location isn’t available yet.",
} as const;

export type ServiceAreaMessageKey = keyof typeof SERVICE_AREA_COPY;

export function serviceAreaMessage(key: string | null | undefined): string {
  if (key && key in SERVICE_AREA_COPY) {
    return SERVICE_AREA_COPY[key as ServiceAreaMessageKey];
  }
  return SERVICE_AREA_COPY.location_not_available;
}

/** Read staff/public API envelopes without leaking hold names. */
export function readServiceAreaApiMessage(
  payload: unknown,
  fallback: string = SERVICE_AREA_COPY.location_not_enabled
): string {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  if (typeof record.messageKey === "string") {
    return serviceAreaMessage(record.messageKey);
  }
  const error = record.error;
  if (error && typeof error === "object") {
    const nested = error as Record<string, unknown>;
    if (typeof nested.messageKey === "string") {
      return serviceAreaMessage(nested.messageKey);
    }
    if (typeof nested.message === "string" && nested.message.trim()) {
      return nested.message;
    }
  }
  if (typeof error === "string" && error.trim()) return error;
  const fieldErrors = record.fieldErrors;
  if (fieldErrors && typeof fieldErrors === "object") {
    const fields = fieldErrors as Record<string, unknown>;
    for (const key of ["location", "work_state", "worksite_state", "remoteAllowedStates"]) {
      const value = fields[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return fallback;
}
