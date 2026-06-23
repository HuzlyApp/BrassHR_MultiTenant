import type { FacilityListItem } from "@/lib/facilities/types";

export function isConfirmedFacilityAssignment(status: string | null | undefined): boolean {
  const normalized = (status ?? "confirmed").trim().toLowerCase();
  return normalized === "confirmed" || normalized === "assigned";
}

export function filterConfirmedAssignedFacilities(facilities: FacilityListItem[]): FacilityListItem[] {
  return facilities.filter((facility) => isConfirmedFacilityAssignment(facility.assignmentStatus));
}
