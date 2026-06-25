"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Building2, Loader2, Plus, Search } from "lucide-react";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import CreateFacilityModal from "@/app/admin_recruiter/components/CreateFacilityModal";
import { CandidatesViewToggle } from "@/app/admin_recruiter/components/CandidatesListShell";
import { CandidateListAvatar } from "@/app/admin_recruiter/components/CandidateListAvatar";
import {
  CANDIDATES_PAGE_SUBTITLE_CLASS,
  CANDIDATES_PAGE_SUBTITLE_STYLE,
  CANDIDATES_PAGE_TITLE_CLASS,
  CANDIDATES_PAGE_TITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";
import { candidateStatusBadgeClassName } from "@/app/admin_recruiter/candidates/candidate-status-badge";
import { filterFacilitiesBySearch } from "@/lib/facilities/facility-management-service";
import type { FacilityAssignedWorker, FacilityManagementItem } from "@/lib/facilities/types";

const BRAND_ICON = "var(--brand-primary)";
const FACILITY_CARD_GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3";
const CANDIDATE_CARD_GRID_CLASS = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";

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

function AssignedCandidateCardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-[#e3ecea] bg-white p-3.5">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-full bg-[#E5E7EB]" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-[#E5E7EB]" />
          <div className="h-3 w-1/3 rounded bg-[#F3F4F6]" />
        </div>
      </div>
      <div className="mt-3 h-px bg-[#E5E7EB]" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full rounded bg-[#F3F4F6]" />
        <div className="h-3 w-4/5 rounded bg-[#F3F4F6]" />
      </div>
    </div>
  );
}

function formatAssignedDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${date} • ${time}`;
}

function formatDateShort(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function AssignedCandidateListSkeleton() {
  return (
    <div className="overflow-hidden rounded-md border border-[#E5E7EB]">
      <div className="animate-pulse space-y-0">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`list-skeleton-${index}`} className="flex gap-4 border-b border-[#E5E7EB] px-4 py-4 last:border-b-0">
            <div className="h-8 w-8 rounded-full bg-[#E5E7EB]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-[#E5E7EB]" />
              <div className="h-3 w-1/4 rounded bg-[#F3F4F6]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssignedCandidateListRow({ worker }: { worker: FacilityAssignedWorker }) {
  const name = workerName(worker);
  const statusLabel = titleCaseStatus(worker.status);

  return (
    <div className="border-b border-[#E5E7EB] p-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <CandidateListAvatar name={name} />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-black">{name}</div>
            <div className="mt-0.5 text-xs text-[#6B7280]">{worker.jobRole || "No role"}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-xl px-2 py-0.5 text-[10px] font-semibold ${candidateStatusBadgeClassName(worker.status ?? "")}`}
          >
            {statusLabel}
          </span>
          <Link
            href={`/admin_recruiter/new/profile/${worker.workerId}`}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#4e6462] transition hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)]"
            aria-label="View profile"
          >
            <BrandedSvgIcon src="/icons/admin-recruiter/eye.svg" className="h-4 w-4" color={BRAND_ICON} />
          </Link>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-[#4B5563]">
        <div className="flex items-start gap-2">
          <BrandedSvgIcon
            src="/icons/admin-recruiter/location-marker.svg"
            className="mt-0.5 h-4 w-4 shrink-0"
            color={BRAND_ICON}
          />
          <span className="leading-snug">{worker.location}</span>
        </div>
        <div className="flex items-center gap-2">
          <BrandedSvgIcon src="/icons/admin-recruiter/calendar.svg" className="h-4 w-4 shrink-0" color={BRAND_ICON} />
          <span>Assigned {formatDateShort(worker.assignedAt)}</span>
        </div>
      </div>
    </div>
  );
}

function AssignedCandidateList({ workers }: { workers: FacilityAssignedWorker[] }) {
  return (
    <>
      <div className="overflow-hidden rounded-md border border-[#E5E7EB] md:hidden">
        {workers.map((worker) => (
          <AssignedCandidateListRow key={worker.assignmentId} worker={worker} />
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-md border border-[#E5E7EB] md:block">
        <div className="overflow-auto">
        <table className="min-w-[760px] w-full border-collapse">
          <thead className="bg-[#F8FAFC]">
            <tr className="border-b border-[#E5E7EB]">
              <th className="border-r border-[#E5E7EB] bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black first:pl-6">
                Name
              </th>
              <th className="border-r border-[#E5E7EB] bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black">
                Job Role
              </th>
              <th className="border-r border-[#E5E7EB] bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black">
                Status
              </th>
              <th className="border-r border-[#E5E7EB] bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black">
                Location
              </th>
              <th className="min-w-[140px] whitespace-nowrap border-r border-[#E5E7EB] bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black">
                Assigned
              </th>
              <th className="bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black last:pr-6">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {workers.map((worker) => {
              const name = workerName(worker);
              const statusLabel = titleCaseStatus(worker.status);

              return (
                <tr key={worker.assignmentId} className="border-b border-[#E9EDF3] hover:bg-[#F9FBFB]">
                  <td className="border-r border-[#EEF2F7] px-4 py-4 align-middle first:pl-6">
                    <div className="flex min-w-0 items-center gap-3">
                      <CandidateListAvatar name={name} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-black">{name}</div>
                      </div>
                      <div className="ml-auto flex shrink-0 items-center gap-1.5">
                        <Link
                          href={`/admin_recruiter/new/profile/${worker.workerId}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md transition hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)]"
                          aria-label="View profile"
                        >
                          <BrandedSvgIcon src="/icons/admin-recruiter/eye.svg" className="h-4 w-4" color={BRAND_ICON} />
                        </Link>
                      </div>
                    </div>
                  </td>
                  <td className="border-r border-[#EEF2F7] px-4 py-4 align-middle text-sm text-[#374151]">
                    {worker.jobRole || "—"}
                  </td>
                  <td className="border-r border-[#EEF2F7] px-4 py-4 align-middle">
                    <div className="flex w-full justify-center">
                      <span
                        className={`inline-flex items-center rounded-xl px-2.5 py-0.5 text-sm font-medium ${candidateStatusBadgeClassName(worker.status ?? "")}`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                  </td>
                  <td className="border-r border-[#EEF2F7] px-4 py-4 align-middle text-sm text-[#4B5563]">
                    {worker.location}
                  </td>
                  <td className="min-w-[140px] whitespace-nowrap border-r border-[#EEF2F7] px-4 py-4 align-middle text-sm text-[#374151]">
                    {formatDateShort(worker.assignedAt)}
                  </td>
                  <td className="px-4 py-4 align-middle last:pr-6">
                    <Link
                      href={`/admin_recruiter/new/profile/${worker.workerId}`}
                      className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-(--brand-primary) px-4 text-sm font-semibold text-white transition hover:opacity-90"
                    >
                      View profile
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
}

function AssignedCandidateCard({ worker }: { worker: FacilityAssignedWorker }) {
  const name = workerName(worker);
  const statusLabel = titleCaseStatus(worker.status);

  return (
    <div className="rounded-lg border border-[#e3ecea] bg-white p-3.5 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <CandidateListAvatar name={name} />
          <div className="min-w-0">
            <div className="truncate text-sm font-normal text-black">{name}</div>
            <div className="mt-0.5 truncate text-[10px] text-[#6B7280]">{worker.jobRole || "No role"}</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href={`/admin_recruiter/new/profile/${worker.workerId}`}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#4e6462] transition hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)]"
            aria-label="View profile"
          >
            <BrandedSvgIcon src="/icons/admin-recruiter/eye.svg" className="h-4 w-4" color={BRAND_ICON} />
          </Link>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3">
        <div className="flex items-center gap-1.5 text-[11px] text-[#6f8380]">
          <BrandedSvgIcon src="/icons/admin-recruiter/calendar.svg" className="h-4 w-4" color={BRAND_ICON} />
          <span>{formatAssignedDateTime(worker.assignedAt)}</span>
        </div>
        <span
          className={`inline-flex items-center rounded-xl px-2 py-0.5 text-[10px] font-semibold ${candidateStatusBadgeClassName(worker.status ?? "")}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-3 space-y-1.5 text-[11px] text-[#4f6462]">
        <div className="flex items-start gap-2.5">
          <BrandedSvgIcon src="/icons/admin-recruiter/target.svg" className="h-4 w-4 shrink-0" color={BRAND_ICON} />
          <span className="truncate text-black">{worker.jobRole || "—"}</span>
        </div>
        <div className="flex items-start gap-2.5">
          <BrandedSvgIcon
            src="/icons/admin-recruiter/location-marker.svg"
            className="h-4 w-4 shrink-0"
            color={BRAND_ICON}
          />
          <span className="leading-snug text-black">{worker.location}</span>
        </div>
      </div>
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
  const [assignedCandidatesView, setAssignedCandidatesView] = useState<"card" | "list">("card");

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
    <div className="min-w-0 overflow-x-hidden px-4 pb-6 pt-4 sm:px-5 sm:pb-8 sm:pt-5 lg:px-8">
      <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className={CANDIDATES_PAGE_TITLE_CLASS} style={CANDIDATES_PAGE_TITLE_STYLE}>
            Locations
          </h1>
          <p className={CANDIDATES_PAGE_SUBTITLE_CLASS} style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
            View locations and assigned candidates
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="hidden h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-(--brand-primary) px-4 text-sm font-semibold text-white transition hover:opacity-90 sm:inline-flex"
        >
          <Plus className="h-4 w-4 shrink-0" />
          Create Facility
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2 sm:mb-5 sm:justify-between sm:gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search locations"
            className="h-11 w-full rounded-lg border border-[#D8E0EA] py-2 pl-9 pr-3 text-base text-[#0F172A] outline-none focus:border-(--brand-primary) sm:h-10 sm:text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-(--brand-primary) px-3 text-sm font-semibold text-white transition hover:opacity-90 sm:hidden"
          aria-label="Create Facility"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className="hidden min-[400px]:inline">Create Facility</span>
        </button>
        <div className="hidden text-sm text-[#64748B] sm:block sm:shrink-0">
          {loadingFacilities ? "Loading..." : `${filteredFacilities.length} facilities`}
        </div>
      </div>

      <div className="mb-4 text-sm text-[#64748B] sm:hidden">
        {loadingFacilities ? "Loading..." : `${filteredFacilities.length} facilities`}
      </div>

      {facilitiesError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {facilitiesError}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:gap-6">
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-3 sm:p-4 lg:p-5">
          <h2 className="mb-3 text-base font-semibold text-[#111827] sm:mb-4 sm:text-lg">All Facilities</h2>

          {loadingFacilities ? (
            <div className={FACILITY_CARD_GRID_CLASS}>
              {Array.from({ length: 4 }).map((_, index) => (
                <FacilityCardSkeleton key={`facility-skeleton-${index}`} />
              ))}
            </div>
          ) : filteredFacilities.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#D1D5DB] bg-[#F9FAFB] px-6 py-10 text-center text-sm text-[#6B7280]">
              {facilitiesEmptyMessage}
            </div>
          ) : (
            <div className={FACILITY_CARD_GRID_CLASS}>
              {filteredFacilities.map((facility) => {
                const selected = facility.id === selectedFacilityId;
                return (
                  <button
                    key={facility.id}
                    type="button"
                    onClick={() => setSelectedFacilityId(facility.id)}
                    className={`h-auto w-full rounded-xl border p-3.5 text-left transition sm:p-4 ${
                      selected
                        ? "border-(--brand-primary) bg-[#F0FDFA] shadow-[0_0_0_1px_var(--brand-primary)]"
                        : "border-[#E5E7EB] bg-white hover:border-[#CBD5E1] hover:bg-[#FAFAFA]"
                    }`}
                  >
                    <div className="mb-3 flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F2F4F7] text-(--brand-primary)">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-semibold break-words text-[#111827]">{facility.name}</div>
                        <div className="mt-1 text-sm leading-snug break-words text-[#6B7280]">
                          {facility.address || "No address on file"}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-2 text-xs text-[#64748B] sm:flex-row sm:flex-wrap sm:items-center">
                      {facility.facilityType ? (
                        <span className="rounded-full bg-[#F3F4F6] px-2 py-1">{facility.facilityType}</span>
                      ) : null}
                      <span className="rounded-full bg-[#ECFDF5] px-2 py-1 text-[#047857]">
                        <span className="sm:hidden">Candidates: {facility.assignedCount}</span>
                        <span className="hidden sm:inline">Assigned candidates: {facility.assignedCount}</span>
                      </span>
                      <span className="text-[#94A3B8] sm:text-[#64748B]">Created {formatDate(facility.createdAt)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[#E5E7EB] bg-white p-3 sm:p-4 lg:p-5">
          {!selectedFacility ? (
            <div className="rounded-lg border border-dashed border-[#D1D5DB] bg-[#F9FAFB] px-4 py-8 text-center text-sm text-[#6B7280] sm:px-6 sm:py-10">
              Select a facility to view assigned candidates.
            </div>
          ) : (
            <>
              <div className="mb-4 border-b border-[#E5E7EB] pb-4 sm:mb-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold break-words text-[#111827] sm:text-lg">
                      Assigned Candidates for {selectedFacility.name}
                    </h2>
                    <p className="mt-1 text-sm leading-snug break-words text-[#6B7280]">
                      {selectedFacility.address || "No address on file"}
                    </p>
                    {!loadingAssignments ? (
                      <p className="mt-2 text-sm text-[#64748B]">
                        {assignedWorkers.length} candidate{assignedWorkers.length === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </div>
                  <CandidatesViewToggle
                    view={assignedCandidatesView}
                    onViewChange={setAssignedCandidatesView}
                    size="sm"
                  />
                </div>
              </div>

              {assignmentsError ? (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {assignmentsError}
                </div>
              ) : null}

              {loadingAssignments ? (
                assignedCandidatesView === "list" ? (
                  <AssignedCandidateListSkeleton />
                ) : (
                  <div className={CANDIDATE_CARD_GRID_CLASS}>
                    {Array.from({ length: 3 }).map((_, index) => (
                      <AssignedCandidateCardSkeleton key={`assignment-skeleton-${index}`} />
                    ))}
                  </div>
                )
              ) : assignedWorkers.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#D1D5DB] bg-[#F9FAFB] px-6 py-10 text-center text-sm text-[#6B7280]">
                  No candidates assigned to this facility yet.
                </div>
              ) : assignedCandidatesView === "list" ? (
                <AssignedCandidateList workers={assignedWorkers} />
              ) : (
                <div className={CANDIDATE_CARD_GRID_CLASS}>
                  {assignedWorkers.map((worker) => (
                    <AssignedCandidateCard key={worker.assignmentId} worker={worker} />
                  ))}
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
