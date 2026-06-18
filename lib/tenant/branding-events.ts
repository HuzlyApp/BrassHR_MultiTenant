export const BRANDING_UPDATED_EVENT = "brasshr:branding-updated";

export function notifyBrandingUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BRANDING_UPDATED_EVENT));
}
