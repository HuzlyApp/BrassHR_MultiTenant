"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Circle, Plus, Search, X } from "lucide-react";
import { CandidateListAvatar } from "@/app/admin_recruiter/components/CandidateListAvatar";
import type { FacilityAssignableCandidate } from "@/lib/facilities/types";

const WORKERS_LOAD_ERROR = "Unable to load workers. Please try again.";

type AssignCandidateToFacilityModalProps = {
  open: boolean;
  facilityId: string;
  facilityName: string;
  onClose: () => void;
  onAssigned?: () => void | Promise<void>;
};

export default function AssignCandidateToFacilityModal({
  open,
  facilityId,
  facilityName,
  onClose,
  onAssigned,
}: AssignCandidateToFacilityModalProps) {
  const [workers, setWorkers] = useState<FacilityAssignableCandidate[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [assigningWorkerId, setAssigningWorkerId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const loadWorkers = useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/admin/facilities/${encodeURIComponent(facilityId)}/assignable-candidates`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as {
        candidates?: FacilityAssignableCandidate[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || WORKERS_LOAD_ERROR);
      }
      setWorkers(json.candidates ?? []);
    } catch (error) {
      console.error("[AssignCandidateToFacilityModal] load workers failed", error);
      setLoadError(WORKERS_LOAD_ERROR);
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    void loadWorkers();
  }, [open, loadWorkers]);

  const filteredWorkers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter((worker) => {
      const haystack = [
        worker.name,
        worker.email,
        worker.jobRole,
        worker.status,
        worker.location,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [workers, query]);

  const assignWorker = useCallback(
    async (worker: FacilityAssignableCandidate) => {
      if (!worker.hasLinkedAccount) {
        toast.error("This worker account is not linked yet and cannot be assigned.");
        return;
      }

      setAssigningWorkerId(worker.workerId);
      try {
        const res = await fetch("/api/admin/facility-assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workerId: worker.workerId, facilityId }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          alreadyAssigned?: boolean;
        };
        if (!res.ok) {
          throw new Error(json.error || "Failed to assign worker to facility.");
        }
        toast.success(
          json.alreadyAssigned
            ? "Worker is already assigned to this facility."
            : `${worker.name} assigned to ${facilityName}.`
        );
        await onAssigned?.();
        onClose();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to assign worker to facility.";
        toast.error(message);
      } finally {
        setAssigningWorkerId(null);
      }
    },
    [facilityId, facilityName, onAssigned, onClose]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-worker-to-facility-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[760px] rounded-[22px] bg-white shadow-[0_18px_38px_rgba(2,8,23,0.2)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-5 sm:px-8 sm:py-6">
          <div className="min-w-0 pr-4">
            <h2
              id="assign-worker-to-facility-title"
              className="text-xl font-semibold leading-tight text-[#1F2937] sm:text-2xl"
            >
              Assign Worker
            </h2>
            <p className="mt-1 truncate text-sm text-[#6B7280]">{facilityName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white"
            aria-label="Close assign worker modal"
          >
            <X className="h-7 w-7" />
          </button>
        </div>

        <div className="px-6 pb-6 pt-4 sm:px-8 sm:pb-8">
          <label className="relative mb-4 block">
            <span className="sr-only">Search workers</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search workers by name, email, or role"
              className="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white py-2 pl-9 pr-3 text-sm text-[#111827] outline-none focus:border-[color:var(--brand-primary)] focus:ring-1 focus:ring-[color:var(--brand-primary)]"
            />
          </label>

          <div className="max-h-[52vh] overflow-auto pr-1">
            {loading ? (
              <div className="py-10 text-center text-sm text-[#6B7280]">Loading workers...</div>
            ) : loadError ? (
              <div className="py-10 text-center text-sm text-red-700">{loadError}</div>
            ) : filteredWorkers.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#6B7280]">
                {workers.length === 0
                  ? "No workers are available to assign to this facility."
                  : "No workers match your search."}
              </div>
            ) : (
              <ul className="divide-y divide-[#E5E7EB]">
                {filteredWorkers.map((worker) => {
                  const disabled =
                    assigningWorkerId === worker.workerId || !worker.hasLinkedAccount;
                  return (
                    <li
                      key={worker.workerId}
                      className="flex items-center justify-between gap-3 py-4"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <CandidateListAvatar name={worker.name} photoUrl={null} size="sm" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[#111827]">
                            {worker.name}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-[#6B7280]">
                            {[worker.jobRole, worker.location].filter(Boolean).join(" • ") ||
                              "—"}
                          </div>
                          {worker.email ? (
                            <div className="mt-0.5 truncate text-xs text-[#94A3B8]">
                              {worker.email}
                            </div>
                          ) : null}
                          {!worker.hasLinkedAccount ? (
                            <div className="mt-1 text-xs font-medium text-amber-700">
                              Account not linked — cannot assign yet
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => void assignWorker(worker)}
                        className="inline-flex shrink-0 items-center gap-3 px-2 py-1 text-[color:var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`Assign ${worker.name}`}
                      >
                        <Circle className="h-5 w-5 fill-current stroke-current" />
                        <Plus className="h-6 w-6" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
