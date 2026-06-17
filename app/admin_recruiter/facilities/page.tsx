"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Building2, Loader2, Plus, Search } from "lucide-react";
import CreateFacilityModal from "@/app/admin_recruiter/components/CreateFacilityModal";
import {
  CANDIDATES_PAGE_SUBTITLE_CLASS,
  CANDIDATES_PAGE_SUBTITLE_STYLE,
  CANDIDATES_PAGE_TITLE_CLASS,
  CANDIDATES_PAGE_TITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";
import { candidateStatusBadgeClassName } from "@/app/admin_recruiter/candidates/candidate-status-badge";
import { filterFacilitiesBySearch } from "@/lib/facilities/facility-management-service";
import type { FacilityAssignedWorker, FacilityManagementItem } from "@/lib/facilities/types";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function titleCaseStatus(value: string | null | undefined) {
  const v = (value || "").trim();
  if (!v) return "—";
  const low = v.toLowerCase();
  return low.slice(0, 1).toUpperCase() + low.slice(1);
}

function workerName(worker: FacilityAssignedWorker) {
  const name = `${worker.firstName ?? ""} ${worker.lastName ?? ""}`.trim();
  return name || "Unnamed candidate";
}

function FacilityCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-[#E5E7EB] bg-white p-4">
      <div className="mb-3 h-5 w-2/3 rounded bg-[#E5E7EB]" />
      <div className="mb-2 h-4 w-full rounded bg-[#F3F4F6]" />
      <div className="h-4 w-1/2 rounded bg-[#F3F4F6]" />
    </div>
  );
}

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<FacilityManagementItem[]>([]);
  const [loadingFacilities, setLoadingFacilities] = useState(true);
  const [facilitiesError, setFacilitiesError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [assignedWorkers, setAssignedWorkers] = useState<FacilityAssignedWorker[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadFacilities = useCallback(async () => {
    setLoadingFacilities(true);
    setFacilitiesError(null);
    try {
      const res = await fetch("/api/admin/facilities", { cache: "no-store" });
      const json = (await res.json()) as {
        facilities?: FacilityManagementItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Unable to load facilities.");
      setFacilities(json.facilities ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load facilities.";
      console.error("[FacilitiesPage] load facilities failed", error);
      setFacilitiesError(message);
      setFacilities([]);
    } finally {
      setLoadingFacilities(false);
    }
  }, []);

  const loadAssignments = useCallback(async (facilityId: string) => {
    setLoadingAssignments(true);
    setAssignmentsError(null);
    try {
      const res = await fetch(`/api/admin/facilities/${encodeURIComponent(facilityId)}/assignments`, {
        cache: "no-store",
      });
      const json = (await res.json()) as { workers?: FacilityAssignedWorker[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Unable to load assigned candidates.");
      setAssignedWorkers(json.workers ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load assigned candidates.";
      console.error("[FacilitiesPage] load assignments failed", error);
      setAssignmentsError(message);
      setAssignedWorkers([]);
    } finally {
      setLoadingAssignments(false);
    }
  }, []);

  useEffect(() => {
    void loadFacilities();
  }, [loadFacilities]);

  useEffect(() => {
    if (!selectedFacilityId) {
      setAssignedWorkers([]);
      setAssignmentsError(null);
      return;
    }
    void loadAssignments(selectedFacilityId);
  }, [selectedFacilityId, loadAssignments]);

  const filteredFacilities = useMemo(
    () => filterFacilitiesBySearch(facilities, searchQuery),
    [facilities, searchQuery]
  );

  const selectedFacility = useMemo(
    () => facilities.find((facility) => facility.id === selectedFacilityId) ?? null,
    [facilities, selectedFacilityId]
  );

  useEffect(() => {
    if (selectedFacilityId && !facilities.some((facility) => facility.id === selectedFacilityId)) {
      setSelectedFacilityId(null);
    }
  }, [facilities, selectedFacilityId]);

  const facilitiesEmptyMessage = useMemo(() => {
    if (facilities.length === 0) return "No facilities found. Create a facility to get started.";
    if (searchQuery.trim()) return "No facilities match your search.";
    return "No facilities found.";
  }, [facilities.length, searchQuery]);

  return (
    <div className="px-5 pb-8 pt-5 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={CANDIDATES_PAGE_TITLE_CLASS} style={CANDIDATES_PAGE_TITLE_STYLE}>
            Facilities
          </h1>
          <p className={CANDIDATES_PAGE_SUBTITLE_CLASS} style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
            View facilities and assigned candidates
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-(--brand-primary) px-4 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Create Facility
        </button>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name, address, city, state, or ZIP"
            className="h-10 w-full rounded-lg border border-[#D8E0EA] py-2 pl-9 pr-3 text-sm text-[#0F172A] outline-none focus:border-(--brand-primary)"
          />
        </div>
        <div className="text-sm text-[#64748B]">
          {loadingFacilities ? "Loading..." : `${filteredFacilities.length} facilities`}
        </div>
      </div>

      {facilitiesError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {facilitiesError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold text-[#111827]">All Facilities</h2>

          {loadingFacilities ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <FacilityCardSkeleton key={`facility-skeleton-${index}`} />
              ))}
            </div>
          ) : filteredFacilities.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#D1D5DB] bg-[#F9FAFB] px-6 py-10 text-center text-sm text-[#6B7280]">
              {facilitiesEmptyMessage}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredFacilities.map((facility) => {
                const selected = facility.id === selectedFacilityId;
                return (
                  <button
                    key={facility.id}
                    type="button"
                    onClick={() => setSelectedFacilityId(facility.id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      selected
                        ? "border-(--brand-primary) bg-[#F0FDFA] shadow-[0_0_0_1px_var(--brand-primary)]"
                        : "border-[#E5E7EB] bg-white hover:border-[#CBD5E1] hover:bg-[#FAFAFA]"
                    }`}
                  >
                    <div className="mb-3 flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F2F4F7] text-(--brand-primary)">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-[#111827]">{facility.name}</div>
                        <div className="mt-1 text-sm text-[#6B7280]">
                          {facility.address || "No address on file"}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                      {facility.facilityType ? (
                        <span className="rounded-full bg-[#F3F4F6] px-2 py-1">{facility.facilityType}</span>
                      ) : null}
                      <span className="rounded-full bg-[#ECFDF5] px-2 py-1 text-[#047857]">
                        Assigned candidates: {facility.assignedCount}
                      </span>
                      <span>Created {formatDate(facility.createdAt)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 sm:p-5">
          {!selectedFacility ? (
            <div className="flex min-h-[320px] items-center justify-center text-center text-sm text-[#6B7280]">
              Select a facility to view assigned candidates.
            </div>
          ) : (
            <>
              <div className="mb-5 border-b border-[#E5E7EB] pb-4">
                <h2 className="text-lg font-semibold text-[#111827]">
                  Assigned Candidates for {selectedFacility.name}
                </h2>
                <p className="mt-1 text-sm text-[#6B7280]">{selectedFacility.address || "No address on file"}</p>
              </div>

              {assignmentsError ? (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {assignmentsError}
                </div>
              ) : null}

              {loadingAssignments ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={`assignment-skeleton-${index}`} className="animate-pulse rounded-lg border border-[#E5E7EB] p-4">
                      <div className="mb-2 h-4 w-1/3 rounded bg-[#E5E7EB]" />
                      <div className="h-3 w-1/2 rounded bg-[#F3F4F6]" />
                    </div>
                  ))}
                </div>
              ) : assignedWorkers.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#D1D5DB] bg-[#F9FAFB] px-6 py-10 text-center text-sm text-[#6B7280]">
                  No candidates assigned to this facility yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] text-xs uppercase tracking-wide text-[#64748B]">
                        <th className="px-3 py-3 font-medium">Name</th>
                        <th className="px-3 py-3 font-medium">Job Role</th>
                        <th className="px-3 py-3 font-medium">Status</th>
                        <th className="px-3 py-3 font-medium">Location</th>
                        <th className="px-3 py-3 font-medium">Assigned</th>
                        <th className="px-3 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignedWorkers.map((worker) => (
                        <tr key={worker.assignmentId} className="border-b border-[#F1F5F9] last:border-b-0">
                          <td className="px-3 py-4 font-medium text-[#111827]">{workerName(worker)}</td>
                          <td className="px-3 py-4 text-[#475569]">{worker.jobRole || "—"}</td>
                          <td className="px-3 py-4">
                            <span className={candidateStatusBadgeClassName(worker.status ?? "")}>
                              {titleCaseStatus(worker.status)}
                            </span>
                          </td>
                          <td className="px-3 py-4 text-[#475569]">{worker.location}</td>
                          <td className="px-3 py-4 text-[#475569]">{formatDate(worker.assignedAt)}</td>
                          <td className="px-3 py-4">
                            <Link
                              href={`/admin_recruiter/new/profile/${worker.workerId}`}
                              className="text-sm font-medium text-(--brand-primary) hover:underline"
                            >
                              View profile
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {showCreateModal ? (
        <CreateFacilityModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={({ facilityId }) => {
            void loadFacilities().then(() => {
              if (facilityId) setSelectedFacilityId(facilityId);
            });
            toast.success("Facility created successfully.");
          }}
        />
      ) : null}

      {loadingFacilities ? (
        <div className="pointer-events-none fixed bottom-6 right-6 hidden items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-[#64748B] shadow lg:flex">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading facilities...
        </div>
      ) : null}
    </div>
  );
}
