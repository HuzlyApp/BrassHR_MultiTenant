"use client";

import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { placementTypeFromApiRow } from "@/lib/jobs/placement";
import type { PlacementType } from "@/lib/jobs/types";

export type ExistingJobPickerOption = {
  id: string;
  public_title: string | null;
  source_job_title?: string | null;
  location: string | null;
  facility: string | null;
  facility_name: string | null;
  status?: string;
  source_type?: string | null;
  placement_type?: string | null;
  employment_type?: string | null;
  internal_requisition_number?: string | null;
  created_at?: string | null;
  published_at?: string | null;
};

export type ExistingJobSourceTypeFilter = "Internal" | "MSP";

function jobPickerSourceType(option: ExistingJobPickerOption): ExistingJobSourceTypeFilter {
  const raw = String(option.source_type ?? "").trim().toLowerCase();
  return raw === "msp" ? "MSP" : "Internal";
}

function jobPickerPlacementType(option: ExistingJobPickerOption): PlacementType {
  return placementTypeFromApiRow(
    jobPickerSourceType(option),
    option.placement_type,
    option.employment_type
  );
}

function JobSourceTypeToggle({
  value,
  onChange,
}: {
  value: ExistingJobSourceTypeFilter;
  onChange: (value: ExistingJobSourceTypeFilter) => void;
}) {
  return (
    <div
      className="inline-flex h-10 shrink-0 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-0.5"
      role="group"
      aria-label="Job source type"
    >
      {(["Internal", "MSP"] as const).map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option)}
            className={`min-w-[76px] rounded-md px-3 text-sm font-medium transition ${
              selected
                ? "bg-[color:var(--brand-primary)] text-white shadow-sm"
                : "text-[#64748B] hover:text-[#334155]"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

const FORM_SURFACE_CLASS = "rounded-lg border border-[#CBD5E1] bg-white";
const FILTER_SELECT_CLASS = `${FORM_SURFACE_CLASS} h-8 cursor-pointer appearance-none bg-[length:12px_12px] bg-[right_10px_center] bg-no-repeat px-2.5 pr-8 text-sm font-normal leading-6 text-[#334155] hover:bg-zinc-50 focus:border-[color:var(--brand-primary)] focus:outline-none focus:ring-0`;
const FILTER_SELECT_CHEVRON = {
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  )}")`,
} as const;

function formatJobLocation(job: ExistingJobPickerOption): string {
  return (
    job.location?.trim() ||
    job.facility_name?.trim() ||
    job.facility?.trim() ||
    "—"
  );
}

function jobPickerDisplayTitle(option: ExistingJobPickerOption): string {
  if (jobPickerSourceType(option) === "MSP") {
    return (
      option.source_job_title?.trim() ||
      option.public_title?.trim() ||
      "Untitled job"
    );
  }
  return option.public_title?.trim() || "Untitled job";
}

function jobReference(option: ExistingJobPickerOption): string {
  return option.internal_requisition_number?.trim() || option.id.slice(0, 8).toUpperCase();
}

type ExistingJobPickerPanelProps = {
  jobs: ExistingJobPickerOption[];
  loading: boolean;
  selectedJobId: string | null;
  onSelectJob: (jobId: string | null) => void;
  sourceTypeFilter: ExistingJobSourceTypeFilter;
  onSourceTypeFilterChange: (value: ExistingJobSourceTypeFilter) => void;
  placementTypeFilter?: PlacementType | null;
};

export function ExistingJobPickerPanel({
  jobs,
  loading,
  selectedJobId,
  onSelectJob,
  sourceTypeFilter,
  onSourceTypeFilterChange,
  placementTypeFilter = null,
}: ExistingJobPickerPanelProps) {
  const branding = useTenantBranding();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "">("");

  useEffect(() => {
    setLocationFilter("");
  }, [sourceTypeFilter, placementTypeFilter]);

  const sourceFilteredJobs = useMemo(
    () =>
      jobs.filter((option) => {
        if (jobPickerSourceType(option) !== sourceTypeFilter) return false;
        if (
          sourceTypeFilter === "MSP" &&
          (placementTypeFilter === "Recruit_and_Release" ||
            placementTypeFilter === "Recruit_and_EOR") &&
          jobPickerPlacementType(option) !== placementTypeFilter
        ) {
          return false;
        }
        return true;
      }),
    [jobs, sourceTypeFilter, placementTypeFilter]
  );

  const locationOptions = useMemo(() => {
    const values = new Set<string>();
    for (const job of sourceFilteredJobs) {
      const loc = formatJobLocation(job);
      if (loc && loc !== "—") values.add(loc);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [sourceFilteredJobs]);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    let next = sourceFilteredJobs.filter((option) => {
      if (statusFilter && option.status !== statusFilter) return false;
      if (locationFilter) {
        const loc = formatJobLocation(option);
        if (loc !== locationFilter) return false;
      }
      if (q) {
        const title = jobPickerDisplayTitle(option).toLowerCase();
        const ref = jobReference(option).toLowerCase();
        if (!title.includes(q) && !ref.includes(q)) return false;
      }
      return true;
    });

    next = [...next].sort((a, b) => {
      const aTime = new Date(a.published_at || a.created_at || 0).getTime();
      const bTime = new Date(b.published_at || b.created_at || 0).getTime();
      return sortBy === "oldest" ? aTime - bTime : bTime - aTime;
    });
    return next;
  }, [sourceFilteredJobs, search, statusFilter, locationFilter, sortBy]);

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setLocationFilter("");
    setSortBy("");
  }

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white">
      <div className="space-y-3 border-b border-[#E5E7EB] p-3 sm:p-4">
        <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center">
          <label className="relative block min-w-0 flex-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/search-candidate-jobs.svg"
              alt=""
              width={20}
              height={20}
              className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by job title"
              className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white py-2 pl-11 pr-3 text-sm text-[#334155] placeholder:text-[#94A3B8] focus:border-[color:var(--brand-primary)] focus:outline-none focus:ring-0 [&::-webkit-search-cancel-button]:cursor-pointer [&::-webkit-search-decoration]:cursor-pointer"
            />
          </label>
          <JobSourceTypeToggle value={sourceTypeFilter} onChange={onSourceTypeFilterChange} />
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`${FILTER_SELECT_CLASS} shrink-0`}
              style={FILTER_SELECT_CHEVRON}
              aria-label="Filter by status"
            >
              <option value="">Active</option>
              <option value="published">Open</option>
              <option value="draft">Draft</option>
              <option value="closed">Closed</option>
              <option value="archived">Archived</option>
            </select>

            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className={`${FILTER_SELECT_CLASS} min-w-0 max-w-[140px] flex-1 sm:max-w-[180px] sm:flex-none`}
              style={FILTER_SELECT_CHEVRON}
              aria-label="Filter by location"
            >
              <option value="">Location</option>
              {locationOptions.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={clearFilters}
              className="shrink-0 px-1 text-sm font-bold whitespace-nowrap text-black transition hover:opacity-80"
            >
              Clear all
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "oldest" | "")}
              className={`${FILTER_SELECT_CLASS} shrink-0`}
              style={FILTER_SELECT_CHEVRON}
              aria-label="Sort jobs"
            >
              <option value="">Sort by</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
            <p className="inline-flex shrink-0 items-center gap-1.5 text-sm whitespace-nowrap text-[#64748B]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/jobs-count-icon.svg"
                alt=""
                width={14}
                height={14}
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden
              />
              <span>{filteredJobs.length} of {sourceFilteredJobs.length} jobs</span>
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 max-h-[min(360px,50vh)] overflow-x-hidden overflow-y-auto rounded-b-xl">
        {loading ? (
          <p className="px-4 py-6 text-sm text-[#64748B]">Loading jobs…</p>
        ) : filteredJobs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[#64748B]">No jobs match these filters.</p>
        ) : (
          filteredJobs.map((option) => {
            const title = jobPickerDisplayTitle(option);
            const location = formatJobLocation(option);
            const selected = option.id === selectedJobId;
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onSelectJob(selected ? null : option.id)}
                className={`flex w-full items-center gap-3 border-b border-[#E5E7EB] px-3 py-3.5 text-left transition last:border-b-0 sm:px-4 ${
                  selected ? "bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)]" : "hover:bg-[#F8FAFC]"
                }`}
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                  {selected ? (
                    <Check
                      className="h-5 w-5"
                      style={{ color: branding.primaryHex }}
                      strokeWidth={2.75}
                      aria-label="Selected job"
                    />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-5 text-[#1E293B]">{title}</span>
                  <span className="mt-0.5 block text-xs leading-4 text-[#64748B]">
                    {location !== "—" ? location : jobReference(option)}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
