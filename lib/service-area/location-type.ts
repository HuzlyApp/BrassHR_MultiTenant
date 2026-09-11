import type { ServiceAreaLocationType } from "@/lib/service-area/types";

export function normalizeServiceAreaLocationType(
  raw: string | null | undefined
): ServiceAreaLocationType | null {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  if (!value) return null;
  if (value === "remote") return "remote";
  if (value === "hybrid" || value === "remote,-hybrid" || value === "remote-hybrid") {
    return "hybrid";
  }
  if (
    value === "onsite" ||
    value === "on-site" ||
    value === "in-person" ||
    value === "inperson"
  ) {
    return "onsite";
  }
  return null;
}

export function isRemoteJobLocationType(raw: string | null | undefined): boolean {
  return normalizeServiceAreaLocationType(raw) === "remote";
}

export function requiresWorksiteCityState(raw: string | null | undefined): boolean {
  const type = normalizeServiceAreaLocationType(raw);
  return type === "onsite" || type === "hybrid";
}
