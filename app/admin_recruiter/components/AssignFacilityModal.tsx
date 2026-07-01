"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Circle, Plus, X } from "lucide-react";
import BrandedHistoryIcon from "./BrandedHistoryIcon";
import type { FacilityAssignmentsMeta, FacilityAssignmentsResponse } from "@/lib/facilities/types";

const EMPTY_ASSIGNMENTS: FacilityAssignmentsResponse = {
  active: [],
  potential: [],
  recent: [],
  meta: {
    tenantId: "",
    assignedFacilityIds: [],
    totalTenantFacilities: 0,
    unassignedCount: 0,
    assignedCount: 0,
  },
};

const FACILITIES_LOAD_ERROR = "Unable to load facilities. Please try again.";

function getAssignModalAvailableEmptyMessage(meta: FacilityAssignmentsMeta): string {
  if (meta.totalTenantFacilities === 0) {
    return "No facilities are available for this tenant.";
  }
  if (meta.unassignedCount === 0 && meta.assignedCount > 0) {
    return "All tenant facilities are already assigned to this candidate.";
  }
  return "No facilities are available to assign.";
}

type AssignFacilityModalProps = {
  open: boolean;
  workerId: string;
  onClose: () => void;
  onAssigned?: () => void | Promise<void>;
};

export default function AssignFacilityModal({
  open,
  workerId,
  onClose,
  onAssigned,
}: AssignFacilityModalProps) {
  const [assignments, setAssignments] = useState<FacilityAssignmentsResponse>(EMPTY_ASSIGNMENTS);
  const [facilitiesError, setFacilitiesError] = useState<string | null>(null);
  const [assigningFacilityId, setAssigningFacilityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadFacilities = useCallback(async () => {
    if (!workerId) return;
    setLoading(true);
    setFacilitiesError(null);
    try {
      const res = await fetch(
        `/api/admin/facility-assignments?workerId=${encodeURIComponent(workerId)}`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as FacilityAssignmentsResponse & { error?: string };
      if (!res.ok) {
        throw new Error(FACILITIES_LOAD_ERROR);
      }
      setAssignments({
        ...json,
        meta: json.meta ?? EMPTY_ASSIGNMENTS.meta,
      });
    } catch (e) {
      console.error("Failed to fetch facility assignments:", e);
      setFacilitiesError(FACILITIES_LOAD_ERROR);
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    if (!open) return;
    void loadFacilities();
  }, [open, loadFacilities]);

  const assignFacilityToCandidate = useCallback(
    async (facilityId: string) => {
      if (!workerId) return;
      setAssigningFacilityId(facilityId);
      try {
        const res = await fetch("/api/admin/facility-assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workerId, facilityId }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          alreadyAssigned?: boolean;
        };
        if (!res.ok) {
          throw new Error(json.error || "Failed to assign facility.");
        }
        toast.success(
          json.alreadyAssigned
            ? "Facility is already assigned to this candidate."
            : "Facility assigned successfully."
        );
        await onAssigned?.();
        onClose();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to assign facility.";
        toast.error(msg);
      } finally {
        setAssigningFacilityId(null);
      }
    },
    [workerId, onAssigned, onClose]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-[1080px] rounded-[22px] bg-white shadow-[0_18px_38px_rgba(2,8,23,0.2)]">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-8 py-6">
          <h2 className="text-2xl font-semibold leading-none text-[#1F2937]">Assign to facility</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white"
            aria-label="Close assign facility modal"
          >
            <X className="h-7 w-7" />
          </button>
        </div>

        <div className="px-8 pb-8 pt-5">
          <div className="max-h-[64vh] space-y-8 overflow-auto pr-2">
            {loading ? (
              <div className="py-8 text-center text-sm text-[#6B7280]">Loading facilities...</div>
            ) : facilitiesError ? (
              <div className="py-8 text-center text-sm text-red-700">{FACILITIES_LOAD_ERROR}</div>
            ) : (
              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-[#1F2937]">Available Facilities to Assign</h3>
                  <span className="text-sm text-[#6B7280]">
                    {assignments.potential.length}{" "}
                    {assignments.potential.length === 1 ? "facility" : "facilities"}
                  </span>
                </div>

                {assignments.potential.length === 0 ? (
                  <div className="py-6 text-center text-sm text-[#6B7280]">
                    {getAssignModalAvailableEmptyMessage(assignments.meta)}
                  </div>
                ) : (
                  assignments.potential.map((facility) => (
                    <div
                      key={`assign-${facility.id}`}
                      className="flex items-center justify-between border-b border-[#E5E7EB] py-5"
                    >
                      <div className="flex items-center gap-4">
                        <BrandedHistoryIcon className="h-11 w-11" />
                        <div>
                          <div className="text-sm font-medium leading-none text-black">{facility.name}</div>
                          <div className="mt-1 text-xs font-normal leading-none text-[#6B7280]">
                            {facility.primaryAddress || "No address on file"}
                          </div>
                          {facility.contactPerson ? (
                            <div className="mt-1 text-xs text-[#6B7280]">
                              Contact: {facility.contactPerson}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={assigningFacilityId === facility.id}
                        onClick={() => void assignFacilityToCandidate(facility.id)}
                        className="inline-flex items-center gap-5 px-2 py-1 text-[#0D9488] disabled:opacity-50"
                        aria-label={`Add ${facility.name}`}
                      >
                        <Circle className="h-5 w-5 fill-current stroke-current" />
                        <Plus className="h-6 w-6" />
                      </button>
                    </div>
                  ))
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
